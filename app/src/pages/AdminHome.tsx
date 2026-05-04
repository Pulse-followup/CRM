import { useEffect, useMemo, useState } from 'react'
import { BILLING_STATUS_LABELS } from '../features/billing/billingLabels'
import { useBillingStore } from '../features/billing/billingStore'
import type { BillingRecord } from '../features/billing/types'
import { useClientStore } from '../features/clients/clientStore'
import type { Client } from '../features/clients/types'
import ClientCreateForm, { type ClientCreateFormValues } from '../features/clients/components/ClientCreateForm'
import ClientEditForm, { type ClientEditFormPatch } from '../features/clients/components/ClientEditForm'
import ClientCardSections from '../features/clients/components/ClientCardSections'
import CatalogJobForm, { type CatalogJobFormValues } from '../features/clients/components/CatalogJobForm'
import { useProjectStore } from '../features/projects/projectStore'
import { isProductVisibleForClient, readProducts, readProductsFromSupabase, saveProducts } from '../features/products/productStorage'
import type { Project, ProjectStage } from '../features/projects/types'
import ProjectForm, { type ProjectFormValues } from '../features/projects/components/ProjectForm'
import { buildStagesFromTemplate, getTemplateIdForProjectType } from '../features/projects/projectTemplates'
import { readProcessTemplates, readProcessTemplatesFromSupabase, saveProcessTemplates } from '../features/templates/templateStorage'
import { buildCatalogJobPayload } from '../features/workflows/createJobFromProduct'
import { calculateClientScore } from '../features/scoring/scoringEngine'
import { TASK_STATUS_LABELS } from '../features/tasks/taskLabels'
import { getLateTasks } from '../features/tasks/taskSelectors'
import { useTaskStore } from '../features/tasks/taskStore'
import type { Task } from '../features/tasks/types'
import CreateTaskForm, { type CreateTaskFormValues } from '../features/tasks/components/CreateTaskForm'
import { useCloudStore } from '../features/cloud/cloudStore'
import { getSupabaseClient } from '../lib/supabaseClient'
import '../features/clients/pages/client-detail.css'

type ModalState =
  | { type: 'task'; task: Task }
  | { type: 'project'; project: Project }
  | { type: 'billing'; record: BillingRecord }
  | { type: 'client'; client: Client; score: number }
  | { type: 'create-client' }
  | { type: 'create-project'; clientId?: string }
  | null

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatAmountValue(amount: number | null | undefined, currency = 'RSD') {
  return typeof amount === 'number' ? `${amount.toLocaleString('sr-RS')} ${currency}` : '-'
}

function formatAmount(record: BillingRecord) {
  return formatAmountValue(record.amount, record.currency)
}

function isOverdueDate(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function daysLate(value?: string | null) {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000))
}

function daysSince(value?: string | null) {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000))
}

function isCoveredBillingStatus(status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  return Boolean(normalized && normalized !== 'cancelled' && normalized !== 'otkazano')
}

function getProjectBillingRecord(project: Project, billing: BillingRecord[]) {
  return billing.find((record) => record.projectId === project.id && isCoveredBillingStatus(record.status)) ?? null
}

function isProjectCoveredByBilling(project: Project, billing: BillingRecord[]) {
  return Boolean((project.billingId && isCoveredBillingStatus(project.billingStatus)) || getProjectBillingRecord(project, billing))
}

function isTaskBillableDone(task: Task, project?: Project, billing: BillingRecord[] = []) {
  if (task.status !== 'zavrsen') return false
  if (task.billingState === 'sent_to_billing' || task.billingState === 'billed' || task.billingId) return false
  if (project && isProjectCoveredByBilling(project, billing)) return false
  return true
}

function taskValue(task: Task) {
  return (task.laborCost ?? 0) + (task.materialCost ?? 0)
}

type PulseSignalTone = 'red' | 'yellow' | 'blue'

type PulseSignal = {
  id: string
  tone: PulseSignalTone
  badge: string
  title: string
  message: string
  actionLabel: string
  action: () => void
}

function getStageDueDate(stage?: ProjectStage) {
  return stage ? (stage as { dueDate?: string | null }).dueDate : undefined
}

function findOverdueStage(project: Project) {
  return project.stages?.find((stage) => {
    const dueDate = getStageDueDate(stage)
    return dueDate ? isOverdueDate(dueDate) : false
  })
}


function normalizeRoleLabel(role?: string) {
  const value = role?.trim()
  if (!value) return 'BEZ DODELE'

  const roleMap: Record<string, string> = {
    admin: 'ADMIN',
    account: 'ACCOUNT',
    user: 'OPERATIVA',
    finance: 'FINANSIJE',
    designer: 'DIZAJNER',
    dizajner: 'DIZAJNER',
    production: 'PROIZVODNJA',
    produkcija: 'PROIZVODNJA',
    logistics: 'LOGISTIKA',
    logistika: 'LOGISTIKA',
  }

  const normalizedKey = value.toLowerCase()
  return roleMap[normalizedKey] || value.toUpperCase()
}

