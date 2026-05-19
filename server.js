import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())

const configPath = path.resolve(__dirname, '../config/atlassian.yaml')
const config = yaml.load(fs.readFileSync(configPath, 'utf8'))
const email = config.credentials.email
const apiToken = config.credentials.api_token
const authHeader = 'Basic ' + Buffer.from(`${email}:${apiToken}`).toString('base64')
const JIRA_BASE = 'https://api.atlassian.com/ex/jira/85cd207b-0617-4d47-81a2-6cd6e902ca59/rest/api/3'

function extractText(doc, maxLen = 800) {
  if (!doc) return 'No description provided'
  const paragraphs = []
  let currentPara = []

  function walk(node) {
    if (!node) return
    if (node.type === 'text') currentPara.push(node.text || '')
    else if (node.type === 'mention') currentPara.push(`@${node.attrs?.text || 'user'}`)
    else if (node.type === 'inlineCard') {
      const url = node.attrs?.url || ''
      const shortUrl = url.replace('https://harness.atlassian.net/', '')
      currentPara.push(`[${shortUrl}]`)
    }
    else if (node.type === 'hardBreak') currentPara.push('\n')
    else if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
      if (currentPara.length) {
        paragraphs.push(currentPara.join(''))
        currentPara = []
      }
      if (node.content) node.content.forEach(walk)
      if (currentPara.length) {
        paragraphs.push(currentPara.join(''))
        currentPara = []
      }
      return
    }
    if (node.content) node.content.forEach(walk)
  }

  walk(doc)
  if (currentPara.length) paragraphs.push(currentPara.join(''))

  const result = paragraphs.filter(p => p.trim()).join(' | ').trim()
  return result ? result.slice(0, maxLen) : 'No description provided'
}

function getLastComment(comments) {
  if (!comments?.comments?.length) return 'No comments'
  const last = comments.comments[comments.comments.length - 1]
  const author = last.author?.displayName || 'Unknown'
  const text = extractText(last.body)
  return `${author}: ${text.slice(0, 200)}`
}

app.get('/api/filters', (req, res) => {
  const filters = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/filters.json'), 'utf8'))
  res.json(filters)
})

app.get('/api/closures', (req, res) => {
  const closures = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/closures.json'), 'utf8'))
  res.json(closures)
})

app.get('/api/closures/live', async (req, res) => {
  try {
    const jql = 'project in (PL, UDP) AND issuetype in (Initiative, Epic) AND resolution != Unresolved AND resolved >= "2026-05-05" ORDER BY resolved DESC'
    const searchResp = await fetch(`${JIRA_BASE}/search/jql`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql,
        fields: ['summary', 'status', 'reporter', 'assignee', 'resolution', 'resolutiondate', 'comment'],
        maxResults: 100
      })
    })
    if (!searchResp.ok) return res.status(400).json({ error: 'Failed to fetch resolved tickets' })
    const data = await searchResp.json()
    const issues = data.issues || []

    const tickets = issues.map(issue => {
      const f = issue.fields
      const comments = f.comment?.comments || []
      const vikramComment = comments.find(c => c.author?.displayName === 'Vikram Sahu')
      const lastComment = comments.length ? comments[comments.length - 1] : null

      return {
        key: issue.key,
        summary: f.summary,
        reporter: f.reporter?.displayName || 'Unknown',
        assignee: f.assignee?.displayName || 'Unassigned',
        currentStatus: f.status?.name || 'Unknown',
        resolution: f.resolution?.name || 'None',
        resolved: f.resolutiondate ? f.resolutiondate.slice(0, 10) : null,
        commentedByUs: !!vikramComment,
        closureComment: vikramComment ? extractText(vikramComment.body, 300) : (lastComment ? `${lastComment.author?.displayName}: ${extractText(lastComment.body, 200)}` : 'No comments')
      }
    })

    res.json({ total: tickets.length, tickets })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Analysis endpoints (must be before /api/tickets/:filterId) ---

