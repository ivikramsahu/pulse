import { useState, useMemo, useEffect, createContext, useContext } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid, ScatterChart, Scatter, ZAxis } from 'recharts'
import './index.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const JIRA_BASE = 'https://harness.atlassian.net/browse'
const PAGE_SIZE = 20

const ThemeContext = createContext('dark')

const statusColors = {
  'To Do': { dark: 'bg-slate-600/30 text-slate-300 border-slate-500/40', light: 'bg-slate-200 text-slate-700 border-slate-300' },
  'In Progress': { dark: 'bg-blue-600/20 text-blue-300 border-blue-500/40', light: 'bg-blue-100 text-blue-700 border-blue-300' },
  'Done': { dark: 'bg-green-600/20 text-green-300 border-green-500/40', light: 'bg-green-100 text-green-700 border-green-300' },
  'Will Not Fix': { dark: 'bg-red-600/20 text-red-300 border-red-500/40', light: 'bg-red-100 text-red-700 border-red-300' },
  'Blocked': { dark: 'bg-orange-600/20 text-orange-300 border-orange-500/40', light: 'bg-orange-100 text-orange-700 border-orange-300' },
  'Deployed': { dark: 'bg-green-600/20 text-green-300 border-green-500/40', light: 'bg-green-100 text-green-700 border-green-300' },
  'Invalid': { dark: 'bg-red-600/20 text-red-300 border-red-500/40', light: 'bg-red-100 text-red-700 border-red-300' },
}

const priorityColors = { 'P1': 'text-red-400', 'P2': 'text-orange-400', 'P3': 'text-yellow-400', 'P4': 'text-slate-400' }