function ProjectCreateModal({ clients, initialClientId, onCancel, onSubmit }: { clients: Client[]; initialClientId?: string; onCancel: () => void; onSubmit: (clientId: string, values: ProjectFormValues) => void }) {
  const [clientId, setClientId] = useState(initialClientId ?? String(clients[0]?.id ?? ''))
  return (
    <div className="pulse-create-modal-content">
      <label className="customer-task-form-field">
        <span>Klijent</span>
        <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
          {clients.map((client) => <option key={client.id} value={String(client.id)}>{client.name}</option>)}
        </select>
      </label>
      <ProjectForm onCancel={onCancel} onSubmit={(values) => onSubmit(clientId, values)} />
    </div>
  )
}

function ProjectDetailModal({
  project,
  tasks,
  clientName,
  activeBilling,
  onCreateBilling,
}: {
  project: Project
  tasks: Task[]
  clientName: string
  activeBilling: BillingRecord | null
  onCreateBilling: (project: Project, tasksForBilling: Task[]) => void | Promise<void>
}) {
  const completedTasks = tasks.filter((task) => task.status === 'zavrsen')
  const unbilledCompletedTasks = completedTasks.filter((task) => isTaskBillableDone(task, project, activeBilling ? [activeBilling] : []))
  const totalLaborCost = unbilledCompletedTasks.reduce((sum, task) => sum + (task.laborCost ?? 0), 0)
  const totalMaterialCost = unbilledCompletedTasks.reduce((sum, task) => sum + (task.materialCost ?? 0), 0)
  const totalCost = totalLaborCost + totalMaterialCost

  return (
    <>
      <h3>Detalji projekta</h3>
      <p><strong>{project.title}</strong></p>
      <p>Klijent - {clientName}</p>
      {project.source === 'product' ? <p><span className="pulse-pill pulse-pill-blue">IZ PROIZVODA</span> {project.sourceProductTitle || '-'}</p> : null}
      <p>Status - {project.status}</p>
      <p>Tip - {project.type || '-'}</p>
      <p>Frekvencija - {project.frequency || '-'}</p>
      <p>Procenjena vrednost - {project.value ? `${project.value.toLocaleString('sr-RS')} RSD` : '-'}</p>
      <div className="pulse-project-billing-summary">
        <h4>Završeni taskovi za obračun</h4>
        {unbilledCompletedTasks.length ? (
          <div className="pulse-list">
            {unbilledCompletedTasks.map((task) => (
              <article className="pulse-item" key={task.id}>
                <div className="pulse-item-title-row"><h4>{task.title}</h4><span className="pulse-pill pulse-pill-green">ZAVRŠEN</span></div>
                <p><strong>Dodeljeno:</strong> {task.assignedToLabel || '-'}</p>
                <p><strong>Vreme:</strong> {task.timeSpentMinutes ?? 0} min / {formatAmountValue(task.laborCost ?? 0)}</p>
                <p><strong>Materijal:</strong> {formatAmountValue(task.materialCost ?? 0)}</p>
                {task.materialDescription ? <p><strong>Opis materijala:</strong> {task.materialDescription}</p> : null}
              </article>
            ))}
          </div>
        ) : <p className="pulse-empty">Nema završenih taskova koji čekaju nalog za naplatu.</p>}
        <p><strong>Rad ukupno:</strong> {formatAmountValue(totalLaborCost)}</p>
        <p><strong>Materijal ukupno:</strong> {formatAmountValue(totalMaterialCost)}</p>
        <p><strong>Ukupni interni trošak:</strong> {formatAmountValue(totalCost)}</p>
        {activeBilling ? <p><strong>Nalog za naplatu:</strong> {BILLING_STATUS_LABELS[activeBilling.status]}</p> : null}
        {!activeBilling && unbilledCompletedTasks.length ? (
          <div className="pulse-modal-actions">
            <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={() => void onCreateBilling(project, unbilledCompletedTasks)}>
              POŠALJI NA NAPLATU
            </button>
          </div>
        ) : null}
      </div>
    </>
  )
}

