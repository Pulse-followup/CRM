import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider } from './features/auth/authStore'
import { BillingProvider } from './features/billing/billingStore'
import AdminLayout from './layouts/AdminLayout'
import FinanceLayout from './layouts/FinanceLayout'
import UserLayout from './layouts/UserLayout'
import AdminDashboard from './pages/AdminDashboard'
import BillingPage from './pages/BillingPage'
import ClientDetail from './pages/ClientDetail'
import { ClientProvider } from './features/clients/clientStore'
import ClientsPage from './pages/ClientsPage'
import ProjectDetail from './features/projects/pages/ProjectDetail'
import { ProjectProvider } from './features/projects/projectStore'
import { TaskProvider } from './features/tasks/taskStore'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'
import UserTasks from './pages/UserTasks'
import type { Role } from './types/role'

const role: Role = 'admin'

function App() {
  return (
    <AuthProvider>
      <ClientProvider>
        <ProjectProvider>
          <TaskProvider>
            <BillingProvider>
              <BrowserRouter basename="/CRM">
                <Routes>
                  {role === 'admin' && (
                    <Route element={<AdminLayout />}>
                      <Route path="/" element={<Navigate to="/admin" replace />} />
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/tasks" element={<UserTasks />} />
                      <Route path="/clients" element={<ClientsPage />} />
                      <Route path="/clients/:id" element={<ClientDetail />} />
                      <Route path="/projects" element={<ProjectsPage />} />
                      <Route path="/projects/:id" element={<ProjectDetail />} />
                      <Route path="/billing" element={<BillingPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Route>
                  )}

                  {role === 'user' && (
                    <Route element={<UserLayout />}>
                      <Route path="/" element={<Navigate to="/tasks" replace />} />
                      <Route path="/tasks" element={<UserTasks />} />
                      <Route path="*" element={<Navigate to="/tasks" replace />} />
                    </Route>
                  )}

                  {role === 'finance' && (
                    <Route element={<FinanceLayout />}>
                      <Route path="/" element={<Navigate to="/billing" replace />} />
                      <Route path="/billing" element={<BillingPage />} />
                      <Route path="*" element={<Navigate to="/billing" replace />} />
                    </Route>
                  )}
                </Routes>
              </BrowserRouter>
            </BillingProvider>
          </TaskProvider>
        </ProjectProvider>
      </ClientProvider>
    </AuthProvider>
  )
}

export default App
