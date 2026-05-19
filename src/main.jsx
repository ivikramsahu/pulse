import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Login from './Login.jsx'

function Root() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('pp_auth'))

  if (!authed) return <Login onLogin={() => setAuthed(true)} />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
