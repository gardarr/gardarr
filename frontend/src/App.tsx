
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import AppLayout from './AppLayout'
import DashboardPage from './Dashboard'
import TorrentsPage from './Torrents'
import AgentsPage from './Agents'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/" element={<AppLayout><Outlet /></AppLayout>}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="torrents" element={<TorrentsPage />} />
          <Route path="agents" element={<AgentsPage />} />
          {/* Outras rotas podem ser adicionadas aqui */}
        </Route>
      </Routes>
    </Router>
  )
}

export default App