function ClientCardDrawer({ client, score, projects, tasks, billing, onClose, onUpdateClient, onCreateProject, onCreateTask, onCreateJobFromCatalog }: { client: Client; score: number; projects: Project[]; tasks: Task[]; billing: BillingRecord[]; onClose: () => void; onUpdateClient: (patch: ClientEditFormPatch) => void; onCreateProject: (values: ProjectFormValues) => void | Promise<void>; onCreateTask: (values: CreateTaskFormValues) => void | Promise<void>; onCreateJobFromCatalog: (clientId: string, values: CatalogJobFormValues) => void | Promise<void> }) {
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingActivity, setIsCreatingActivity] = useState(false)
  const [isChoosingJob, setIsChoosingJob] = useState(false)
  const [isCreatingFromCatalog, setIsCreatingFromCatalog] = useState(false)
  const [catalogJobMessage, setCatalogJobMessage] = useState('')
  const products = readProducts()
  const processTemplates = readProcessTemplates()

  return (
    <div className="pulse-client-drawer-content">
      <div className="pulse-client-drawer-head">
        <div><h3>{client.name}</h3><p>{client.city || '-'}</p></div>
        <span className="pulse-pill pulse-pill-cyan">PULSE {score}</span>
      </div>
      <div className="pulse-client-drawer-actions">
        <button type="button" className="customer-project-toggle" onClick={() => setIsCreatingActivity((value) => !value)}>Nova aktivnost</button>
        <button type="button" className="customer-project-toggle" onClick={() => setIsChoosingJob((value) => !value)}>Novi posao</button>
      </div>
      {isChoosingJob ? (
        <div className="customer-job-choice">
          <button type="button" className="customer-project-action-button" onClick={() => { setIsCreatingProject(true); setIsCreatingFromCatalog(false); setCatalogJobMessage('') }}>Prazan projekat</button>
          <button type="button" className="customer-project-action-button customer-project-action-button-secondary" onClick={() => { setIsCreatingFromCatalog(true); setIsCreatingProject(false); setIsCreatingActivity(false); setCatalogJobMessage('') }}>Iz kataloga</button>
        </div>
      ) : null}
      {isEditingClient ? <ClientEditForm client={client} onCancel={() => setIsEditingClient(false)} onSubmit={(patch) => { onUpdateClient(patch); setIsEditingClient(false) }} /> : null}
      {isCreatingProject ? <ProjectForm onCancel={() => setIsCreatingProject(false)} onSubmit={async (values) => { await onCreateProject(values); setIsCreatingProject(false); setIsChoosingJob(false) }} /> : null}
      {isCreatingFromCatalog ? (
        <CatalogJobForm
          clientId={String(client.id)}
          products={products}
          templates={processTemplates}
          onCancel={() => setIsCreatingFromCatalog(false)}
          onSubmit={async (values) => {
            await onCreateJobFromCatalog(String(client.id), values)
            setIsCreatingFromCatalog(false)
            setIsChoosingJob(false)
            setCatalogJobMessage('Posao je kreiran iz kataloga.')
          }}
        />
      ) : null}
      {catalogJobMessage ? <p className="customer-catalog-job-message">{catalogJobMessage}</p> : null}
      {isCreatingActivity ? <CreateTaskForm onCancel={() => setIsCreatingActivity(false)} onSubmit={(values) => { onCreateTask(values); setIsCreatingActivity(false) }} requireProjectSelection projectOptions={projects.map((project) => ({ id: project.id, label: project.title, stages: project.stages }))} /> : null}
      <ClientCardSections
        clientId={String(client.id)}
        clientName={client.name}
        clientCity={client.city}
        clientAddress={client.address}
        contacts={client.contacts}
        commercial={client.commercial}
        projects={projects}
        tasks={tasks}
        billing={billing}
        onEditClient={() => setIsEditingClient((value) => !value)}
        onAddFromCatalog={() => { setIsCreatingFromCatalog(true); setIsCreatingProject(false); setIsCreatingActivity(false); setIsChoosingJob(false); setCatalogJobMessage('') }}
      />
      <div className="pulse-modal-actions"><button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onClose}>Zatvori</button></div>
    </div>
  )
}