const ANALYSIS_QUERIES = {
  openCfds: {
    name: 'Platform All Open CFDs',
    jql: 'project IN (PL, "Unified Data Platform") AND project = Platform AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) AND "Customer(s)" is not EMPTY AND "Customer(s)" not in ("Harness/ Internal", Harness) and resolution = Unresolved'
  },
  cfdsTrend: {
    name: 'Platform-All-CFDs-Trend',
    jql: 'project IN (PL, "Unified Data Platform") AND project = Platform AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) AND "Customer(s)" is not EMPTY AND "Customer(s)" not in ("Harness/ Internal", Harness) AND created >= -180d'
  },
  breachedSla: {
    name: 'Platform-Open-CFDs-BreachedSLA',
    jql: 'project IN (PL, "Unified Data Platform") AND project = Platform AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) AND "Customer(s)" is not EMPTY AND "Customer(s)" not in ("Harness/ Internal", Harness) and resolution = Unresolved and (priority in (p0, p1) or "Severity[Dropdown]" in (S0, S1) or (priority = p2 and created < -6w) or ("Severity[Dropdown]" = S2 and created < -6w) or ("Severity[Dropdown]" = S3 and created < -90d) or ("Severity[Dropdown]" = S4 and created < -180d))'
  },
  allOpenProd: {
    name: 'Platform-All-OPEN-Prod',
    jql: 'project in (Pl, UDP) AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) AND resolution = Unresolved'
  },
  prodTrend: {
    name: 'Platform-PROD-All-Trend',
    jql: 'project in (Pl, UDP) and issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) and created >= -180d ORDER BY status ASC'
  },
  prodLast2Wks: {
    name: 'Platform-PROD-Created-Last2Wks',
    jql: 'project in (Pl, UDP) and issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) and resolution = Unresolved AND created >= -2w'
  },
  missingSeverity: {
    name: 'Platform Missing Severity',
    jql: "project in (Platform, \"Unified Data Platform\") and issuetype = bug and severity is EMPTY and \"Found In[Dropdown]\" in ('PROD', 'PROD-0') and resolution = Unresolved"
  }
}

async function fetchJqlResults(jql, fields, maxResults = 100) {
  const allIssues = []
  let nextPageToken = null
  let isLast = false

  while (!isLast) {
    const body = { jql, fields, maxResults }
    if (nextPageToken) body.nextPageToken = nextPageToken

    const resp = await fetch(`${JIRA_BASE}/search/jql`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!resp.ok) throw new Error(`JQL failed: ${(await resp.text()).slice(0, 200)}`)
    const data = await resp.json()
    allIssues.push(...(data.issues || []))
    nextPageToken = data.nextPageToken || null
    isLast = data.isLast !== false
    if (allIssues.length >= 500) break
  }
  return { issues: allIssues, total: allIssues.length }
}

