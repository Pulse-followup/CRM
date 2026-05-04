import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuthStore } from './features/auth/authStore'
import { CloudProvider } from './features/cloud/cloudStore'
import { BillingProvider } from './features/billing/billingStore'
import { ClientProvider } from './features/clients/clientStore'
import { ProjectProvider } from './features/projects/projectStore'
import ProjectDetail from './features/projects/pages/ProjectDetail'
import TaskDetail from './features/tasks/pages/TaskDetail'
import { TaskProvider } from './features/tasks/taskStore'
import AdminLayout from './layouts/AdminLayout'
import FinanceLayout from './layouts/FinanceLayout'
import UserLayout from './layouts/UserLayout'
import AdminHome from './pages/AdminHome'
import BillingPage from './pages/BillingPage'
import ClientDetail from './pages/ClientDetail'
import ClientsPage from './pages/ClientsPage'
import FinanceHome from './pages/FinanceHome'
import NoAccessPage from './pages/NoAccessPage'
import ProjectsPage from './pages/ProjectsPage'
import ProductsPage from './pages/ProductsPage'
import TemplatesPage from './pages/TemplatesPage'
import SettingsPage from './pages/SettingsPage'
import UserHome from './pages/UserHome'
import UserTasks from './pages/UserTasks'

function App() {
  return (
    <CloudProvider>
      <AuthProvider>
        <ClientProvider>
          <ProjectProvider>
            <TaskProvider>
              <BillingProvider>
                <AppRoutes />
              </BillingProvider>
            </TaskProvider>
          </ProjectProvider>
        </ClientProvider>
      </AuthProvider>
    </CloudProvider>
  )
}

function AppRoutes() {
  const { currentUser } = useAuthStore()
  const role = currentUser.role

  const layoutElement =
    role === 'admin' ? <AdminLayout /> : role === 'finance' ? <FinanceLayout /> : <UserLayout />

  const homeElement =
    role === 'admin' ? <AdminHome /> : role === 'finance' ? <FinanceHome /> : <UserHome />

  return (
    <BrowserRouter basename="/CRM">
      <Routes>
        <Route element={layoutElement}>
          <Route path="/" element={homeElement} />
          <Route path="/admin" element={role === 'admin' ? <AdminHome /> : <NoAccessPage />} />
          <Route
            path="/tasks"
            element={
              role === 'finance' ? <NoAccessPage /> : role === 'user' ? <Navigate to="/" replace /> : <UserTasks />
            }
          />
          <Route
            path="/tasks/:taskId"
            element={role === 'finance' ? <NoAccessPage /> : <TaskDetail />}
          />
          <Route path="/clients" element={role === 'admin' ? <ClientsPage /> : <NoAccessPage />} />
          <Route
            path="/clients/:id"
            element={role === 'admin' ? <ClientDetail /> : <NoAccessPage />}
          />
          <Route path="/projects" element={role === 'admin' ? <ProjectsPage /> : <NoAccessPage />} />
          <Route path="/products" element={role === 'admin' ? <ProductsPage /> : <NoAccessPage />} />
          <Route path="/templates" element={role === 'admin' ? <TemplatesPage /> : <NoAccessPage />} />
          <Route
            path="/projects/:id"
            element={role === 'admin' ? <ProjectDetail /> : <NoAccessPage />}
          />
          <Route path="/billing" element={role === 'user' ? <NoAccessPage /> : <BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