function AdminModal({ state, clients, projects, tasks, billing, onClose, onCreateClient, onCreateProject, onUpdateClient, onCreateTask, onCreateJobFromCatalog, onCreateBillingFromProject }: { state: ModalState; clients: Client[]; projects: Project[]; tasks: Task[]; billing: BillingRecord[]; onClose: () => void; onCreateClient: (values: ClientCreateFormValues) => void | Promise<void>; onCreateProject: (clientId: string, values: ProjectFormValues) => void | Promise<void>; onUpdateClient: (clientId: string, patch: ClientEditFormPatch) => void | Promise<void>; onCreateTask: (clientId: string, values: CreateTaskFormValues) => void | Promise<void>; onCreateJobFromCatalog: (clientId: string, values: CatalogJobFormValues) => void | Promise<void>; onCreateBillingFromProject: (project: Project, tasksForBilling: Task[]) => void | Promise<void> }) {
  if (!state) return null
  const clientProjects = state.type === 'client' ? projects.filter((project) => project.clientId === String(state.client.id)) : []
  const projectTasks = state.type === 'project' ? tasks.filter((task) => task.projectId === state.project.id) : []
  const activeBilling = state.type === 'project' ? billing.find((record) => record.projectId === state.project.id && record.status !== 'paid' && record.status !== 'cancelled') ?? null : null

  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div className={`pulse-modal ${state.type === 'client' ? 'pulse-client-drawer' : ''} ${state.type === 'create-client' ? 'pulse-create-client-modal' : ''} ${state.type === 'create-project' ? 'pulse-create-project-modal' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="pulse-modal-x" type="button" onClick={onClose}>x</button>
        {state.type === 'billing' ? <><h3>Detalji naplatnog naloga</h3><p><strong>Iznos</strong> - {formatAmount(state.record)}</p><p><strong>Opis</strong> - {state.record.description}</p><p><strong>Rok</strong> - {formatDate(state.record.dueDate)}</p><p><strong>Status</strong> - {BILLING_STATUS_LABELS[state.record.status]}</p><p><strong>Faktura</strong> - {state.record.invoiceNumber || '-'}</p></> : null}
        {state.type === 'task' ? <><h3>Detalji zadatka</h3><p><strong>{state.task.title}</strong></p><p>Klijent - {clients.find((client) => String(client.id) === String(state.task.clientId))?.name ?? 'Nepoznat klijent'}</p><p>Projekat - {projects.find((project) => project.id === state.task.projectId)?.title ?? 'Nepoznat projekat'}</p>{state.task.source === 'template' ? <p><span className="pulse-pill pulse-pill-blue">AUTO</span> {state.task.sourceTemplateTitle ? <>Iz šablona: <strong>{state.task.sourceTemplateTitle}</strong></> : 'Iz šablona'}</p> : null}<p>Tip - {state.task.type || '-'}</p><p>Status - {TASK_STATUS_LABELS[state.task.status] ?? state.task.status}</p><p>Rok - {formatDate(state.task.dueDate)}</p><p>Operativna rola - {normalizeRoleLabel(state.task.requiredRole || state.task.assignedToLabel)}</p>{state.task.assignedToUserId ? <p>Dodeljeno korisniku - {state.task.assignedToLabel || '-'}</p> : null}<p>Opis - {state.task.description || '-'}</p><p>Vreme - {state.task.timeSpentMinutes ?? 0} min</p><p>Materijal - {formatAmountValue(state.task.materialCost ?? 0)}</p></> : null}
        {state.type === 'project' ? <ProjectDetailModal project={state.project} tasks={projectTasks} clientName={clients.find((client) => String(client.id) === String(state.project.clientId))?.name ?? 'Nepoznat klijent'} activeBilling={activeBilling} onCreateBilling={onCreateBillingFromProject} /> : null}
        {state.type === 'client' ? <ClientCardDrawer client={state.client} score={state.score} projects={clientProjects} tasks={tasks} billing={billing} onClose={onClose} onUpdateClient={(patch) => onUpdateClient(String(state.client.id), patch)} onCreateProject={(values) => onCreateProject(String(state.client.id), values)} onCreateTask={(values) => onCreateTask(String(state.client.id), values)} onCreateJobFromCatalog={onCreateJobFromCatalog} /> : null}
        {state.type === 'create-client' ? <><h3>+ Novi klijent</h3><ClientCreateForm onCancel={onClose} onSubmit={onCreateClient} /></> : null}
        {state.type === 'create-project' ? <><h3>+ Novi projekat</h3><ProjectCreateModal clients={clients} initialClientId={state.clientId} onCancel={onClose} onSubmit={onCreateProject} /></> : null}
      </div>
    </div>
  )
}

function AdminHome() {
  const { activeWorkspace, members, isConfigured } = useCloudStore()
  const { clients, addClient, updateClient } = useClientStore()
  const { projects, addProject } = useProjectStore()
  const { tasks, addTask, updateTask } = useTaskStore()
  const { getAllBilling, createBillingForProject } = useBillingStore()
  const [modal, setModal] = useState<ModalState>(null)
  const [pulseTypingText, setPulseTypingText] = useState('')
  const billing = getAllBilling()

  useEffect(() => {
    const updates = tasks
      .map((task) => {
        const project = projects.find((item) => item.id === task.projectId)
        if (!project || !isTaskBillableDone(task, project, billing)) return null
        const projectBilling = getProjectBillingRecord(project, billing)
        const billingId = project.billingId || projectBilling?.id || null
        if (!billingId && !project.billingStatus) return null
        return { ...task, billingState: 'sent_to_billing' as const, billingStatus: 'sent_to_billing', billingId, updatedAt: new Date().toISOString() }
      })
      .filter(Boolean) as Task[]

    if (!updates.length) return
    updates.forEach((task) => void updateTask(task))
  }, [tasks, projects, billing, updateTask])

  useEffect(() => {
    let isMounted = true
    const workspaceId = activeWorkspace?.id || ''

    async function preloadCatalogFromCloud() {
      if (!isConfigured || !workspaceId) return

      try {
        const [cloudProducts, cloudTemplates] = await Promise.all([
          readProductsFromSupabase(workspaceId),
          readProcessTemplatesFromSupabase(workspaceId),
        ])

        if (!isMounted) return
        if (cloudProducts.length) saveProducts(cloudProducts)
        if (cloudTemplates.length) saveProcessTemplates(cloudTemplates)
      } catch {
        // Catalog cloud preload is best-effort; localStorage remains fallback.
      }
    }

    void preloadCatalogFromCloud()

    return () => {
      isMounted = false
    }
  }, [activeWorkspace?.id, isConfigured])

  useEffect(() => {
    const messages = [
      'PULSE analizira projekte, taskove i naplatu...',
      'Proveravam završene taskove i vrednost za naplatu...',
      'Tražim zastoje u projektima i otvorene rokove...',
      'Slažem prioritete za admin pregled...',
    ]
    const message = messages[Math.floor(Math.random() * messages.length)]
    let index = 0
    setPulseTypingText('')
    const timer = window.setInterval(() => {
      index += 1
      setPulseTypingText(message.slice(0, index))
      if (index >= message.length) window.clearInterval(timer)
    }, 22)
    return () => window.clearInterval(timer)
  }, [projects.length, tasks.length, billing.length])

  const clientById = useMemo(() => new Map(clients.map((client) => [String(client.id), client])), [clients])
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const clientName = (id: string) => clientById.get(String(id))?.name ?? 'Nepoznat klijent'
  const projectTitle = (id: string) => projectById.get(id)?.title ?? 'Nepoznat projekat'

  const urgentBilling = billing.filter((record) => {
    const status = String(record.status || '').toLowerCase()
    if (status === 'paid' || status === 'placeno' || status === 'cancelled' || status === 'otkazano') return false
    return status === 'overdue' || status === 'kasni' || isOverdueDate(record.dueDate)
  })
  const lateTasks = getLateTasks(tasks).filter((task) => task.clientId && task.projectId && clientById.has(String(task.clientId)) && projectById.has(task.projectId))
  const riskyProjects = projects.filter((project) => Boolean(findOverdueStage(project)))
  const pulseSignals = useMemo<PulseSignal[]>(() => {
    const signals: PulseSignal[] = []
    const activeProjects = projects.filter((project) => project.status !== 'arhiviran')

    urgentBilling.slice(0, 4).forEach((record) => {
      const lateBy = daysLate(record.dueDate)
      signals.push({
        id: `billing-${record.id}`,
        tone: 'red',
        badge: 'NAPLATA',
        title: lateBy ? `Naplata kasni ${lateBy} dana` : 'Naplata čeka reakciju',
        message: `${clientName(record.clientId)} — ${formatAmount(record)} za projekat ${projectTitle(record.projectId)}`,
        actionLabel: 'Otvori',
        action: () => setModal({ type: 'billing', record }),
      })
    })

    riskyProjects.slice(0, 4).forEach((project) => {
      const overdueStage = findOverdueStage(project)
      const overdueDays = daysLate(getStageDueDate(overdueStage))
      signals.push({
        id: `overdue-stage-${project.id}`,
        tone: 'red',
        badge: 'PROJEKAT',
        title: overdueDays ? `Faza kasni ${overdueDays} dana` : 'Projekat traži pažnju',
        message: `${clientName(project.clientId)} — ${project.title}${overdueStage?.name ? `: ${overdueStage.name}` : ''}`,
        actionLabel: 'Otvori projekat',
        action: () => setModal({ type: 'project', project }),
      })
    })

    activeProjects.forEach((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id)
      if (!projectTasks.length) return

      const completedTasks = projectTasks.filter((task) => task.status === 'zavrsen')
      const openTasks = projectTasks.filter((task) => task.status !== 'zavrsen' && task.status !== 'naplacen')
      const unbilledTasks = completedTasks.filter((task) => isTaskBillableDone(task, project, billing))
      const progress = Math.round((completedTasks.length / projectTasks.length) * 100)
      const pendingValue = unbilledTasks.reduce((sum, task) => sum + taskValue(task), 0)
      const activityDates = projectTasks
        .map((task) => task.completedAt || task.updatedAt || task.createdAt)
        .filter((value): value is string => Boolean(value))
      const lastActivityDate = activityDates.sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0]
      const idleDays = daysSince(lastActivityDate)

      if (unbilledTasks.length && idleDays >= 3) {
        signals.push({
          id: `ready-billing-${project.id}`,
          tone: 'red',
          badge: 'ZRELO',
          title: `Završeni taskovi čekaju ${idleDays} dana`,
          message: `${clientName(project.clientId)} — ${project.title}: ${unbilledTasks.length} taska spremna za naplatu${pendingValue ? ` (${formatAmountValue(pendingValue)})` : ''}`,
          actionLabel: 'Otvori projekat',
          action: () => setModal({ type: 'project', project }),
        })
      } else if (unbilledTasks.length) {
        signals.push({
          id: `fresh-billing-${project.id}`,
          tone: 'yellow',
          badge: 'NAPLATA',
          title: 'Spremno za naplatu',
          message: `${clientName(project.clientId)} — ${project.title}: ${unbilledTasks.length} završenih taskova`,
          actionLabel: 'Otvori projekat',
          action: () => setModal({ type: 'project', project }),
        })
      }

      if (openTasks.length && idleDays >= 5) {
        signals.push({
          id: `blocked-${project.id}`,
          tone: 'red',
          badge: 'BLOKADA',
          title: `Projekat stoji ${idleDays} dana`,
          message: `${clientName(project.clientId)} — ${project.title}: ${progress}% završeno, ${openTasks.length} otvorenih taskova`,
          actionLabel: 'Otvori projekat',
          action: () => setModal({ type: 'project', project }),
        })
      } else if (progress >= 60 && progress < 100) {
        signals.push({
          id: `progress-${project.id}`,
          tone: 'yellow',
          badge: 'BITNO',
          title: `Projekat je ${progress}% završen`,
          message: `${clientName(project.clientId)} — ${project.title}: blizu završetka, proveri sledeći korak`,
          actionLabel: 'Pogledaj',
          action: () => setModal({ type: 'project', project }),
        })
      }

      if (progress === 100 && unbilledTasks.length) {
        signals.push({
          id: `done-unbilled-${project.id}`,
          tone: 'red',
          badge: '100%',
          title: 'Završeno, nije naplaćeno',
          message: `${clientName(project.clientId)} — ${project.title}: sve završeno, pošalji na naplatu`,
          actionLabel: 'Naplata',
          action: () => setModal({ type: 'project', project }),
        })
      }
    })

    lateTasks.slice(0, 4).forEach((task) => {
      signals.push({
        id: `late-task-${task.id}`,
        tone: 'red',
        badge: 'TASK',
        title: 'Task kasni',
        message: `${clientName(String(task.clientId))} — ${projectTitle(task.projectId)}: ${task.title}`,
        actionLabel: 'Otvori',
        action: () => setModal({ type: 'task', task }),
      })
    })

    const toneWeight: Record<PulseSignalTone, number> = { red: 0, yellow: 1, blue: 2 }
    const uniqueSignals = Array.from(new Map(signals.map((signal) => [signal.id, signal])).values())
    return uniqueSignals
      .sort((first, second) => toneWeight[first.tone] - toneWeight[second.tone])
      .slice(0, 6)
  }, [projects, tasks, urgentBilling, riskyProjects, lateTasks, clientById, projectById])
  const validLinkedTasks = tasks.filter((task) => task.clientId && task.projectId && clientById.has(String(task.clientId)) && projectById.has(task.projectId))
  const teamTasks = validLinkedTasks.filter((task) => ['dodeljen', 'u_radu', 'na_cekanju'].includes(task.status))
  const teamTasksByRole = teamTasks.reduce<Record<string, Task[]>>((groups, task) => {
    const roleLabel = normalizeRoleLabel(task.requiredRole || task.assignedToLabel)
    return { ...groups, [roleLabel]: [...(groups[roleLabel] || []), task] }
  }, {})
  const teamRoleGroups = Object.entries(teamTasksByRole).sort(([firstRole], [secondRole]) => firstRole.localeCompare(secondRole, 'sr'))
  const sortedBilling = [...billing].sort((a, b) => (a.status === 'overdue' ? -1 : 0) - (b.status === 'overdue' ? -1 : 0))
  const clientScores = clients.map((client) => ({ client, score: calculateClientScore(String(client.id), { clients, projects, tasks, billing }).total }))

  const handleCreateClient = async (values: ClientCreateFormValues) => {
    const nextId = Math.max(0, ...clients.map((client) => Number(client.id) || 0)) + 1
    const savedClient = await addClient({ id: nextId, name: values.name, city: values.city, address: values.address, contacts: values.contacts, commercial: values.commercial })
    if (savedClient) {
      setModal(null)
    }
  }

  const handleCreateProject = async (clientId: string, values: ProjectFormValues) => {
    const templateId = getTemplateIdForProjectType(values.type)
    const projectId = `project-${crypto.randomUUID?.() || Date.now()}`
    const savedProject = await addProject({ id: projectId, clientId, title: values.title.trim() || 'Novi projekat', type: values.type || undefined, frequency: values.frequency || undefined, value: values.value.trim() ? Number(values.value) : undefined, status: 'aktivan', templateId, stages: buildStagesFromTemplate(templateId) })
    if (savedProject) {
      setModal(null)
    }
  }

  const handleCreateTask = async (clientId: string, values: CreateTaskFormValues) => {
    const timestamp = new Date().toISOString()
    const taskId = `task-${crypto.randomUUID?.() || Date.now()}`
    await addTask({ id: taskId, clientId, projectId: values.projectId, title: values.title.trim() || 'Nova aktivnost', description: values.description.trim(), type: values.type || undefined, assignedToUserId: values.assignedToUserId, assignedToLabel: values.assignedToLabel.trim(), dueDate: values.dueDate || undefined, stageId: values.stageId || undefined, status: 'dodeljen', createdAt: timestamp, updatedAt: timestamp, completedAt: null, billingState: 'not_billable' })
  }

  const handleCreateJobFromCatalog = async (clientId: string, values: CatalogJobFormValues) => {
    const products = readProducts()
    const templates = readProcessTemplates()
    const product = products.find((item) => item.id === values.productId && item.status === 'active' && isProductVisibleForClient(item, clientId))
    const template = product?.processTemplateId
      ? templates.find((item) => item.id === product.processTemplateId)
      : undefined
    const quantity = Number(values.quantity.replace(',', '.'))

    if (!product || !template || !template.steps.length || !Number.isFinite(quantity) || quantity <= 0) return

    const payload = buildCatalogJobPayload({
      clientId,
      product,
      template,
      title: values.title,
      dueDate: values.dueDate || undefined,
      quantity,
      fileLink: values.fileLink,
      note: values.note,
    }, members.map((member) => ({
      id: member.user_id,
      name: member.display_name || member.profile?.full_name || member.profile?.email || member.user_id,
      productionRole: member.production_role || null,
    })))

    const savedProject = await addProject(payload.project)
    if (!savedProject) return

    await Promise.all(payload.tasks.map((task) => addTask({ ...task, projectId: savedProject.id })))
  }

  const handleCreateBillingFromProject = async (project: Project, tasksForBilling: Task[]) => {
    const totalTimeMinutes = tasksForBilling.reduce((sum, task) => sum + (task.timeSpentMinutes ?? 0), 0)
    const totalLaborCost = tasksForBilling.reduce((sum, task) => sum + (task.laborCost ?? 0), 0)
    const totalMaterialCost = tasksForBilling.reduce((sum, task) => sum + (task.materialCost ?? 0), 0)
    const totalCost = totalLaborCost + totalMaterialCost
    const marginPercent = 30
    const amountForFinance = Math.round(totalCost * (1 + marginPercent / 100))
    const record = await createBillingForProject(project.id, { description: `Nalog za naplatu - ${project.title}`, amount: amountForFinance, currency: 'RSD', dueDate: null, invoiceNumber: '', taskCount: tasksForBilling.length, totalTimeMinutes, totalLaborCost, totalMaterialCost, totalCost, marginPercent, netAmount: amountForFinance })
    const client = clientById.get(String(project.clientId))
    const financeMember = members.find((member) => member.role === 'finance')
    const supabase = getSupabaseClient()

    if (record && supabase && activeWorkspace?.id) {
      await supabase.from('billing_records').upsert(
        {
          id: record.id,
          workspace_id: activeWorkspace.id,
          client_id: String(project.clientId),
          project_id: String(project.id),
          client_name: client?.name || record.clientName || '',
          project_name: project.title,
          description: record.description,
          amount: amountForFinance,
          currency: 'RSD',
          due_date: null,
          status: 'ready',
          invoice_number: '',
          task_count: tasksForBilling.length,
          total_tasks: tasksForBilling.length,
          total_time_minutes: totalTimeMinutes,
          total_time: totalTimeMinutes,
          total_labor_cost: totalLaborCost,
          labor_cost: totalLaborCost,
          total_material_cost: totalMaterialCost,
          total_material: totalMaterialCost,
          total_cost: totalCost,
          margin_percent: marginPercent,
          margin: marginPercent,
          net_amount: totalCost,
          total_with_margin: amountForFinance,
          suggested_invoice_amount: amountForFinance,
          assigned_finance_user_id: financeMember?.user_id || null,
          source: 'pulse',
          created_at: record.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          invoiced_at: null,
          paid_at: null,
        },
        { onConflict: 'id' },
      )
    }

    if (record) {
      await Promise.all(tasksForBilling.map((task) => Promise.resolve(updateTask({ ...task, billingState: 'sent_to_billing', billingStatus: 'sent_to_billing', billingId: record.id, updatedAt: new Date().toISOString() }))))
    }
    setModal({ type: 'billing', record: record || { id: '', clientId: project.clientId, projectId: project.id, description: project.title, amount: totalCost, currency: 'RSD', dueDate: null, status: 'draft', invoiceNumber: '', totalLaborCost, totalMaterialCost, totalCost, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })
  }

  return (
    <section className="pulse-phone-screen admin-phone-screen">
      <h2>Pregled poslovanja</h2>
      <section className="pulse-panel pulse-panel-red pulse-signals-panel"><h3>HITNO – BITNO !!!</h3><div className="pulse-ai-line"><span className="pulse-ai-cursor">▌</span>{pulseTypingText || 'PULSE analizira...'}</div><div className="pulse-list">
        {pulseSignals.length ? pulseSignals.map((signal) => <article className={`pulse-item pulse-signal-card pulse-signal-${signal.tone}`} key={signal.id}><div className="pulse-item-title-row"><h4>{signal.title}</h4><span className={`pulse-pill ${signal.tone === 'red' ? 'pulse-pill-red' : signal.tone === 'yellow' ? 'pulse-pill-blue' : 'pulse-pill-cyan'}`}>{signal.badge}</span></div><p>{signal.message}</p><button className="pulse-outline-btn pulse-card-open" type="button" onClick={signal.action}>{signal.actionLabel}</button></article>) : <p className="pulse-empty">Sve je pod kontrolom. Nema kritičnih signala trenutno.</p>}
      </div></section>
      <section className="pulse-panel pulse-panel-green"><h3>MOJ TIM – šta ko radi danas</h3><div className="pulse-list">{teamRoleGroups.length ? teamRoleGroups.map(([roleLabel, roleTasks]) => <div className="pulse-team-role-group" key={roleLabel}><h4 className="pulse-team-role-title">{roleLabel}</h4>{roleTasks.map((task) => { const project = projectById.get(task.projectId); return <article className="pulse-item pulse-team-card" key={task.id}><div className="pulse-item-title-row"><h4>{task.title}</h4><button className="pulse-pill pulse-pill-red" type="button" onClick={() => setModal({ type: 'task', task })}>ZADATAK</button></div>{task.source === 'template' ? <p><span className="pulse-pill pulse-pill-blue">AUTO</span>{task.sourceProductTitle ? <> Iz proizvoda: <strong>{task.sourceProductTitle}</strong></> : null}</p> : null}<p><strong>Operativna rola:</strong> {normalizeRoleLabel(task.requiredRole || task.assignedToLabel)}</p><p>{clientName(String(task.clientId))} – {projectTitle(task.projectId)}</p><p><strong>Rok :</strong> {formatDate(task.dueDate)}</p>{project ? <button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'project', project })}>PROJEKAT</button> : null}</article> })}</div>) : <p className="pulse-empty">Nema aktivnih zadataka.</p>}</div></section>
      <section className="pulse-panel pulse-panel-white"><h3>NAPLATA</h3><div className="pulse-list">{sortedBilling.map((record) => <article className="pulse-item pulse-billing-row" key={record.id} onClick={() => setModal({ type: 'billing', record })}><div className="pulse-item-title-row"><h4>{formatAmount(record)}</h4><span className={`pulse-pill ${record.status === 'overdue' ? 'pulse-pill-red' : record.status === 'paid' ? 'pulse-pill-green' : 'pulse-pill-blue'}`}>{BILLING_STATUS_LABELS[record.status]}</span></div><dl className="pulse-mini-dl"><div><dt>Klijent :</dt><dd>{clientName(record.clientId)}</dd></div><div><dt>Projekat:</dt><dd>{projectTitle(record.projectId)}</dd></div><div><dt>Rok za plaćanje:</dt><dd>{formatDate(record.dueDate)}</dd></div></dl></article>)}</div></section>
      <section className="pulse-panel pulse-panel-blue"><h3>KLIJENTI – score card</h3><input className="pulse-search" placeholder="PRETRAGA" /><div className="pulse-create-row"><button className="pulse-outline-btn" onClick={() => setModal({ type: 'create-client' })}>+ NOVI KLIJENT</button><button className="pulse-outline-btn" onClick={() => setModal({ type: 'create-project' })}>+ NOVI PROJEKAT</button></div><div className="pulse-list">{clientScores.map(({ client, score }) => <article className="pulse-item pulse-client-score" key={client.id}><div className="pulse-item-title-row"><h4>{client.name}</h4><span className="pulse-pill pulse-pill-cyan">PULSE {score}</span></div><p><strong>Tekući projekti</strong> – {projects.find((project) => project.clientId === String(client.id))?.title ?? '-'}</p><p><strong>Naplata :</strong> u roku</p><button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'client', client, score })}>DETALJI</button></article>)}</div></section>
      <AdminModal state={modal} clients={clients} projects={projects} tasks={tasks} billing={billing} onClose={() => setModal(null)} onCreateClient={handleCreateClient} onCreateProject={handleCreateProject} onUpdateClient={async (clientId, patch) => { await updateClient(clientId, patch) }} onCreateTask={handleCreateTask} onCreateJobFromCatalog={handleCreateJobFromCatalog} onCreateBillingFromProject={handleCreateBillingFromProject} />
    </section>
  )
}

export default AdminHome
