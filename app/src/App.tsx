import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AuthProvider, useAuthStore } from './features/auth/authStore'
import { CloudProvider, useCloudStore } from './features/cloud/cloudStore'
import { DemoProvider } from './features/demo/demoStore'
import { BillingProvider } from './features/billing/billingStore'
import { ClientProvider } from './features/clients/clientStore'
import NotificationToasts from './features/notifications/NotificationToasts'
import { NotificationProvider } from './features/notifications/notificationStore'
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
import ClientCreateActivityPage from './features/clients/pages/ClientCreateActivityPage'
import ClientCreateJobPage from './features/clients/pages/ClientCreateJobPage'
import ClientsPage from './pages/ClientsPage'
import FinanceHome from './pages/FinanceHome'
import NoAccessPage from './pages/NoAccessPage'
import ProjectsPage from './pages/ProjectsPage'
import ProductsPage from './pages/ProductsPage'
import TemplatesPage from './pages/TemplatesPage'
import SettingsPage from './pages/SettingsPage'
import WorkspacePage from './pages/WorkspacePage'
import DataPage from './pages/DataPage'
import UserHome from './pages/UserHome'
import UserTasks from './pages/UserTasks'
import PulseWelcomeGuide, { PULSE_WELCOME_KEY } from './components/PulseWelcomeGuide'
import SetupChecklistOverlay from './features/onboarding/SetupChecklistOverlay'

function App() {
  return (
    <CloudProvider>
      <DemoProvider>
        <AuthProvider>
          <NotificationProvider>
            <ClientProvider>
              <ProjectProvider>
                <TaskProvider>
                  <BillingProvider>
                    <AppRoutes />
                  </BillingProvider>
                </TaskProvider>
              </ProjectProvider>
            </ClientProvider>
          </NotificationProvider>
        </AuthProvider>
      </DemoProvider>
    </CloudProvider>
  )
}

function AppRoutes() {
  const { currentUser } = useAuthStore()
  const cloud = useCloudStore()
  const role = currentUser.role

  const [isGuideOpen, setIsGuideOpen] = useState(false)

  useEffect(() => {
    if (!window.localStorage.getItem(PULSE_WELCOME_KEY)) setIsGuideOpen(true)
  }, [])

  useEffect(() => {
    if (cloud.rememberedInviteId && !cloud.activeWorkspace) setIsGuideOpen(true)
  }, [cloud.activeWorkspace, cloud.rememberedInviteId])

  const openGuide = () => setIsGuideOpen(true)

  const layoutElement =
    role === 'admin' ? (
      <AdminLayout onOpenGuide={openGuide} />
    ) : role === 'finance' ? (
      <FinanceLayout onOpenGuide={openGuide} />
    ) : (
      <UserLayout onOpenGuide={openGuide} />
    )

  const homeElement =
    role === 'admin' ? <AdminHome /> : role === 'finance' ? <FinanceHome /> : <UserHome />

  return (
    <>
      <BrowserRouter basename="/CRM">
        <SetupChecklistOverlay />
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
          <Route
            path="/clients/:id/new-activity"
            element={role === 'admin' ? <ClientCreateActivityPage /> : <NoAccessPage />}
          />
          <Route
            path="/clients/:id/new-job"
            element={role === 'admin' ? <ClientCreateJobPage /> : <NoAccessPage />}
          />
          <Route path="/projects" element={role === 'admin' ? <ProjectsPage /> : <NoAccessPage />} />
          <Route path="/products" element={role === 'admin' ? <ProductsPage /> : <NoAccessPage />} />
          <Route path="/templates" element={role === 'admin' ? <TemplatesPage /> : <NoAccessPage />} />
          <Route
            path="/projects/:id"
            element={role === 'admin' ? <ProjectDetail /> : <NoAccessPage />}
          />
          <Route path="/billing" element={role === 'user' ? <NoAccessPage /> : <BillingPage />} />
          <Route path="/workspace" element={role === 'admin' ? <WorkspacePage /> : <NoAccessPage />} />
          <Route path="/data" element={role === 'admin' ? <DataPage /> : <NoAccessPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        </Routes>
      </BrowserRouter>
      <PulseWelcomeGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <NotificationToasts />
    </>
  )
}

export default App
