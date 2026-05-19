import { useState, useEffect, useRef } from 'react'
import './index.css'

const _d = [104,97,114,110,101,115,115,46,105,111]
const _p = [72,97,114,110,101,115,115,64,49,98,33,108,108,111,110]

function _v(email) {
  const domain = String.fromCharCode(..._d)
  return email.toLowerCase().endsWith('@' + domain)
}

function _c(input) {
  const expected = String.fromCharCode(..._p)
  return input === expected
}

function generateCaptcha() {
  const ops = ['+', '-', 'x']
  const op = ops[Math.floor(Math.random() * ops.length)]
  let a, b, answer
  if (op === '+') {
    a = Math.floor(Math.random() * 20) + 1
    b = Math.floor(Math.random() * 20) + 1
    answer = a + b
  } else if (op === '-') {
    a = Math.floor(Math.random() * 20) + 10
    b = Math.floor(Math.random() * 10) + 1
    answer = a - b
  } else {
    a = Math.floor(Math.random() * 9) + 2
    b = Math.floor(Math.random() * 9) + 2
    answer = a * b
  }
  return { question: `${a} ${op} ${b}`, answer: String(answer) }
}

function hashSession(email) {
  const ts = Date.now()
  const raw = `${email}:${ts}:${navigator.userAgent.slice(0, 20)}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i)
    hash |= 0
  }
  return btoa(`${Math.abs(hash).toString(36)}:${ts}`)
}

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 60000

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaInput, setCaptchaInput] = useState('')
  const [error, setError] = useState('')
  const [emailValid, setEmailValid] = useState(false)
  const [shake, setShake] = useState(false)
  const [captcha, setCaptcha] = useState(generateCaptcha)
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [lockRemaining, setLockRemaining] = useState(0)
  const timerRef = useRef(null)

  useEffect(() => {
    const stored = localStorage.getItem('pp_lockout')
    if (stored) {
      const until = parseInt(stored, 10)
      if (until > Date.now()) {
        setLockedUntil(until)
        setAttempts(MAX_ATTEMPTS)
      } else {
        localStorage.removeItem('pp_lockout')
      }
    }
  }, [])

  useEffect(() => {
    if (lockedUntil <= Date.now()) { setLockRemaining(0); return }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setLockRemaining(remaining)
      if (remaining <= 0) {
        setLockedUntil(0)
        setAttempts(0)
        localStorage.removeItem('pp_lockout')
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [lockedUntil])

  const validateEmail = (value) => {
    setEmail(value)
    setError('')
    setEmailValid(_v(value))
  }

  const handleFailure = (msg) => {
    setError(msg)
    triggerShake()
    const newAttempts = attempts + 1
    setAttempts(newAttempts)
    setCaptcha(generateCaptcha())
    setCaptchaInput('')
    if (newAttempts >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCKOUT_DURATION
      setLockedUntil(until)
      localStorage.setItem('pp_lockout', String(until))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (lockedUntil > Date.now()) return

    if (!emailValid) {
      handleFailure('Invalid credentials')
      return
    }
    if (captchaInput.trim() !== captcha.answer) {
      handleFailure('Incorrect verification answer')
      return
    }
    if (!_c(password)) {
      handleFailure('Invalid credentials')
      return
    }
    sessionStorage.setItem('pp_auth', hashSession(email))
    setAttempts(0)
    localStorage.removeItem('pp_lockout')
    onLogin(email)
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const isLocked = lockedUntil > Date.now()

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      <div className={`relative w-full max-w-md ${shake ? 'animate-shake' : ''}`}>
        <div className="bg-[#1a1d2e] border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-600/10 border border-blue-500/20 mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Platform Pulse</h1>
            <p className="text-slate-500 text-sm mt-1">Sign in to continue</p>
          </div>

          {isLocked ? (
            <div className="text-center py-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-900/20 border border-red-500/30 mb-4">
                <span className="text-red-400 text-xl">&#9888;</span>
              </div>
              <p className="text-red-400 text-sm font-medium">Too many failed attempts</p>
              <p className="text-slate-500 text-xs mt-2">Try again in {lockRemaining}s</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => validateEmail(e.target.value)}
                  placeholder="Enter your work email"
                  autoFocus
                  autoComplete="off"
                  className={`w-full bg-slate-800 border rounded-lg px-4 py-3 text-white placeholder:text-slate-600 text-sm focus:outline-none transition-colors ${
                    error && !emailValid ? 'border-red-500/60 focus:border-red-500' :
                    emailValid ? 'border-green-500/40 focus:border-green-500' :
                    'border-slate-700 focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder={emailValid ? 'Enter password' : 'Enter email first'}
                  disabled={!emailValid}
                  autoComplete="off"
                  className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors ${
                    !emailValid
                      ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed placeholder:text-slate-700'
                      : 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500'
                  }`}
                />
              </div>

              {/* CAPTCHA */}
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                  Verify: What is <span className="text-blue-400 font-bold">{captcha.question}</span> ?
                </label>
                <input
                  type="text"
                  value={captchaInput}
                  onChange={(e) => { setCaptchaInput(e.target.value); setError('') }}
                  placeholder="Enter answer"
                  disabled={!emailValid}
                  autoComplete="off"
                  className={`w-full border rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors ${
                    !emailValid
                      ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed placeholder:text-slate-700'
                      : 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500'
                  }`}
                />
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2.5">
                  <p className="text-red-400 text-sm">{error}</p>
                  {attempts >= 3 && <p className="text-red-500/60 text-xs mt-1">{MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={!emailValid || !password || !captchaInput}
                className={`w-full py-3 rounded-lg text-sm font-semibold transition-all ${
                  emailValid && password && captchaInput
                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20 active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                Sign In
              </button>
            </form>
          )}

          <p className="text-center text-slate-600 text-xs mt-6">
            Authorized personnel only
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
