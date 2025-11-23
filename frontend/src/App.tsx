
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './AppLayout'
import TorrentsPage from './Torrents'
import AgentsPage from './Agents'
import CategoriesPage from './Categories'
import DashboardPage from './Dashboard'
import IntegrationsPage from './Integrations'
import IntegrationWebhookPage from './IntegrationWebhook'
import SettingsPage from './Settings'
import AboutPage from './About'
import ProfilePage from './Profile'
import HistoryPage from './History'
import UsersPage from './Users'
import LoginPage from './Login'
import SignupPage from './Signup'
import InviteAcceptPage from './InviteAccept'
import InitialSetupPage from './InitialSetup'
import ResetPasswordPage from './ResetPassword'
import ForgotPasswordPage from './ForgotPassword'
import { Toaster } from './components/ui/sonner'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster richColors />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<InitialSetupPage />} />
          <Route path="/signup/:token" element={<SignupPage />} />
          <Route path="/invite/:code" element={<InviteAcceptPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Outlet />
                </AppLayout>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="agent/:agent_uuid" element={<DashboardPage />} />
            <Route path="agent/:agent_uuid/task/:uuid" element={<DashboardPage />} />
            <Route path="torrents" element={<TorrentsPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="integrations/webhooks" element={<IntegrationWebhookPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="about" element={<AboutPage />} />
          </Route>
          {/* Catch-all route for 404 - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

export default App
