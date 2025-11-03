
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './AppLayout'
import TorrentsPage from './Torrents'
import AgentsPage from './Agents'
import CategoriesPage from './Categories'
import AnalyticsPage from './Analytics'
import IntegrationsPage from './Integrations'
import SettingsPage from './Settings'
import AboutPage from './About'
import ProfilePage from './Profile'
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
        <Toaster />
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
            <Route index element={<TorrentsPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="analytics/tasks" element={<AnalyticsPage />} />
            <Route path="analytics/agent/:agent_uuid" element={<AnalyticsPage />} />
            <Route path="analytics/agent/:agent_uuid/task/:uuid" element={<AnalyticsPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
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