app.get('/api/analysis', async (req, res) => {
  try {
    const results = {}
    const keys = Object.keys(ANALYSIS_QUERIES)
    const fields = ['summary', 'status', 'created', 'updated', 'resolved', 'reporter', 'assignee', 'priority', 'issuetype', 'labels', 'components', 'customfield_10732', 'customfield_10037']

    await Promise.all(keys.map(async (key) => {
      try {
        const { issues, total } = await fetchJqlResults(ANALYSIS_QUERIES[key].jql, fields)
        results[key] = { total, count: issues.length }
      } catch (e) {
        results[key] = { total: 0, count: 0, error: e.message }
      }
    }))

    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/analysis/:queryKey', async (req, res) => {
  const { queryKey } = req.params
  const query = ANALYSIS_QUERIES[queryKey]
  if (!query) return res.status(404).json({ error: `Unknown query: ${queryKey}` })

  try {
    const fields = ['summary', 'status', 'created', 'updated', 'resolved', 'reporter', 'assignee', 'priority', 'issuetype', 'labels', 'components', 'customfield_10732', 'customfield_10037']
    const { issues, total } = await fetchJqlResults(query.jql, fields)

    const today = new Date()
    const tickets = issues.map(issue => {
      const f = issue.fields
      const created = f.created?.slice(0, 10) || ''
      const createdDate = new Date(created)
      const daysPending = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24))

      const customers = (f.customfield_10732 || []).map(c => c.value || c).filter(Boolean)
      const severity = f.customfield_10037?.value || null
      const components = (f.components || []).map(c => c.name)

      return {
        key: issue.key,
        summary: f.summary,
        status: f.status?.name || 'Unknown',
        created,
        updated: f.updated?.slice(0, 10) || '',
        resolved: f.resolved?.slice(0, 10) || null,
        daysPending,
        priority: f.priority?.name || 'None',
        reporter: f.reporter?.displayName || 'Unknown',
        assignee: f.assignee?.displayName || 'Unassigned',
        issueType: f.issuetype?.name || 'Bug',
        labels: f.labels || [],
        components,
        customers,
        severity
      }
    })

    res.json({ name: query.name, jql: query.jql, total, tickets })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// --- Leaderboard endpoint ---

const LEADERBOARD_FILTERS = {
  cfd: {
    name: 'Customer Filed Defects (CFD)',
    jql: 'project IN (PL, "Unified Data Platform") AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) AND "Customer(s)" is not EMPTY AND "Customer(s)" not in ("Harness/ Internal", Harness) and resolution = Unresolved',
    enabled: true
  },
  prod: {
    name: 'All PROD Bugs',
    jql: 'project in (Pl, UDP) AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND status not in (Invalid, "Can Not Reproduce", "Not a Bug", "Will Not Fix", Duplicate) AND resolution = Unresolved',
    enabled: true
  },
  regression: {
    name: 'Regressions',
    jql: 'project in (PL, "Unified Data Platform") AND issuetype = Bug AND (labels IN (regression) OR "Defect Type[Select List (multiple choices)]" = Regression) AND resolution = Unresolved',
    enabled: false
  },
  ifd: {
    name: 'Internal Filed Defects (IFD)',
    jql: 'project in (Platform, UDP) AND issuetype = Bug AND "Found In[Dropdown]" in (PROD, PROD-0, ONPREM, SMP) AND (\"Customer(s)\" is EMPTY OR \"Customer(s)\" in (Harness, \"Harness/ Internal\")) AND resolution = Unresolved',
    enabled: false
  },
  rca: {
    name: 'RCA',
    jql: 'project in (PL, "Unified Data Platform") AND issuetype = rca AND status not in (done, invalid, cancelled)',
    enabled: false
  },
  vulnerability: {
    name: 'Vulnerability',
    jql: 'Project in (PL,UDP) AND labels in (vuln) AND status not in (deployed, "will not fix", done, "not a bug", "duplicate", "cancelled", "invalid","Dev Complete")',
    enabled: false
  },
  depend: {
    name: 'Dependencies',
    jql: 'project in (Platform, "Unified Data Platform") AND (issuetype = Depend OR issueLinkType in ("is blocked by")) AND resolution = Unresolved',
    enabled: false
  },
  quarterly: {
    name: 'Quarterly Planning',
    jql: 'project in (PL, UDP) AND issuetype in (Initiative, Epic, Spike) AND "Delivery quarter[Dropdown]" = 2Q2027 AND STATUS NOT IN (DUPLICATE, Invalid, "Will Not Fix")',
    enabled: false
  }
}

function generateAnalysis(ticket) {
  const { daysPending, status, priority, severity, children, customers, assignee, reporter, updated, created, components, sprints, lastComment } = ticket

  const analysis = {
    riskLevel: 'low',
    summary: '',
    findings: [],
    recommendation: '',
    slaStatus: 'within',
    businessImpact: 'low',
    actionItems: []
  }

  // --- SLA Assessment ---
  const slaDays = { S0: 3, S1: 7, S2: 42, S3: 90, S4: 180, P0: 3, P1: 7, P2: 42 }
  const slaLimit = slaDays[severity] || slaDays[priority] || 180
  const slaBreached = daysPending > slaLimit
  const slaDaysRemaining = slaLimit - daysPending

  if (slaBreached) {
    analysis.slaStatus = 'breached'
    analysis.findings.push({ type: 'critical', category: 'SLA', text: `SLA breached by ${Math.abs(slaDaysRemaining)} days. Target was ${slaLimit}d for ${severity || priority || 'default'}.` })
  } else if (slaDaysRemaining <= 7 && slaDaysRemaining > 0) {
    analysis.slaStatus = 'at-risk'
    analysis.findings.push({ type: 'warning', category: 'SLA', text: `SLA at risk — only ${slaDaysRemaining} days remaining before breach.` })
  }

  // --- Staleness & Progress ---
  const daysSinceUpdate = Math.floor((new Date() - new Date(updated)) / (1000 * 60 * 60 * 24))

  if (status === 'To Do' && daysPending > 180) {
    analysis.findings.push({ type: 'critical', category: 'Progress', text: `Untouched for ${daysPending} days in "To Do". No work has been initiated. This ticket is effectively abandoned.` })
    analysis.actionItems.push('Close as "Won\'t Fix" or reassign with a hard sprint commitment.')
  } else if (status === 'To Do' && daysPending > 60) {
    analysis.findings.push({ type: 'warning', category: 'Progress', text: `Sitting in backlog for ${daysPending} days without pickup. Likely deprioritized or ownership unclear.` })
    analysis.actionItems.push('Assign to a specific sprint with clear owner or deprioritize explicitly.')
  } else if (status === 'In Progress' && daysSinceUpdate > 30) {
    analysis.findings.push({ type: 'warning', category: 'Progress', text: `Marked "In Progress" but no update in ${daysSinceUpdate} days. Likely stuck, blocked, or assignee moved to other work.` })
    analysis.actionItems.push('Check with assignee for blockers. Consider reassignment if no response in 48h.')
  } else if (status === 'In Progress' && daysPending > 90) {
    analysis.findings.push({ type: 'warning', category: 'Progress', text: `In Progress for ${daysPending} days — significantly exceeds normal cycle time. May need scope reduction or additional resources.` })
  }

  if (daysSinceUpdate > 60 && status !== 'To Do') {
    analysis.findings.push({ type: 'warning', category: 'Activity', text: `Last activity ${daysSinceUpdate} days ago. Ticket appears dormant despite non-backlog status.` })
  }

  // --- Customer Impact ---
  if (customers.length >= 5) {
    analysis.businessImpact = 'critical'
    analysis.findings.push({ type: 'critical', category: 'Business Impact', text: `Affecting ${customers.length} customers. High churn risk — this is a retention-critical defect. Escalate to engineering leadership.` })
    analysis.actionItems.push(`Escalate to engineering leadership. ${customers.length} customers impacted = revenue risk.`)
  } else if (customers.length >= 3) {
    analysis.businessImpact = 'high'
    analysis.findings.push({ type: 'impact', category: 'Business Impact', text: `${customers.length} customers impacted. Multi-customer defect indicates systemic issue, not edge case.` })
    analysis.actionItems.push('Prioritize as cross-customer systemic issue. Consider dedicated sprint focus.')
  } else if (customers.length >= 1) {
    analysis.businessImpact = 'medium'
    if (daysPending > 60) {
      analysis.findings.push({ type: 'info', category: 'Business Impact', text: `Customer-reported bug open ${daysPending} days. Risk of support escalation or NPS impact.` })
    }
  }

  // --- Child Ticket Progress ---
  if (children && children.total > 0) {
    const completionPct = Math.round(((children.done + children.closed) / children.total) * 100)
    if (children.done + children.closed === children.total) {
      analysis.findings.push({ type: 'action', category: 'Completion', text: `All ${children.total} subtasks completed (${children.done} done, ${children.closed} closed). Parent ticket should be resolved immediately.` })
      analysis.actionItems.push('Resolve parent ticket — all work is complete.')
    } else if (children.open === children.total && daysPending > 60) {
      analysis.findings.push({ type: 'critical', category: 'Execution', text: `0/${children.total} subtasks completed after ${daysPending} days. Execution has not started despite decomposition.` })
      analysis.actionItems.push('Conduct sprint planning for child tickets or consolidate scope.')
    } else if (completionPct > 0 && completionPct < 50 && daysPending > 90) {
      analysis.findings.push({ type: 'warning', category: 'Execution', text: `Only ${completionPct}% complete (${children.done}/${children.total}) after ${daysPending} days. Velocity insufficient for remaining work.` })
    } else if (completionPct >= 50) {
      analysis.findings.push({ type: 'info', category: 'Execution', text: `${completionPct}% complete (${children.done}/${children.total} done). Good progress — track remaining items.` })
    }
  }

  // --- Ownership & Assignment ---
  if (assignee === 'Unassigned') {
    analysis.findings.push({ type: 'warning', category: 'Ownership', text: 'No assignee. Unowned bugs do not get resolved. Assign immediately.' })
    analysis.actionItems.push('Assign to component owner or on-call engineer.')
  }

  if (!severity && daysPending > 7) {
    analysis.findings.push({ type: 'info', category: 'Triage', text: 'Missing severity classification. Cannot properly assess SLA compliance without severity.' })
    analysis.actionItems.push('Set severity to enable proper SLA tracking and prioritization.')
  }

  // --- Compute overall risk level ---
  const criticalCount = analysis.findings.filter(f => f.type === 'critical').length
  const warningCount = analysis.findings.filter(f => f.type === 'warning').length

  if (criticalCount >= 2 || (criticalCount >= 1 && customers.length >= 3)) {
    analysis.riskLevel = 'critical'
  } else if (criticalCount >= 1 || warningCount >= 2) {
    analysis.riskLevel = 'high'
  } else if (warningCount >= 1) {
    analysis.riskLevel = 'medium'
  } else {
    analysis.riskLevel = 'low'
  }

  // --- Generate executive summary ---
  if (analysis.riskLevel === 'critical') {
    analysis.summary = `CRITICAL: ${severity || priority || 'Unclassified'} bug impacting ${customers.length} customer${customers.length !== 1 ? 's' : ''}, open ${daysPending} days. ${slaBreached ? 'SLA breached.' : 'SLA at risk.'} Immediate leadership attention required.`
  } else if (analysis.riskLevel === 'high') {
    analysis.summary = `HIGH RISK: ${status} for ${daysPending} days. ${customers.length > 0 ? `${customers.length} customer${customers.length !== 1 ? 's' : ''} affected. ` : ''}${analysis.actionItems[0] || 'Needs attention this sprint.'}`
  } else if (analysis.riskLevel === 'medium') {
    analysis.summary = `MONITOR: ${status} for ${daysPending} days. ${customers.length > 0 ? `Customer-reported. ` : ''}${daysSinceUpdate > 14 ? `Last update ${daysSinceUpdate}d ago. ` : ''}Track for next standup.`
  } else {
    analysis.summary = `ON TRACK: ${status}${daysPending <= 14 ? ' (recently filed)' : ` for ${daysPending} days`}. No immediate concerns.`
  }

  // Default finding if none generated
  if (analysis.findings.length === 0) {
    analysis.findings.push({ type: 'ok', category: 'Status', text: 'Ticket is within expected parameters. No action required at this time.' })
  }

  if (analysis.actionItems.length === 0) {
    analysis.actionItems.push('Continue monitoring. No immediate action needed.')
  }

  return analysis
}

app.get('/api/leaderboard/:filterKey', async (req, res) => {
  const { filterKey } = req.params
  const filter = LEADERBOARD_FILTERS[filterKey]
  if (!filter) return res.status(404).json({ error: `Unknown filter: ${filterKey}` })
  if (!filter.enabled) return res.status(400).json({ error: `Filter '${filter.name}' is not yet enabled` })

  try {
    const fields = ['summary', 'description', 'status', 'created', 'updated', 'reporter', 'assignee', 'priority', 'issuetype', 'labels', 'components', 'customfield_10732', 'customfield_10037', 'customfield_10020', 'comment']
    const { issues } = await fetchJqlResults(filter.jql, fields)

    const keys = issues.map(i => i.key)
    let childIssues = []
    if (keys.length > 0) {
      const batchSize = 50
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize)
        try {
          const { issues: children } = await fetchJqlResults(
            `parent in (${batch.join(',')})`,
            ['summary', 'status', 'assignee', 'created', 'updated', 'resolved', 'parent', 'priority'],
            100
          )
          childIssues.push(...children)
        } catch (e) { /* some tickets may not have children */ }
      }
    }

    const childMap = {}
    for (const child of childIssues) {
      const pk = child.fields?.parent?.key || 'unknown'
      if (!childMap[pk]) childMap[pk] = []
      childMap[pk].push({
        key: child.key,
        summary: child.fields.summary,
        status: child.fields.status?.name || 'Unknown',
        assignee: child.fields.assignee?.displayName || 'Unassigned',
        priority: child.fields.priority?.name || 'None',
        created: child.fields.created?.slice(0, 10) || '',
        updated: child.fields.updated?.slice(0, 10) || '',
        resolved: child.fields.resolved?.slice(0, 10) || null
      })
    }

    const today = new Date()
    const tickets = issues.map(issue => {
      const f = issue.fields
      const created = f.created?.slice(0, 10) || ''
      const createdDate = new Date(created)
      const daysPending = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24))

      const customers = (f.customfield_10732 || []).map(c => c.value || c).filter(Boolean)
      const severity = f.customfield_10037?.value || null
      const components = (f.components || []).map(c => c.name)
      const sprints = (f.customfield_10020 || []).map(s => typeof s === 'string' ? s : s.name || s.id || '').filter(Boolean)

      const kids = childMap[issue.key] || []
      const totalChildren = kids.length
      const doneChildren = kids.filter(k => ['Done', 'Deployed', 'Dev Complete'].includes(k.status)).length
      const closedChildren = kids.filter(k => ['Will Not Fix', 'Invalid', 'Duplicate', 'Not a Bug', 'Canceled'].includes(k.status)).length
      const openChildren = totalChildren - doneChildren - closedChildren

      const lastComment = getLastComment(f.comment)
      const description = extractText(f.description, 400)

      const ticket = {
        key: issue.key,
        summary: f.summary,
        description,
        status: f.status?.name || 'Unknown',
        created,
        updated: f.updated?.slice(0, 10) || '',
        daysPending,
        priority: f.priority?.name || 'None',
        severity,
        reporter: f.reporter?.displayName || 'Unknown',
        assignee: f.assignee?.displayName || 'Unassigned',
        components,
        customers,
        sprints,
        labels: f.labels || [],
        lastComment,
        children: { total: totalChildren, done: doneChildren, closed: closedChildren, open: openChildren, items: kids }
      }

      ticket.analysis = generateAnalysis(ticket)
      return ticket
    })

    tickets.sort((a, b) => {
      const sevOrder = { S0: 0, S1: 1, S2: 2, S3: 3, S4: 4 }
      const aScore = (sevOrder[a.severity] ?? 5) + (a.daysPending > 90 ? -10 : 0) + (a.customers.length >= 3 ? -5 : 0)
      const bScore = (sevOrder[b.severity] ?? 5) + (b.daysPending > 90 ? -10 : 0) + (b.customers.length >= 3 ? -5 : 0)
      return aScore - bScore
    })

    const allCustomers = [...new Set(tickets.flatMap(t => t.customers))].sort()
    const allAssignees = [...new Set(tickets.map(t => t.assignee))].sort()
    const allReporters = [...new Set(tickets.map(t => t.reporter))].sort()
    const allSprints = [...new Set(tickets.flatMap(t => t.sprints))].sort()

    res.json({
      name: filter.name,
      jql: filter.jql,
      total: tickets.length,
      lastUpdated: new Date().toISOString(),
      filters: { customers: allCustomers, assignees: allAssignees, reporters: allReporters, sprints: allSprints },
      tickets
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/leaderboard', (req, res) => {
  res.json(LEADERBOARD_FILTERS)
})

app.get('/api/leaderboard/:filterKey/export', async (req, res) => {
  const { filterKey } = req.params
  const filter = LEADERBOARD_FILTERS[filterKey]
  if (!filter) return res.status(404).json({ error: `Unknown filter: ${filterKey}` })
  if (!filter.enabled) return res.status(400).json({ error: `Filter not enabled` })

  try {
    const fields = ['summary', 'description', 'status', 'created', 'updated', 'reporter', 'assignee', 'priority', 'issuetype', 'labels', 'components', 'customfield_10732', 'customfield_10037', 'customfield_10020', 'comment']
    const { issues } = await fetchJqlResults(filter.jql, fields)

    const keys = issues.map(i => i.key)
    let childIssues = []
    if (keys.length > 0) {
      const batchSize = 50
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize)
        try {
          const { issues: children } = await fetchJqlResults(`parent in (${batch.join(',')})`, ['summary', 'status', 'assignee', 'parent', 'priority'], 100)
          childIssues.push(...children)
        } catch (e) { }
      }
    }
    const childMap = {}
    for (const child of childIssues) {
      const pk = child.fields?.parent?.key || 'unknown'
      if (!childMap[pk]) childMap[pk] = []
      childMap[pk].push({ key: child.key, summary: child.fields.summary, status: child.fields.status?.name || 'Unknown', assignee: child.fields.assignee?.displayName || 'Unassigned' })
    }

    const today = new Date()
    const rows = issues.map(issue => {
      const f = issue.fields
      const created = f.created?.slice(0, 10) || ''
      const daysPending = Math.floor((today - new Date(created)) / (1000 * 60 * 60 * 24))
      const customers = (f.customfield_10732 || []).map(c => c.value || c).filter(Boolean)
      const severity = f.customfield_10037?.value || ''
      const components = (f.components || []).map(c => c.name)
      const kids = childMap[issue.key] || []
      const doneChildren = kids.filter(k => ['Done', 'Deployed', 'Dev Complete'].includes(k.status)).length
      const closedChildren = kids.filter(k => ['Will Not Fix', 'Invalid', 'Duplicate', 'Not a Bug', 'Canceled'].includes(k.status)).length
      const openChildren = kids.length - doneChildren - closedChildren

      const ticket = {
        key: issue.key, summary: f.summary, status: f.status?.name || '', created,
        updated: f.updated?.slice(0, 10) || '', daysPending, priority: f.priority?.name || '',
        severity, reporter: f.reporter?.displayName || '', assignee: f.assignee?.displayName || '',
        components, customers, children: { total: kids.length, done: doneChildren, closed: closedChildren, open: openChildren, items: kids }
      }
      const analysis = generateAnalysis(ticket)

      return {
        'Ticket Key': issue.key,
        'URL': `https://harness.atlassian.net/browse/${issue.key}`,
        'Summary': f.summary,
        'Status': f.status?.name || '',
        'Priority': f.priority?.name || '',
        'Severity': severity,
        'Assignee': f.assignee?.displayName || 'Unassigned',
        'Reporter': f.reporter?.displayName || '',
        'Created': created,
        'Last Updated': f.updated?.slice(0, 10) || '',
        'Age (Days)': daysPending,
        'Customers': customers.join('; '),
        'Customer Count': customers.length,
        'Components': components.join('; '),
        'Child Tickets': kids.length,
        'Children Done': doneChildren,
        'Children Open': openChildren,
        'Completion %': kids.length > 0 ? Math.round(((doneChildren + closedChildren) / kids.length) * 100) : 'N/A',
        'Risk Level': analysis.riskLevel.toUpperCase(),
        'SLA Status': analysis.slaStatus,
        'Business Impact': analysis.businessImpact,
        'AI Summary': analysis.summary,
        'Key Findings': analysis.findings.map(f => `[${f.category}] ${f.text}`).join(' | '),
        'Action Items': analysis.actionItems.join(' | ')
      }
    })

    // Generate CSV with BOM for Excel compatibility
    const headers = Object.keys(rows[0] || {})
    const escapeCsv = (val) => {
      const str = String(val ?? '')
      if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
      return str
    }
    const csv = '﻿' + headers.map(escapeCsv).join(',') + '\n' + rows.map(row => headers.map(h => escapeCsv(row[h])).join(',')).join('\n')

    const filename = `platform-pulse-${filterKey}-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/tickets/:filterId', async (req, res) => {
  try {
    const { filterId } = req.params

    const filterResp = await fetch(`${JIRA_BASE}/filter/${filterId}`, {
      headers: { 'Authorization': authHeader }
    })
    if (!filterResp.ok) return res.status(400).json({ error: 'Filter not found' })
    const filterData = await filterResp.json()
    const jql = filterData.jql

    const searchResp = await fetch(`${JIRA_BASE}/search/jql`, {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jql: jql + ' ORDER BY created ASC',
        fields: ['summary', 'description', 'comment', 'status', 'created', 'reporter', 'assignee', 'priority', 'issuetype', 'labels'],
        maxResults: 100
      })
    })
    if (!searchResp.ok) {
      const err = await searchResp.text()
      return res.status(400).json({ error: `Search failed: ${err.slice(0, 200)}` })
    }
    const searchData = await searchResp.json()
    const issues = searchData.issues || []

    const keys = issues.map(i => i.key)
    let children = []
    if (keys.length > 0) {
      const childResp = await fetch(`${JIRA_BASE}/search/jql`, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jql: `parent in (${keys.join(',')}) OR "Epic Link" in (${keys.join(',')})`,
          fields: ['summary', 'status', 'parent', 'customfield_10014'],
          maxResults: 100
        })
      })
      if (childResp.ok) {
        const childData = await childResp.json()
        children = childData.issues || []
      }
    }

    const parentChildren = {}
    for (const child of children) {
      const pk = child.fields?.parent?.key || child.fields?.customfield_10014 || 'unknown'
      if (!parentChildren[pk]) parentChildren[pk] = []
      parentChildren[pk].push({
        key: child.key,
        summary: child.fields.summary,
        status: child.fields.status.name
      })
    }

    const today = new Date()
    const tickets = issues.map(issue => {
      const f = issue.fields
      const created = f.created.slice(0, 10)
      const createdDate = new Date(created)
      const daysPending = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24))

      const kids = parentChildren[issue.key] || []
      const totalChildren = kids.length
      const doneChildren = kids.filter(k => ['Done', 'Deployed'].includes(k.status)).length
      const closedChildren = kids.filter(k => ['Will Not Fix', 'Invalid', 'Duplicate', 'Not a Bug'].includes(k.status)).length
      const openChildren = kids.filter(k => ['To Do', 'In Progress', 'Ready For Development', 'Blocked'].includes(k.status)).length

      let reason, nextStep
      if (totalChildren === 0) {
        reason = 'No child tickets created — work never decomposed or scoped'
        nextStep = daysPending > 500 ? 'Close as Won\'t Do — if still relevant, create a new properly scoped epic' : 'Add child stories or assign to a quarter'
      } else if (doneChildren + closedChildren === totalChildren) {
        reason = 'All work complete but parent epic was never resolved'
        nextStep = 'Resolve this epic as Done immediately'
      } else if (closedChildren > doneChildren && closedChildren > openChildren) {
        reason = `Approach largely abandoned (${closedChildren}/${totalChildren} children closed as Won\'t Fix/Invalid)`
        nextStep = 'Close as Won\'t Do. Refile remaining open items independently if needed.'
      } else if (openChildren === totalChildren && daysPending > 500) {
        reason = `All ${openChildren} children remain open — no execution started in ${daysPending} days`
        nextStep = 'Assignee must justify keeping open within 1 week or close as stale'
      } else if (openChildren > 0 && doneChildren > 0) {
        reason = `Partially executed (${doneChildren} done, ${openChildren} still open)`
        nextStep = 'Review open children: assign to current quarter or close remaining'
      } else {
        reason = `Mixed state — ${doneChildren} done, ${closedChildren} closed, ${openChildren} open`
        nextStep = 'Assign to a specific quarter with clear ownership'
      }

      return {
        key: issue.key,
        summary: f.summary,
        status: f.status.name,
        created,
        daysPending,
        priority: f.priority?.name || 'P4',
        reporter: f.reporter?.displayName || 'Unknown',
        assignee: f.assignee?.displayName || 'Unassigned',
        description: extractText(f.description),
        reason,
        nextStep,
        lastComment: getLastComment(f.comment),
        totalChildren,
        doneChildren,
        closedChildren,
        openChildren,
        children: kids.slice(0, 10)
      }
    })

    tickets.sort((a, b) => b.daysPending - a.daysPending)
    res.json({ filter: filterData.name, jql, total: tickets.length, tickets })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`)
})
