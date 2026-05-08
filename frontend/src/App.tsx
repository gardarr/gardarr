
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SetupProvider } from './contexts/SetupContext'
import ProtectedRoute from './components/ProtectedRoute'
import { ErrorBoundary } from './components/ErrorBoundary'
import AppLayout from './AppLayout'
import TorrentsPage from './Torrents'
import WorkersPage from './Workers'
import CategoriesPage from './Categories'
import DashboardPage from './Dashboard'
import HistoryPage from './History'
import IntegrationsPage from './Integrations'
import IntegrationWebhookPage from './IntegrationWebhook'
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
import { InstallPrompt } from './components/InstallPrompt'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <SetupProvider>
          <AuthProvider>
            <Toaster richColors />
            <InstallPrompt />
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
                <Route path="worker/:worker_uuid" element={<DashboardPage />} />
                <Route path="worker/:worker_uuid/task/:uuid" element={<DashboardPage />} />
                <Route path="torrents" element={<TorrentsPage />} />
                <Route path="workers" element={<WorkersPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="integrations/webhooks" element={<IntegrationWebhookPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="about" element={<AboutPage />} />
              </Route>
              {/* Catch-all route for 404 - redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </SetupProvider>
      </Router>
    </ErrorBoundary>
  )
}

export default App