const CHART_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function DaysBar({ days }) {
  const pct = Math.min((days / 800) * 100, 100)
  const color = days > 600 ? 'bg-red-500' : days > 400 ? 'bg-orange-500' : days > 200 ? 'bg-yellow-500' : 'bg-green-500'
  const theme = useContext(ThemeContext)
  return (
    <div className={`w-full rounded-full h-1.5 mt-1 ${theme === 'dark' ? 'bg-slate-700/50' : 'bg-slate-200'}`}>
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  const theme = useContext(ThemeContext)
  const btnBase = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
  const btnActive = theme === 'dark' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-blue-600 border-blue-500 text-white'

  const pages = []
  const start = Math.max(1, currentPage - 2)
  const end = Math.min(totalPages, currentPage + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={`px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${btnBase}`}>Prev</button>
      {start > 1 && <><button onClick={() => onPageChange(1)} className={`px-3 py-1.5 rounded-lg border text-sm ${btnBase}`}>1</button>{start > 2 && <span className="text-slate-500">...</span>}</>}
      {pages.map(p => <button key={p} onClick={() => onPageChange(p)} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${p === currentPage ? btnActive : btnBase}`}>{p}</button>)}
      {end < totalPages && <>{end < totalPages - 1 && <span className="text-slate-500">...</span>}<button onClick={() => onPageChange(totalPages)} className={`px-3 py-1.5 rounded-lg border text-sm ${btnBase}`}>{totalPages}</button></>}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={`px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${btnBase}`}>Next</button>
      <span className={`text-xs ml-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Page {currentPage} of {totalPages}</span>
    </div>
  )
}

function ChartView({ tickets, groupBy, onTicketClick }) {
  const theme = useContext(ThemeContext)
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b'

  const ageBuckets = useMemo(() => {
    const buckets = { '0-100d': [], '100-300d': [], '300-500d': [], '500-700d': [], '700d+': [] }
    tickets.forEach(t => {
      if (t.daysPending > 700) buckets['700d+'].push(t)
      else if (t.daysPending > 500) buckets['500-700d'].push(t)
      else if (t.daysPending > 300) buckets['300-500d'].push(t)
      else if (t.daysPending > 100) buckets['100-300d'].push(t)
      else buckets['0-100d'].push(t)
    })
    return buckets
  }, [tickets])

  const ageDistribution = useMemo(() => {
    return Object.entries(ageBuckets).map(([name, items]) => ({ name, value: items.length }))
  }, [ageBuckets])

  const statusBuckets = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      if (!map[t.status]) map[t.status] = []
      map[t.status].push(t)
    })
    return map
  }, [tickets])

  const statusDistribution = useMemo(() => {
    return Object.entries(statusBuckets).map(([name, items]) => ({ name, value: items.length }))
  }, [statusBuckets])

  const reporterBuckets = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      if (!map[t.reporter]) map[t.reporter] = []
      map[t.reporter].push(t)
    })
    return map
  }, [tickets])

  const topReporters = useMemo(() => {
    return Object.entries(reporterBuckets).sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([name, items]) => ({ name: name.split(' ')[0], count: items.length, fullName: name }))
  }, [reporterBuckets])

  const handleAgeClick = (data) => {
    if (data?.activePayload?.[0]) {
      const bucket = data.activePayload[0].payload.name
      const items = ageBuckets[bucket]
      if (items?.length) onTicketClick(items[0])
    }
  }

  const handleStatusClick = (_, idx) => {
    const entry = statusDistribution[idx]
    if (entry) {
      const items = statusBuckets[entry.name]
      if (items?.length) onTicketClick(items[0])
    }
  }

  const handleReporterClick = (data) => {
    if (data?.activePayload?.[0]) {
      const fullName = data.activePayload[0].payload.fullName
      const items = reporterBuckets[fullName]
      if (items?.length) onTicketClick(items[0])
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className={`rounded-xl p-5 border ${theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Age Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ageDistribution} onClick={handleAgeClick} style={{ cursor: 'pointer' }}>
            <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} />
            <YAxis tick={{ fill: textColor, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} />
            <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Click a bar to view a ticket in that range</p>
      </div>

      <div className={`rounded-xl p-5 border ${theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Status Breakdown</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false} fontSize={10} onClick={handleStatusClick} style={{ cursor: 'pointer' }}>
              {statusDistribution.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Click a slice to view a ticket with that status</p>
      </div>

      <div className={`rounded-xl p-5 border md:col-span-2 ${theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
        <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Top Reporters (by ticket count)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={topReporters} layout="vertical" onClick={handleReporterClick} style={{ cursor: 'pointer' }}>
            <XAxis type="number" tick={{ fill: textColor, fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={100} tick={{ fill: textColor, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, name, props) => [val, props.payload.fullName]} />
            <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Click a bar to view a ticket from that reporter</p>
      </div>
    </div>
  )
}

function TicketDetail({ ticket, onClose }) {
  const theme = useContext(ThemeContext)
  const bg = theme === 'dark' ? 'bg-[#1a1d2e]' : 'bg-white'
  const border = theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
  const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const textSub = theme === 'dark' ? 'text-slate-300' : 'text-slate-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className={`${bg} border ${border} rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className={`sticky top-0 ${bg} border-b ${border} p-6 flex items-start justify-between rounded-t-2xl`}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <a href={`${JIRA_BASE}/${ticket.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 font-semibold text-lg">{ticket.key}</a>
              <StatusBadge status={ticket.status} />
              <span className={`text-sm font-medium ${priorityColors[ticket.priority] || 'text-slate-400'}`}>{ticket.priority}</span>
            </div>
            <h2 className={`text-xl font-semibold ${textMain}`}>{ticket.summary}</h2>
          </div>
          <button onClick={onClose} className={`${textSub} hover:${textMain} text-2xl leading-none p-2 hover:bg-slate-700/30 rounded-lg transition-colors`}>&times;</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetaBox label="Days Pending" value={ticket.daysPending} extra={<DaysBar days={ticket.daysPending} />} />
            <MetaBox label="Reporter" value={ticket.reporter} />
            <MetaBox label="Assignee" value={ticket.assignee} />
            <MetaBox label="Created" value={ticket.created} />
          </div>

          <DetailSection title="What is this ticket about?" color="slate">
            <div className={`${textSub} leading-relaxed space-y-2`}>
              {ticket.description.split(' | ').map((para, i) => <p key={i}>{para}</p>)}
            </div>
          </DetailSection>

          <DetailSection title="Why is it still open?" color="amber">
            <p className={`${textSub} leading-relaxed`}>{ticket.reason}</p>
          </DetailSection>

          <DetailSection title="Recommended Next Step" color="emerald">
            <p className={`${textSub} leading-relaxed font-medium`}>{ticket.nextStep}</p>
          </DetailSection>

          <DetailSection title="Who to ask" color="blue">
            <div className="flex gap-6">
              <div><span className="text-xs text-slate-500">Assignee:</span><p className={`${textMain} font-medium`}>{ticket.assignee}</p></div>
              <div><span className="text-xs text-slate-500">Reporter:</span><p className={`${textMain} font-medium`}>{ticket.reporter}</p></div>
            </div>
          </DetailSection>

          {ticket.children?.length > 0 && (
            <div>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${textSub}`}>
                Child Tickets ({ticket.doneChildren} done / {ticket.closedChildren} closed / {ticket.openChildren} open)
              </h3>
              <div className="space-y-2">
                {ticket.children.map(child => (
                  <div key={child.key} className={`flex items-center justify-between ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-200'} rounded-lg px-4 py-2 border`}>
                    <div className="flex items-center gap-3">
                      <a href={`${JIRA_BASE}/${child.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 text-sm font-mono">{child.key}</a>
                      <span className={`text-sm ${textSub} truncate max-w-[300px]`}>{child.summary}</span>
                    </div>
                    <StatusBadge status={child.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.lastComment && ticket.lastComment !== 'No comments' && (
            <DetailSection title="Last Comment" color="slate">
              <p className={`${textSub} text-sm italic`}>{ticket.lastComment}</p>
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const theme = useContext(ThemeContext)
  const cls = statusColors[status]?.[theme] || (theme === 'dark' ? 'bg-slate-600/30 text-slate-300 border-slate-500/40' : 'bg-slate-200 text-slate-700 border-slate-300')
  return <span className={`px-2 py-0.5 rounded-md text-xs border whitespace-nowrap ${cls}`}>{status}</span>
}

function MetaBox({ label, value, extra }) {
  const theme = useContext(ThemeContext)
  return (
    <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-200'}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-sm mt-1 font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      {extra}
    </div>
  )
}

function DetailSection({ title, color, children }) {
  const theme = useContext(ThemeContext)
  const colors = {
    slate: theme === 'dark' ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-slate-200',
    amber: theme === 'dark' ? 'bg-amber-950/30 border-amber-700/30' : 'bg-amber-50 border-amber-200',
    emerald: theme === 'dark' ? 'bg-emerald-950/30 border-emerald-700/30' : 'bg-emerald-50 border-emerald-200',
    blue: theme === 'dark' ? 'bg-blue-950/30 border-blue-700/30' : 'bg-blue-50 border-blue-200',
  }
  const titleColors = { slate: 'text-slate-400', amber: 'text-amber-500', emerald: 'text-emerald-500', blue: 'text-blue-500' }
  return (
    <div className={`rounded-xl p-5 border ${colors[color]}`}>
      <h3 className={`text-sm font-semibold uppercase tracking-wide mb-2 ${titleColors[color]}`}>{title}</h3>
      {children}
    </div>
  )
}

function TicketRow({ ticket, onClick }) {
  const theme = useContext(ThemeContext)
  return (
    <tr className={`border-b cursor-pointer transition-colors group ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-blue-50/50'}`} onClick={() => onClick(ticket)}>
      <td className="px-4 py-3">
        <a href={`${JIRA_BASE}/${ticket.key}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-400 font-mono text-sm">{ticket.key}</a>
      </td>
      <td className="px-4 py-3">
        <div className={`text-sm max-w-xs truncate ${theme === 'dark' ? 'text-white group-hover:text-blue-200' : 'text-slate-800 group-hover:text-blue-600'} transition-colors`}>{ticket.summary}</div>
      </td>
      <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
      <td className="px-4 py-3 text-right">
        <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{ticket.daysPending}d</div>
        <DaysBar days={ticket.daysPending} />
      </td>
      <td className="px-4 py-3"><span className={`text-sm font-medium ${priorityColors[ticket.priority] || 'text-slate-400'}`}>{ticket.priority}</span></td>
      <td className={`px-4 py-3 text-sm max-w-[120px] truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{ticket.reporter}</td>
      <td className={`px-4 py-3 text-sm max-w-[120px] truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{ticket.assignee}</td>
    </tr>
  )
}

function TicketTable({ tickets, onTicketClick }) {
  const theme = useContext(ThemeContext)
  return (
    <div className={`rounded-xl overflow-hidden border ${theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={`border-b ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
              {['Key', 'Summary', 'Status', 'Age', 'Priority', 'Reporter', 'Assignee'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs uppercase tracking-wide font-medium ${h === 'Age' ? 'text-right' : ''} ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => <TicketRow key={ticket.key} ticket={ticket} onClick={onTicketClick} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatsCard({ label, value, color }) {
  const theme = useContext(ThemeContext)
  return (
    <div className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className={`text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color || (theme === 'dark' ? 'text-white' : 'text-slate-900')}`}>{value}</div>
    </div>
  )
}

function TabSwitcher({ activeTab, onTabChange }) {
  const theme = useContext(ThemeContext)
  const tabs = [{ id: 'data', label: 'Data' }, { id: 'chart', label: 'Graph' }]
  return (
    <div className={`inline-flex rounded-lg p-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
            ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 shadow-sm')
            : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')
          }`}
        >{tab.label}</button>
      ))}
    </div>
  )
}

const actionColors = {
  'Closed as Done': { dark: 'bg-green-600/20 text-green-300 border-green-500/40', light: 'bg-green-100 text-green-700 border-green-300' },
  'Closed as Will Not Fix': { dark: 'bg-red-600/20 text-red-300 border-red-500/40', light: 'bg-red-100 text-red-700 border-red-300' },
  'Requested closure': { dark: 'bg-amber-600/20 text-amber-300 border-amber-500/40', light: 'bg-amber-100 text-amber-700 border-amber-300' },
  'Requested update/closure': { dark: 'bg-amber-600/20 text-amber-300 border-amber-500/40', light: 'bg-amber-100 text-amber-700 border-amber-300' },
  'Pending closure': { dark: 'bg-blue-600/20 text-blue-300 border-blue-500/40', light: 'bg-blue-100 text-blue-700 border-blue-300' },
  'Pending closure (1 week deadline)': { dark: 'bg-blue-600/20 text-blue-300 border-blue-500/40', light: 'bg-blue-100 text-blue-700 border-blue-300' },
}

function ClosuresPage() {
  const theme = useContext(ThemeContext)
  const [closures, setClosures] = useState([])
  const [liveTickets, setLiveTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/closures`).then(r => r.json()),
      fetch(`${API_BASE}/closures/live`).then(r => r.json())
    ]).then(([manual, live]) => {
      setClosures(manual)
      setLiveTickets(live.tickets || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
  const cardBg = theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'

  const ourActions = liveTickets.filter(t => t.commentedByUs)
  const totalResolved = liveTickets.length

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className={textSub}>Loading closure data...</p>
    </div>
  )

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <div className={`text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Original Count</div>
          <div className={`text-2xl font-bold mt-1 ${textMain}`}>378</div>
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <div className={`text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Total Resolved</div>
          <div className="text-2xl font-bold mt-1 text-green-400">{totalResolved}</div>
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <div className={`text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Our Direct Actions</div>
          <div className="text-2xl font-bold mt-1 text-blue-400">{ourActions.length}</div>
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <div className={`text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Detailed Analysis</div>
          <div className="text-2xl font-bold mt-1 text-amber-400">{closures.length}</div>
        </div>
        <div className={`rounded-xl p-4 border ${cardBg}`}>
          <div className={`text-xs uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Reduction</div>
          <div className="text-2xl font-bold mt-1 text-emerald-400">{totalResolved > 0 ? Math.round((totalResolved / 378) * 100) : 0}%</div>
        </div>
      </div>

      <div className={`inline-flex rounded-lg p-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {[{ id: 'all', label: `All Resolved (${totalResolved})` }, { id: 'ours', label: `Our Actions (${closures.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 shadow-sm') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'all' && (
        <div className={`rounded-xl overflow-hidden border ${cardBg}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                  {['Ticket', 'Summary', 'Reporter', 'Assignee', 'Resolution', 'Resolved', 'Our Comment'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs uppercase tracking-wide font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveTickets.map(t => (
                  <tr key={t.key} className={`border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-blue-50/50'} transition-colors`}>
                    <td className="px-4 py-3">
                      <a href={`${JIRA_BASE}/${t.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 font-mono text-sm">{t.key}</a>
                    </td>
                    <td className={`px-4 py-3 text-sm max-w-[200px] truncate ${textMain}`}>{t.summary}</td>
                    <td className={`px-4 py-3 text-sm ${textSub}`}>{t.reporter}</td>
                    <td className={`px-4 py-3 text-sm ${textSub}`}>{t.assignee}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.resolution} /></td>
                    <td className={`px-4 py-3 text-sm ${textSub}`}>{t.resolved}</td>
                    <td className="px-4 py-3">
                      {t.commentedByUs
                        ? <span className={`px-2 py-0.5 rounded-md text-xs border ${theme === 'dark' ? 'bg-green-600/20 text-green-300 border-green-500/40' : 'bg-green-100 text-green-700 border-green-300'}`}>Yes</span>
                        : <span className={`px-2 py-0.5 rounded-md text-xs border ${theme === 'dark' ? 'bg-slate-600/30 text-slate-400 border-slate-500/40' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>No</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ours' && (
        <>
          <div className={`rounded-xl overflow-hidden border ${cardBg}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b ${theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                    {['Ticket', 'Summary', 'Reporter', 'Previous Status', 'Current Status', 'Action', 'How Closed'].map(h => (
                      <th key={h} className={`px-4 py-3 text-xs uppercase tracking-wide font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closures.map(c => (
                    <tr key={c.key} className={`border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-blue-50/50'} transition-colors`}>
                      <td className="px-4 py-3">
                        <a href={`${JIRA_BASE}/${c.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 font-mono text-sm">{c.key}</a>
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-[200px] truncate ${textMain}`}>{c.summary}</td>
                      <td className={`px-4 py-3 text-sm ${textSub}`}>{c.reporter}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.previousStatus} /></td>
                      <td className="px-4 py-3"><StatusBadge status={c.currentStatus} /></td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-xs border whitespace-nowrap ${actionColors[c.action]?.[theme] || (theme === 'dark' ? 'bg-slate-600/30 text-slate-300 border-slate-500/40' : 'bg-slate-200 text-slate-700 border-slate-300')}`}>{c.action}</span>
                      </td>
                      <td className={`px-4 py-3 text-sm max-w-[180px] ${textSub}`}>{c.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className={`text-lg font-semibold ${textMain}`}>Closure Details</h2>
            {closures.map(c => (
              <div key={c.key} className={`rounded-xl p-5 border ${cardBg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <a href={`${JIRA_BASE}/${c.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 font-mono font-semibold">{c.key}</a>
                  <span className={`px-2 py-0.5 rounded-md text-xs border whitespace-nowrap ${actionColors[c.action]?.[theme] || (theme === 'dark' ? 'bg-slate-600/30 text-slate-300 border-slate-500/40' : 'bg-slate-200 text-slate-700 border-slate-300')}`}>{c.action}</span>
                  <span className={`text-xs ${textSub}`}>{c.date}</span>
                </div>
                <h3 className={`text-sm font-medium mb-2 ${textMain}`}>{c.summary}</h3>
                <div className={`text-sm leading-relaxed ${textSub}`}>
                  <span className={`font-medium ${textMain}`}>Why: </span>{c.reason}
                </div>
                <div className={`text-sm mt-2 ${textSub}`}>
                  <span className={`font-medium ${textMain}`}>Method: </span>{c.method}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// --- Leaderboard Page ---

const LEADERBOARD_CATEGORIES = [
  { key: 'cfd', label: 'CFD', enabled: true },
  { key: 'prod', label: 'PROD', enabled: true },
  { key: 'regression', label: 'Regressions', enabled: false },
  { key: 'ifd', label: 'IFD', enabled: false },
  { key: 'rca', label: 'RCA', enabled: false },
  { key: 'vulnerability', label: 'Vulnerability', enabled: false },
  { key: 'depend', label: 'Depend', enabled: false },
  { key: 'quarterly', label: 'Q Planning', enabled: false },
]

const findingStyles = {
  critical: { dark: 'bg-red-900/40 border-red-500/50 text-red-300', light: 'bg-red-50 border-red-300 text-red-700', icon: '!!' },
  warning: { dark: 'bg-amber-900/30 border-amber-500/40 text-amber-300', light: 'bg-amber-50 border-amber-300 text-amber-700', icon: '!' },
  action: { dark: 'bg-emerald-900/30 border-emerald-500/40 text-emerald-300', light: 'bg-emerald-50 border-emerald-300 text-emerald-700', icon: '>' },
  impact: { dark: 'bg-purple-900/30 border-purple-500/40 text-purple-300', light: 'bg-purple-50 border-purple-300 text-purple-700', icon: '*' },
  info: { dark: 'bg-slate-800/40 border-slate-600/40 text-slate-400', light: 'bg-slate-50 border-slate-300 text-slate-500', icon: 'i' },
  ok: { dark: 'bg-green-900/20 border-green-600/30 text-green-400', light: 'bg-green-50 border-green-300 text-green-600', icon: '+' },
}

const riskColors = {
  critical: { dark: 'bg-red-500/20 text-red-400 border-red-500/40', light: 'bg-red-100 text-red-700 border-red-300' },
  high: { dark: 'bg-orange-500/20 text-orange-400 border-orange-500/40', light: 'bg-orange-100 text-orange-700 border-orange-300' },
  medium: { dark: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', light: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  low: { dark: 'bg-green-500/20 text-green-400 border-green-500/40', light: 'bg-green-100 text-green-700 border-green-300' },
}

function LeaderboardPage() {
  const theme = useContext(ThemeContext)
  const [activeFilter, setActiveFilter] = useState('cfd')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [expandedTicket, setExpandedTicket] = useState(null)
  const [customerFilter, setCustomerFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [reporterFilter, setReporterFilter] = useState('')
  const [sprintFilter, setSprintFilter] = useState('')
  const [search, setSearch] = useState('')

  const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
  const cardBg = theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
  const inputCls = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  const selectCls = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'

  const fetchData = (filterKey) => {
    setLoading(true)
    fetch(`${API_BASE}/leaderboard/${filterKey}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setData(null); setLoading(false); return }
        setData(d)
        setLastRefresh(new Date())
        setLoading(false)
      })
      .catch(() => { setData(null); setLoading(false) })
  }

  useEffect(() => {
    fetchData(activeFilter)
  }, [activeFilter])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(activeFilter)
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [activeFilter])

  const filteredTickets = useMemo(() => {
    if (!data?.tickets) return []
    let result = [...data.tickets]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t => t.key.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q) || t.reporter.toLowerCase().includes(q))
    }
    if (customerFilter) result = result.filter(t => t.customers.includes(customerFilter))
    if (assigneeFilter) result = result.filter(t => t.assignee === assigneeFilter)
    if (reporterFilter) result = result.filter(t => t.reporter === reporterFilter)
    if (sprintFilter) result = result.filter(t => t.sprints.includes(sprintFilter))
    return result
  }, [data, search, customerFilter, assigneeFilter, reporterFilter, sprintFilter])

  // --- Leaderboard stats ---
  const stats = useMemo(() => {
    if (!filteredTickets.length) return null
    const byAssignee = {}
    const byCustomer = {}
    let totalAge = 0
    let slaBreached = 0
    let highSev = 0
    let inProgress = 0

    filteredTickets.forEach(t => {
      byAssignee[t.assignee] = (byAssignee[t.assignee] || 0) + 1
      t.customers.forEach(c => { byCustomer[c] = (byCustomer[c] || 0) + 1 })
      totalAge += t.daysPending
      if (t.severity === 'S0' || t.severity === 'S1') highSev++
      if (t.status === 'In Progress') inProgress++
      if ((t.severity === 'S0' || t.severity === 'S1') && t.daysPending > 14) slaBreached++
      else if (t.severity === 'S2' && t.daysPending > 42) slaBreached++
    })

    const topAssignees = Object.entries(byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
    const topCustomers = Object.entries(byCustomer).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

    return {
      total: filteredTickets.length,
      avgAge: Math.round(totalAge / filteredTickets.length),
      highSev,
      slaBreached,
      inProgress,
      topAssignees,
      topCustomers
    }
  }, [filteredTickets])

  // Charts data
  const assigneeChart = useMemo(() => stats?.topAssignees?.map(a => ({ name: a.name.split(' ')[0], count: a.count, fullName: a.name })) || [], [stats])
  const customerChart = useMemo(() => stats?.topCustomers?.map(c => ({ name: c.name.length > 15 ? c.name.slice(0, 13) + '..' : c.name, count: c.count, fullName: c.name })) || [], [stats])

  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b'

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className={textSub}>Loading leaderboard data...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Category filter pills */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {LEADERBOARD_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => cat.enabled && setActiveFilter(cat.key)}
              disabled={!cat.enabled}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                activeFilter === cat.key
                  ? (theme === 'dark' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' : 'bg-blue-600 text-white border-blue-500')
                  : cat.enabled
                    ? (theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700 hover:border-blue-500/50 hover:text-blue-300' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400')
                    : (theme === 'dark' ? 'bg-slate-900/50 text-slate-600 border-slate-800 cursor-not-allowed opacity-50' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50')
              }`}
            >
              {cat.label}
              {!cat.enabled && <span className="ml-1 text-[9px] opacity-60">(soon)</span>}
            </button>
          ))}
        </div>
        <div className={`flex items-center gap-3 text-xs ${textSub}`}>
          <button
            onClick={() => { window.open(`${API_BASE}/leaderboard/${activeFilter}/export`, '_blank') }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${theme === 'dark' ? 'bg-emerald-900/30 border-emerald-600/40 text-emerald-400 hover:bg-emerald-900/50' : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'}`}
          >
            <span>&#8595;</span> Export XLS
          </button>
          <span className={`inline-block w-2 h-2 rounded-full ${theme === 'dark' ? 'bg-green-500' : 'bg-green-500'} animate-pulse`}></span>
          Live {lastRefresh && `(${lastRefresh.toLocaleTimeString()})`}
          <span className="opacity-50">| Refreshes every 5m</span>
        </div>
      </div>

      {!data ? (
        <div className={`rounded-xl p-8 border text-center ${cardBg}`}>
          <p className={textSub}>This category is not yet enabled. Coming soon.</p>
        </div>
      ) : (
        <>
          {/* KPI Strip */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className={`rounded-xl p-4 border ${cardBg}`}>
                <div className={`text-[10px] uppercase tracking-wider ${textSub}`}>Total Open</div>
                <div className={`text-2xl font-bold mt-1 ${textMain}`}>{stats.total}</div>
              </div>
              <div className={`rounded-xl p-4 border ${cardBg}`}>
                <div className={`text-[10px] uppercase tracking-wider ${textSub}`}>Avg Age</div>
                <div className={`text-2xl font-bold mt-1 ${stats.avgAge > 60 ? 'text-red-400' : stats.avgAge > 30 ? 'text-amber-400' : 'text-green-400'}`}>{stats.avgAge}d</div>
              </div>
              <div className={`rounded-xl p-4 border ${cardBg}`}>
                <div className={`text-[10px] uppercase tracking-wider ${textSub}`}>S0/S1 Open</div>
                <div className="text-2xl font-bold mt-1 text-red-400">{stats.highSev}</div>
              </div>
              <div className={`rounded-xl p-4 border ${cardBg}`}>
                <div className={`text-[10px] uppercase tracking-wider ${textSub}`}>SLA Breached</div>
                <div className="text-2xl font-bold mt-1 text-orange-400">{stats.slaBreached}</div>
              </div>
              <div className={`rounded-xl p-4 border ${cardBg}`}>
                <div className={`text-[10px] uppercase tracking-wider ${textSub}`}>In Progress</div>
                <div className="text-2xl font-bold mt-1 text-blue-400">{stats.inProgress}</div>
              </div>
            </div>
          )}

          {/* Filters — prominent position */}
          <div className={`rounded-xl p-4 border ${cardBg}`}>
            <div className="flex flex-wrap items-center gap-3">
              <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className={`border rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:border-blue-500 ${inputCls}`} />
              <select value={customerFilter} onChange={e => setCustomerFilter(e.target.value)} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                <option value="">All Customers</option>
                {(data.filters?.customers || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                <option value="">All Assignees</option>
                {(data.filters?.assignees || []).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={reporterFilter} onChange={e => setReporterFilter(e.target.value)} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                <option value="">All Reporters</option>
                {(data.filters?.reporters || []).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={sprintFilter} onChange={e => setSprintFilter(e.target.value)} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                <option value="">All Sprints</option>
                {(data.filters?.sprints || []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(customerFilter || assigneeFilter || reporterFilter || sprintFilter || search) && (
                <button onClick={() => { setCustomerFilter(''); setAssigneeFilter(''); setReporterFilter(''); setSprintFilter(''); setSearch('') }} className={`text-xs px-3 py-2 rounded-lg border transition-colors ${theme === 'dark' ? 'border-red-700 text-red-400 hover:bg-red-900/30' : 'border-red-300 text-red-600 hover:bg-red-50'}`}>
                  Clear Filters
                </button>
              )}
              <span className={`ml-auto text-xs ${textSub}`}>{filteredTickets.length} of {data.total} tickets</span>
            </div>
          </div>

          {/* Charts: Assignee and Customer leaderboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Assignee Leaderboard</h3>
              <ResponsiveContainer width="100%" height={Math.max(180, assigneeChart.length * 28)}>
                <BarChart data={assigneeChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: textColor, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, _, props) => [val, props.payload.fullName]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Open Bugs">
                    {assigneeChart.map((_, idx) => <Cell key={idx} fill={idx === 0 ? '#ef4444' : idx < 3 ? '#f59e0b' : '#3b82f6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Customer Impact Leaderboard</h3>
              <ResponsiveContainer width="100%" height={Math.max(180, customerChart.length * 28)}>
                <BarChart data={customerChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: textColor, fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, _, props) => [val, props.payload.fullName]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Bugs Filed">
                    {customerChart.map((_, idx) => <Cell key={idx} fill={idx === 0 ? '#dc2626' : idx < 3 ? '#ea580c' : '#8b5cf6'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ticket cards */}
          <div className="space-y-3">
            {filteredTickets.map(ticket => (
              <LeaderboardTicketCard
                key={ticket.key}
                ticket={ticket}
                expanded={expandedTicket === ticket.key}
                onToggle={() => setExpandedTicket(expandedTicket === ticket.key ? null : ticket.key)}
              />
            ))}
            {filteredTickets.length === 0 && (
              <div className={`rounded-xl p-8 border text-center ${cardBg}`}>
                <p className={textSub}>No tickets match the current filters.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function LeaderboardTicketCard({ ticket, expanded, onToggle }) {
  const theme = useContext(ThemeContext)
  const cardBg = theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
  const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500'

  const severityColor = {
    S0: 'text-red-500 bg-red-500/10 border-red-500/30',
    S1: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    S2: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
    S3: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    S4: 'text-slate-400 bg-slate-400/10 border-slate-400/30',
  }

  const childProgress = ticket.children.total > 0
    ? Math.round(((ticket.children.done + ticket.children.closed) / ticket.children.total) * 100)
    : null

  return (
    <div className={`rounded-xl border transition-all ${cardBg} ${expanded ? 'ring-1 ring-blue-500/30' : ''}`}>
      {/* Collapsed row */}
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={onToggle}>
        {/* Severity badge */}
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-bold shrink-0 ${severityColor[ticket.severity] || (theme === 'dark' ? 'text-slate-500 bg-slate-800/50 border-slate-700' : 'text-slate-400 bg-slate-100 border-slate-200')}`}>
          {ticket.severity || '—'}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <a href={`${JIRA_BASE}/${ticket.key}`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-400 font-mono text-sm font-semibold">{ticket.key}</a>
            <StatusBadge status={ticket.status} />
            <span className={`text-xs font-medium ${priorityColors[ticket.priority] || 'text-slate-400'}`}>{ticket.priority}</span>
            {ticket.daysPending > 90 && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${theme === 'dark' ? 'bg-red-900/30 border-red-700/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>{ticket.daysPending}d old</span>}
          </div>
          <p className={`text-sm mt-0.5 truncate ${textMain}`}>{ticket.summary}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-xs ${textSub}`}>{ticket.assignee}</span>
            {ticket.customers.length > 0 && <span className={`text-xs ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>{ticket.customers.length} customer{ticket.customers.length > 1 ? 's' : ''}</span>}
            {ticket.children.total > 0 && <span className={`text-xs ${textSub}`}>{ticket.children.done}/{ticket.children.total} done</span>}
          </div>
        </div>

        {/* Right side: risk level + AI summary + expand arrow */}
        <div className="flex items-center gap-3 shrink-0">
          {ticket.analysis && (
            <>
              <span className={`text-[10px] px-2 py-1 rounded border font-bold uppercase hidden md:inline-block ${riskColors[ticket.analysis.riskLevel]?.[theme] || ''}`}>
                {ticket.analysis.riskLevel}
              </span>
              <span className={`text-xs px-2 py-1 rounded border max-w-[250px] truncate hidden lg:inline-block ${findingStyles[ticket.analysis.findings?.[0]?.type]?.[theme] || ''}`}>
                {ticket.analysis.summary}
              </span>
            </>
          )}
          <span className={`text-lg transition-transform ${expanded ? 'rotate-180' : ''} ${textSub}`}>&#9662;</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`border-t px-5 pb-5 pt-4 space-y-4 ${theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'}`}>
          {/* AI Analysis */}
          {ticket.analysis && (
            <div className={`rounded-xl border p-4 space-y-3 ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border uppercase ${riskColors[ticket.analysis.riskLevel]?.[theme] || ''}`}>{ticket.analysis.riskLevel} risk</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${ticket.analysis.slaStatus === 'breached' ? (theme === 'dark' ? 'bg-red-900/30 border-red-500/40 text-red-400' : 'bg-red-50 border-red-200 text-red-600') : ticket.analysis.slaStatus === 'at-risk' ? (theme === 'dark' ? 'bg-amber-900/30 border-amber-500/40 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-600') : (theme === 'dark' ? 'bg-green-900/20 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-600')}`}>SLA: {ticket.analysis.slaStatus}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${ticket.analysis.businessImpact === 'critical' ? (theme === 'dark' ? 'bg-purple-900/30 border-purple-500/40 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-600') : ticket.analysis.businessImpact === 'high' ? (theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-500') : (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500')}`}>Impact: {ticket.analysis.businessImpact}</span>
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-semibold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>AI Analysis</span>
              </div>

              {/* Executive Summary */}
              <div className={`text-sm font-medium leading-relaxed ${textMain}`}>
                {ticket.analysis.summary}
              </div>

              {/* Findings */}
              {ticket.analysis.findings?.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className={`text-[10px] uppercase tracking-wider font-semibold ${textSub}`}>Key Findings</h5>
                  {ticket.analysis.findings.map((f, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-lg border ${findingStyles[f.type]?.[theme] || ''}`}>
                      <span className={`font-bold mr-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>[{f.category}]</span> {f.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Items */}
              {ticket.analysis.actionItems?.length > 0 && (
                <div>
                  <h5 className={`text-[10px] uppercase tracking-wider font-semibold mb-1.5 ${theme === 'dark' ? 'text-emerald-500' : 'text-emerald-600'}`}>Recommended Actions</h5>
                  <ul className="space-y-1">
                    {ticket.analysis.actionItems.map((item, i) => (
                      <li key={i} className={`text-xs flex items-start gap-2 ${textMain}`}>
                        <span className="text-emerald-500 mt-0.5 shrink-0">&#8250;</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-200'}`}>
              <div className={`text-[10px] uppercase tracking-wide ${textSub}`}>Reporter</div>
              <div className={`text-sm mt-0.5 font-medium ${textMain}`}>{ticket.reporter}</div>
            </div>
            <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-200'}`}>
              <div className={`text-[10px] uppercase tracking-wide ${textSub}`}>Assignee</div>
              <div className={`text-sm mt-0.5 font-medium ${textMain}`}>{ticket.assignee}</div>
            </div>
            <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-200'}`}>
              <div className={`text-[10px] uppercase tracking-wide ${textSub}`}>Created</div>
              <div className={`text-sm mt-0.5 font-medium ${textMain}`}>{ticket.created} ({ticket.daysPending}d ago)</div>
            </div>
            <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50 border border-slate-200'}`}>
              <div className={`text-[10px] uppercase tracking-wide ${textSub}`}>Last Updated</div>
              <div className={`text-sm mt-0.5 font-medium ${textMain}`}>{ticket.updated}</div>
            </div>
          </div>

          {/* Customers */}
          {ticket.customers.length > 0 && (
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Impacted Customers ({ticket.customers.length})</h4>
              <div className="flex flex-wrap gap-1.5">
                {ticket.customers.map(c => (
                  <span key={c} className={`text-xs px-2 py-1 rounded-md border ${theme === 'dark' ? 'bg-purple-900/20 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700'}`}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Components & Sprints */}
          <div className="flex flex-wrap gap-4">
            {ticket.components.length > 0 && (
              <div>
                <span className={`text-[10px] uppercase tracking-wide ${textSub}`}>Components: </span>
                {ticket.components.map(c => (
                  <span key={c} className={`text-xs mr-1 px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{c}</span>
                ))}
              </div>
            )}
            {ticket.sprints.length > 0 && (
              <div>
                <span className={`text-[10px] uppercase tracking-wide ${textSub}`}>Sprint: </span>
                <span className={`text-xs ${textMain}`}>{ticket.sprints[ticket.sprints.length - 1]}</span>
              </div>
            )}
          </div>

          {/* Child tickets */}
          {ticket.children.total > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-xs font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                  Child Tickets ({ticket.children.done} done, {ticket.children.open} open, {ticket.children.closed} closed)
                </h4>
                {childProgress !== null && (
                  <div className="flex items-center gap-2">
                    <div className={`w-24 h-2 rounded-full ${theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`}>
                      <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${childProgress}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${childProgress === 100 ? 'text-green-400' : textSub}`}>{childProgress}%</span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {ticket.children.items.map(child => (
                  <div key={child.key} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${theme === 'dark' ? 'bg-slate-800/40 border-slate-700/40' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <a href={`${JIRA_BASE}/${child.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 font-mono text-xs shrink-0">{child.key}</a>
                      <span className={`text-xs truncate ${textMain}`}>{child.summary}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] ${textSub}`}>{child.assignee}</span>
                      <StatusBadge status={child.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last comment */}
          {ticket.lastComment && ticket.lastComment !== 'No comments' && (
            <div className={`rounded-lg p-3 border ${theme === 'dark' ? 'bg-slate-800/30 border-slate-700/40' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className={`text-[10px] uppercase tracking-wide mb-1 ${textSub}`}>Last Comment</h4>
              <p className={`text-xs ${textSub} italic`}>{ticket.lastComment}</p>
            </div>
          )}

          {/* Description */}
          {ticket.description && ticket.description !== 'No description provided' && (
            <details className="group">
              <summary className={`text-xs cursor-pointer ${textSub} hover:${textMain}`}>View Description</summary>
              <div className={`mt-2 text-xs leading-relaxed ${textSub} max-h-[150px] overflow-y-auto`}>
                {ticket.description.split(' | ').map((p, i) => <p key={i} className="mb-1">{p}</p>)}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

const ANALYSIS_QUERIES = {
  openCfds: 'Platform All Open CFDs',
  cfdsTrend: 'Platform-All-CFDs-Trend (180d)',
  breachedSla: 'Platform-Open-CFDs-BreachedSLA',
  allOpenProd: 'Platform-All-OPEN-Prod',
  prodTrend: 'Platform-PROD-All-Trend (180d)',
  prodLast2Wks: 'Platform-PROD-Created-Last2Wks',
  missingSeverity: 'Platform Missing Severity'
}

function AnalysisPage() {
  const theme = useContext(ThemeContext)
  const [queryData, setQueryData] = useState({})
  const [loading, setLoading] = useState(true)
  const [activeQuery, setActiveQuery] = useState('openCfds')
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const textSub = theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
  const cardBg = theme === 'dark' ? 'bg-[#1a1d2e] border-slate-700/50' : 'bg-white border-slate-200 shadow-sm'
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b'

  useEffect(() => {
    fetch(`${API_BASE}/analysis`).then(r => r.json()).then(data => {
      setQueryData(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!activeQuery) return
    setDetailLoading(true)
    fetch(`${API_BASE}/analysis/${activeQuery}`).then(r => r.json()).then(data => {
      setDetailData(data)
      setDetailLoading(false)
    }).catch(() => setDetailLoading(false))
  }, [activeQuery])

  const tickets = detailData?.tickets || []

  // --- Computed chart data ---

  const byAssignee = useMemo(() => {
    const map = {}
    tickets.forEach(t => { map[t.assignee] = (map[t.assignee] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name: name.split(' ')[0] + (name.split(' ')[1] ? ' ' + name.split(' ')[1][0] + '.' : ''), count, fullName: name }))
  }, [tickets])

  const byReporter = useMemo(() => {
    const map = {}
    tickets.forEach(t => { map[t.reporter] = (map[t.reporter] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name: name.split(' ')[0] + (name.split(' ')[1] ? ' ' + name.split(' ')[1][0] + '.' : ''), count, fullName: name }))
  }, [tickets])

  const byStatus = useMemo(() => {
    const map = {}
    tickets.forEach(t => { map[t.status] = (map[t.status] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [tickets])

  const byPriority = useMemo(() => {
    const map = {}
    tickets.forEach(t => { map[t.priority] = (map[t.priority] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [tickets])

  const bySeverity = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      const sev = t.severity || 'Unset'
      map[sev] = (map[sev] || 0) + 1
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [tickets])

  const byComponent = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      if (t.components.length === 0) map['No Component'] = (map['No Component'] || 0) + 1
      else t.components.forEach(c => { map[c] = (map[c] || 0) + 1 })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name, value }))
  }, [tickets])

  const byCustomer = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      t.customers.forEach(c => { map[c] = (map[c] || 0) + 1 })
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 18) + '..' : name, count, fullName: name }))
  }, [tickets])

  const createdOverTime = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      const month = t.created.slice(0, 7)
      map[month] = (map[month] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }))
  }, [tickets])

  const resolvedOverTime = useMemo(() => {
    const map = {}
    tickets.filter(t => t.resolved).forEach(t => {
      const month = t.resolved.slice(0, 7)
      map[month] = (map[month] || 0) + 1
    })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }))
  }, [tickets])

  const ageBuckets = useMemo(() => {
    const buckets = { '0-7d': 0, '7-30d': 0, '30-90d': 0, '90-180d': 0, '180-365d': 0, '365d+': 0 }
    tickets.forEach(t => {
      if (t.daysPending <= 7) buckets['0-7d']++
      else if (t.daysPending <= 30) buckets['7-30d']++
      else if (t.daysPending <= 90) buckets['30-90d']++
      else if (t.daysPending <= 180) buckets['90-180d']++
      else if (t.daysPending <= 365) buckets['180-365d']++
      else buckets['365d+']++
    })
    return Object.entries(buckets).map(([name, value]) => ({ name, value }))
  }, [tickets])

  const assigneeVsAge = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      if (!map[t.assignee]) map[t.assignee] = { total: 0, count: 0 }
      map[t.assignee].total += t.daysPending
      map[t.assignee].count++
    })
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 12).map(([name, { total, count }]) => ({
      name: name.split(' ')[0],
      avgAge: Math.round(total / count),
      count,
      fullName: name
    }))
  }, [tickets])

  const priorityVsSeverity = useMemo(() => {
    const map = {}
    tickets.forEach(t => {
      const key = `${t.priority}|${t.severity || 'Unset'}`
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map).map(([key, count]) => {
      const [priority, severity] = key.split('|')
      return { priority, severity, count }
    })
  }, [tickets])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className={textSub}>Loading analysis overview...</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(ANALYSIS_QUERIES).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveQuery(key)}
            className={`rounded-xl p-3 border text-left transition-all ${activeQuery === key
              ? (theme === 'dark' ? 'bg-blue-900/40 border-blue-500/60 ring-1 ring-blue-500/30' : 'bg-blue-50 border-blue-400 ring-1 ring-blue-300')
              : cardBg + ' hover:border-blue-500/40'}`}
          >
            <div className={`text-[10px] uppercase tracking-wide truncate ${activeQuery === key ? 'text-blue-400' : textSub}`}>{label}</div>
            <div className={`text-lg font-bold mt-0.5 ${activeQuery === key ? 'text-blue-300' : textMain}`}>
              {queryData[key]?.total ?? '—'}
            </div>
          </button>
        ))}
      </div>

      {/* Query detail */}
      {detailLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className={textSub}>Loading {ANALYSIS_QUERIES[activeQuery]}...</p>
        </div>
      ) : detailData && (
        <>
          <div className={`rounded-xl p-4 border ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className={`text-lg font-bold ${textMain}`}>{detailData.name}</h2>
                <p className={`text-xs font-mono mt-1 ${textSub}`}>{detailData.jql?.slice(0, 120)}...</p>
              </div>
              <div className={`text-3xl font-bold ${textMain}`}>{detailData.total}</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            {/* 1. Age Distribution */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Age Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ageBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis tick={{ fill: textColor, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Status Breakdown */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Status Breakdown</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''} labelLine={false} fontSize={9}>
                    {byStatus.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 3. Priority Distribution */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Priority Distribution</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''} labelLine={false} fontSize={10}>
                    {byPriority.map((_, idx) => <Cell key={idx} fill={['#ef4444', '#f97316', '#eab308', '#22c55e', '#64748b'][idx % 5]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 4. Severity Breakdown */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Severity Breakdown</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySeverity}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis tick={{ fill: textColor, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 5. By Assignee */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Top Assignees</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byAssignee} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: textColor, fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, _, props) => [val, props.payload.fullName]} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 6. By Reporter */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Top Reporters</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byReporter} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fill: textColor, fontSize: 9 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, _, props) => [val, props.payload.fullName]} />
                  <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 7. By Component */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>By Component</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byComponent}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 8 }} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: textColor, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 8. By Customer */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>By Customer (Top 15)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byCustomer} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: textColor, fontSize: 8 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, _, props) => [val, props.payload.fullName]} />
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 9. Created Over Time (Trend) */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Created Over Time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={createdOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 9 }} />
                  <YAxis tick={{ fill: textColor, fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Created" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* 10. Resolved Over Time */}
            {resolvedOverTime.length > 0 && (
              <div className={`rounded-xl p-5 border ${cardBg}`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Resolved Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={resolvedOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 9 }} />
                    <YAxis tick={{ fill: textColor, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="count" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Resolved" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 11. Assignee vs Avg Age Scatter */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Assignee: Count vs Avg Age</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis type="number" dataKey="count" name="Ticket Count" tick={{ fill: textColor, fontSize: 10 }} />
                  <YAxis type="number" dataKey="avgAge" name="Avg Age (days)" tick={{ fill: textColor, fontSize: 10 }} />
                  <ZAxis type="number" dataKey="count" range={[40, 400]} />
                  <Tooltip contentStyle={{ background: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #475569', borderRadius: 8 }} formatter={(val, name) => [val, name]} labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''} />
                  <Scatter data={assigneeVsAge} fill="#f59e0b" name="Assignees" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* 12. Priority vs Severity Heatmap (table-style) */}
            <div className={`rounded-xl p-5 border ${cardBg}`}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Priority vs Severity</h3>
              <PrioritySeverityHeatmap data={priorityVsSeverity} />
            </div>
          </div>

          {/* Ticket table */}
          <div className={`rounded-xl p-5 border ${cardBg}`}>
            <h3 className={`text-sm font-semibold uppercase tracking-wide mb-4 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
              All Tickets ({tickets.length})
            </h3>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className={`sticky top-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <tr>
                    {['Key', 'Summary', 'Status', 'Priority', 'Severity', 'Assignee', 'Reporter', 'Age', 'Customers'].map(h => (
                      <th key={h} className={`px-3 py-2 text-xs uppercase tracking-wide font-medium whitespace-nowrap ${textSub}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.slice(0, 100).map(t => (
                    <tr key={t.key} className={`border-b ${theme === 'dark' ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-blue-50/50'}`}>
                      <td className="px-3 py-2"><a href={`${JIRA_BASE}/${t.key}`} target="_blank" rel="noopener" className="text-blue-500 hover:text-blue-400 font-mono text-xs">{t.key}</a></td>
                      <td className={`px-3 py-2 max-w-[200px] truncate ${textMain}`}>{t.summary}</td>
                      <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                      <td className={`px-3 py-2 text-xs font-medium ${priorityColors[t.priority] || 'text-slate-400'}`}>{t.priority}</td>
                      <td className={`px-3 py-2 text-xs ${textSub}`}>{t.severity || '—'}</td>
                      <td className={`px-3 py-2 text-xs max-w-[100px] truncate ${textSub}`}>{t.assignee}</td>
                      <td className={`px-3 py-2 text-xs max-w-[100px] truncate ${textSub}`}>{t.reporter}</td>
                      <td className={`px-3 py-2 text-xs font-medium ${t.daysPending > 180 ? 'text-red-400' : t.daysPending > 90 ? 'text-orange-400' : textMain}`}>{t.daysPending}d</td>
                      <td className={`px-3 py-2 text-xs max-w-[120px] truncate ${textSub}`}>{t.customers.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PrioritySeverityHeatmap({ data }) {
  const theme = useContext(ThemeContext)
  const priorities = [...new Set(data.map(d => d.priority))].sort()
  const severities = [...new Set(data.map(d => d.severity))].sort()
  const map = {}
  data.forEach(d => { map[`${d.priority}|${d.severity}`] = d.count })
  const maxVal = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className={`px-2 py-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}></th>
            {severities.map(s => <th key={s} className={`px-2 py-1 text-center ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {priorities.map(p => (
            <tr key={p}>
              <td className={`px-2 py-1 font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{p}</td>
              {severities.map(s => {
                const val = map[`${p}|${s}`] || 0
                const intensity = val / maxVal
                const bg = val === 0 ? (theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-50') : `bg-red-500`
                return (
                  <td key={s} className="px-2 py-1 text-center">
                    <span className={`inline-block w-8 h-6 rounded flex items-center justify-center text-xs font-bold ${val > 0 ? 'text-white' : (theme === 'dark' ? 'text-slate-600' : 'text-slate-300')}`} style={{ backgroundColor: val > 0 ? `rgba(239, 68, 68, ${Math.max(0.2, intensity)})` : 'transparent' }}>
                      {val || '·'}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState('dark')
  const [page, setPage] = useState('dashboard')
  const [filters, setFilters] = useState([])
  const [selectedFilter, setSelectedFilter] = useState('41060')
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filterName, setFilterName] = useState('')
  const [filterJql, setFilterJql] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [localFilter, setLocalFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('daysPending')
  const [groupBy, setGroupBy] = useState('none')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewTab, setViewTab] = useState('data')

  useEffect(() => {
    fetch(`${API_BASE}/filters`).then(r => r.json()).then(setFilters).catch(() => setError('Failed to load filters'))
  }, [])

  useEffect(() => {
    if (!selectedFilter) return
    setLoading(true)
    setError(null)
    setCurrentPage(1)
    fetch(`${API_BASE}/tickets/${selectedFilter}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setTickets([]) }
        else { setTickets(data.tickets); setFilterName(data.filter); setFilterJql(data.jql) }
        setLoading(false)
      })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [selectedFilter])

  const filteredTickets = useMemo(() => {
    let result = [...tickets]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t => t.key.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q) || t.reporter.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q))
    }
    if (localFilter === 'critical') result = result.filter(t => t.daysPending > 600)
    else if (localFilter === 'stale') result = result.filter(t => t.totalChildren === 0 || (t.openChildren === t.totalChildren && t.totalChildren > 0))
    else if (localFilter === 'closeable') result = result.filter(t => (t.doneChildren + t.closedChildren === t.totalChildren && t.totalChildren > 0))
    if (sortBy === 'daysPending') result.sort((a, b) => b.daysPending - a.daysPending)
    else if (sortBy === 'priority') result.sort((a, b) => a.priority.localeCompare(b.priority))
    else if (sortBy === 'reporter') result.sort((a, b) => a.reporter.localeCompare(b.reporter))
    return result
  }, [tickets, localFilter, search, sortBy])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return null
    const groups = {}
    for (const t of filteredTickets) {
      const key = groupBy === 'reporter' ? t.reporter : groupBy === 'assignee' ? t.assignee : t.status
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [filteredTickets, groupBy])

  const totalPages = groupBy === 'none' ? Math.ceil(filteredTickets.length / PAGE_SIZE) : 1
  const paginatedTickets = groupBy === 'none' ? filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : filteredTickets

  const stats = useMemo(() => {
    if (!tickets.length) return { total: 0, critical: 0, closeable: 0, avgDays: 0 }
    return {
      total: tickets.length,
      critical: tickets.filter(t => t.daysPending > 600).length,
      closeable: tickets.filter(t => t.doneChildren + t.closedChildren === t.totalChildren && t.totalChildren > 0).length,
      avgDays: Math.round(tickets.reduce((s, t) => s + t.daysPending, 0) / tickets.length),
    }
  }, [tickets])

  const bgMain = theme === 'dark' ? 'bg-[#0f1117]' : 'bg-slate-50'
  const bgHeader = theme === 'dark' ? 'bg-[#0f1117]/80' : 'bg-white/80'
  const borderColor = theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
  const textMain = theme === 'dark' ? 'text-white' : 'text-slate-900'
  const textSub = theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
  const inputCls = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  const selectCls = theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`min-h-screen ${bgMain} transition-colors`}>
        <header className={`border-b ${borderColor} ${bgHeader} backdrop-blur-md sticky top-0 z-40`}>
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className={`text-2xl font-bold ${textMain}`}>Platform Pulse</h1>
                <div className="flex items-center gap-4 mt-2">
                  {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'leaderboard', label: 'Leaderboard' }, { id: 'analysis', label: 'Analysis' }, { id: 'closures', label: 'Closures' }].map(tab => (
                    <button key={tab.id} onClick={() => setPage(tab.id)} className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${page === tab.id ? (theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white') : (theme === 'dark' ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100')}`}>{tab.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className={`p-2 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                  title="Toggle theme"
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
                <div className="text-right">
                  <div className={`text-xs ${textSub}`}>Filters loaded</div>
                  <div className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{filters.length} available</div>
                </div>
              </div>
            </div>

            {page === 'dashboard' && (
              <div className="flex items-center gap-3">
                <select value={selectedFilter} onChange={e => setSelectedFilter(e.target.value)} className={`border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 min-w-[300px] ${selectCls}`}>
                  <option value="">Select a Jira Filter...</option>
                  {filters.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {filterJql && (
                  <div className={`flex-1 rounded-lg px-3 py-2 overflow-hidden border ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}>
                    <span className={`text-xs ${textSub}`}>JQL: </span>
                    <span className={`text-xs font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{filterJql}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {page === 'leaderboard' && <LeaderboardPage />}
          {page === 'analysis' && <AnalysisPage />}
          {page === 'closures' && <ClosuresPage />}

          {page === 'dashboard' && (
            <>
              {!selectedFilter && !loading && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="text-6xl mb-4 opacity-20">&#9776;</div>
                  <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>Select a Filter to Begin</h2>
                  <p className={textSub}>Choose a Jira filter from the dropdown above.</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className={textSub}>Fetching tickets from Jira...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-950/30 border border-red-700/30 rounded-xl p-4 mb-6">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {tickets.length > 0 && !loading && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <StatsCard label="Total Open" value={stats.total} />
                    <StatsCard label="Critical (600+ days)" value={stats.critical} color="text-red-400" />
                    <StatsCard label="Ready to Close" value={stats.closeable} color="text-green-400" />
                    <StatsCard label="Avg Days Pending" value={stats.avgDays} color="text-orange-400" />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-6">
                    <input type="text" placeholder="Search..." value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1) }} className={`border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 w-64 ${inputCls}`} />
                    <select value={localFilter} onChange={e => { setLocalFilter(e.target.value); setCurrentPage(1) }} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                      <option value="all">All Tickets</option>
                      <option value="critical">Critical (600+ days)</option>
                      <option value="stale">Stale (no progress)</option>
                      <option value="closeable">Ready to Close</option>
                    </select>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                      <option value="daysPending">Sort: Days Pending</option>
                      <option value="priority">Sort: Priority</option>
                      <option value="reporter">Sort: Reporter</option>
                    </select>
                    <select value={groupBy} onChange={e => { setGroupBy(e.target.value); setCurrentPage(1) }} className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 ${selectCls}`}>
                      <option value="none">No Grouping</option>
                      <option value="reporter">Group: Reporter</option>
                      <option value="assignee">Group: Assignee</option>
                      <option value="status">Group: Status</option>
                    </select>

                    <div className="ml-auto flex items-center gap-3">
                      <TabSwitcher activeTab={viewTab} onTabChange={setViewTab} />
                      <span className={`text-xs ${textSub}`}>{filteredTickets.length} tickets</span>
                    </div>
                  </div>

                  {viewTab === 'chart' && <ChartView tickets={filteredTickets} groupBy={groupBy} onTicketClick={setSelectedTicket} />}

                  {viewTab === 'data' && (
                    <>
                      {grouped ? (
                        <div className="space-y-8">
                          {grouped.map(([groupName, groupTickets]) => (
                            <div key={groupName}>
                              <div className="flex items-center gap-3 mb-3">
                                <h2 className={`text-lg font-semibold ${textMain}`}>{groupName}</h2>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{groupTickets.length}</span>
                                <span className={`text-xs ${textSub}`}>Avg age: {Math.round(groupTickets.reduce((s, t) => s + t.daysPending, 0) / groupTickets.length)}d</span>
                              </div>
                              <TicketTable tickets={groupTickets} onTicketClick={setSelectedTicket} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <TicketTable tickets={paginatedTickets} onTicketClick={setSelectedTicket} />
                          {totalPages > 1 && <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {selectedTicket && <TicketDetail ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
      </div>
    </ThemeContext.Provider>
  )
}

export default App
