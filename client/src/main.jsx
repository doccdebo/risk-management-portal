import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminPage from './components/AdminPage.jsx'
import './App.css'

const isAdminRoute = window.location.pathname.replace(/\/+$/, '') === '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute ? <AdminPage /> : <App />}
  </StrictMode>,
)
