import { useMemo, useState } from 'react'
import { BILLING_STATUS_LABELS } from '../features/billing/billingLabels'
import { useBillingStore } from '../features/billing/billingStore'
import type { BillingRecord } from '../features/billing/types'
import { useClientStore } from '../features/clients/clientStore'
import type { Client } from '../features/clients/types'
import ClientCreateForm, { type ClientCreateFormValues } from '../features/clients/components/ClientCreateForm'
import ClientEditForm, { type ClientEditFormPatch } from '../features/clients/components/ClientEditForm'
import ClientInfoSection from '../features/clients/components/ClientInfoSection'
import ClientContactsSection from '../features/clients/components/ClientContactsSection'
import ClientCommercialSection from '../features/clients/components/ClientCommercialSection'
import ClientProjectsSection from '../features/clients/components/ClientProjectsSection'
import { useProjectStore } from '../features/projects/projectStore'
import type { Project, ProjectStage } from '../features/projects/types'
import ProjectForm, { type ProjectFormValues } from '../features/projects/components/ProjectForm'
import { buildStagesFromTemplate, getTemplateIdForProjectType } from '../features/projects/projectTemplates'
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

function getStageDueDate(stage?: ProjectStage) {
  return stage ? (stage as { dueDate?: string | null }).dueDate : undefined
}

function findOverdueStage(project: Project) {
  return project.stages?.find((stage) => {
    const dueDate = getStageDueDate(stage)
    return dueDate ? isOverdueDate(dueDate) : false
  })
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
  activeBilling,
  onCreateBilling,
}: {
  project: Project
  tasks: Task[]
  activeBilling: BillingRecord | null
  onCreateBilling: (project: Project, tasksForBilling: Task[]) => void | Promise<void>
}) {
  const completedTasks = tasks.filter((task) => task.status === 'zavrsen')
  const unbilledCompletedTasks = completedTasks.filter((task) => task.billingState !== 'sent_to_billing' && task.billingState !== 'billed' && !task.billingId)
  const totalLaborCost = unbilledCompletedTasks.reduce((sum, task) => sum + (task.laborCost ?? 0), 0)
  const totalMaterialCost = unbilledCompletedTasks.reduce((sum, task) => sum + (task.materialCost ?? 0), 0)
  const totalCost = totalLaborCost + totalMaterialCost

  return (
    <>
      <h3>Detalji projekta</h3>
      <p><strong>{project.title}</strong></p>
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

function ClientCardDrawer({ client, score, projects, onClose, onUpdateClient, onCreateProject, onCreateTask }: { client: Client; score: number; projects: Project[]; onClose: () => void; onUpdateClient: (patch: ClientEditFormPatch) => void; onCreateProject: (values: ProjectFormValues) => void | Promise<void>; onCreateTask: (values: CreateTaskFormValues) => void | Promise<void> }) {
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isCreatingActivity, setIsCreatingActivity] = useState(false)

  return (
    <div className="pulse-client-drawer-content">
      <div className="pulse-client-drawer-head">
        <div><h3>{client.name}</h3><p>{client.city || '-'}</p></div>
        <span className="pulse-pill pulse-pill-cyan">PULSE {score}</span>
      </div>
      <div className="pulse-client-drawer-actions">
        <button type="button" className="customer-project-toggle" onClick={() => setIsEditingClient((value) => !value)}>Izmeni podatke</button>
        <button type="button" className="customer-project-toggle" onClick={() => setIsCreatingActivity((value) => !value)}>Nova aktivnost</button>
        <button type="button" className="customer-project-toggle" onClick={() => setIsCreatingProject((value) => !value)}>Novi projekat</button>
      </div>
      {isEditingClient ? <ClientEditForm client={client} onCancel={() => setIsEditingClient(false)} onSubmit={(patch) => { onUpdateClient(patch); setIsEditingClient(false) }} /> : null}
      {isCreatingProject ? <ProjectForm onCancel={() => setIsCreatingProject(false)} onSubmit={async (values) => { await onCreateProject(values); setIsCreatingProject(false) }} /> : null}
      {isCreatingActivity ? <CreateTaskForm onCancel={() => setIsCreatingActivity(false)} onSubmit={(values) => { onCreateTask(values); setIsCreatingActivity(false) }} requireProjectSelection projectOptions={projects.map((project) => ({ id: project.id, label: project.title, stages: project.stages }))} /> : null}
      <ClientInfoSection name={client.name} city={client.city} address={client.address} />
      <ClientContactsSection contacts={client.contacts} />
      <ClientCommercialSection {...client.commercial} />
      <ClientProjectsSection projects={projects} />
      <div className="pulse-modal-actions"><button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onClose}>Zatvori</button></div>
    </div>
  )
}

function AdminModal({ state, clients, projects, tasks, billing, onClose, onCreateClient, onCreateProject, onUpdateClient, onCreateTask, onCreateBillingFromProject }: { state: ModalState; clients: Client[]; projects: Project[]; tasks: Task[]; billing: BillingRecord[]; onClose: () => void; onCreateClient: (values: ClientCreateFormValues) => void | Promise<void>; onCreateProject: (clientId: string, values: ProjectFormValues) => void | Promise<void>; onUpdateClient: (clientId: string, patch: ClientEditFormPatch) => void | Promise<void>; onCreateTask: (clientId: string, values: CreateTaskFormValues) => void | Promise<void>; onCreateBillingFromProject: (project: Project, tasksForBilling: Task[]) => void | Promise<void> }) {
  if (!state) return null
  const clientProjects = state.type === 'client' ? projects.filter((project) => project.clientId === String(state.client.id)) : []
  const projectTasks = state.type === 'project' ? tasks.filter((task) => task.projectId === state.project.id) : []
  const activeBilling = state.type === 'project' ? billing.find((record) => record.projectId === state.project.id && record.status !== 'paid' && record.status !== 'cancelled') ?? null : null

  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div className={`pulse-modal ${state.type === 'client' ? 'pulse-client-drawer' : ''} ${state.type === 'create-client' ? 'pulse-create-client-modal' : ''} ${state.type === 'create-project' ? 'pulse-create-project-modal' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
        <button className="pulse-modal-x" type="button" onClick={onClose}>x</button>
        {state.type === 'billing' ? <><h3>Detalji naplatnog naloga</h3><p><strong>Iznos</strong> - {formatAmount(state.record)}</p><p><strong>Opis</strong> - {state.record.description}</p><p><strong>Rok</strong> - {formatDate(state.record.dueDate)}</p><p><strong>Status</strong> - {BILLING_STATUS_LABELS[state.record.status]}</p><p><strong>Faktura</strong> - {state.record.invoiceNumber || '-'}</p></> : null}
        {state.type === 'task' ? <><h3>Detalji zadatka</h3><p><strong>{state.task.title}</strong></p><p>Tip - {state.task.type || '-'}</p><p>Status - {TASK_STATUS_LABELS[state.task.status] ?? state.task.status}</p><p>Rok - {formatDate(state.task.dueDate)}</p><p>Dodeljeno - {state.task.assignedToLabel || '-'}</p><p>Opis - {state.task.description || '-'}</p><p>Vreme - {state.task.timeSpentMinutes ?? 0} min</p><p>Materijal - {formatAmountValue(state.task.materialCost ?? 0)}</p></> : null}
        {state.type === 'project' ? <ProjectDetailModal project={state.project} tasks={projectTasks} activeBilling={activeBilling} onCreateBilling={onCreateBillingFromProject} /> : null}
        {state.type === 'client' ? <ClientCardDrawer client={state.client} score={state.score} projects={clientProjects} onClose={onClose} onUpdateClient={(patch) => onUpdateClient(String(state.client.id), patch)} onCreateProject={(values) => onCreateProject(String(state.client.id), values)} onCreateTask={(values) => onCreateTask(String(state.client.id), values)} /> : null}
        {state.type === 'create-client' ? <><h3>+ Novi klijent</h3><ClientCreateForm onCancel={onClose} onSubmit={onCreateClient} /></> : null}
        {state.type === 'create-project' ? <><h3>+ Novi projekat</h3><ProjectCreateModal clients={clients} initialClientId={state.clientId} onCancel={onClose} onSubmit={onCreateProject} /></> : null}
      </div>
    </div>
  )
}

function AdminHome() {
  const { activeWorkspace, members } = useCloudStore()
  const { clients, addClient, updateClient } = useClientStore()
  const { projects, addProject } = useProjectStore()
  const { tasks, addTask, updateTask } = useTaskStore()
  const { getAllBilling, createBillingForProject } = useBillingStore()
  const [modal, setModal] = useState<ModalState>(null)
  const billing = getAllBilling()

  const clientById = useMemo(() => new Map(clients.map((client) => [String(client.id), client])), [clients])
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])
  const clientName = (id: string) => clientById.get(String(id))?.name ?? 'Nepoznat klijent'
  const projectTitle = (id: string) => projectById.get(id)?.title ?? 'Nepoznat projekat'

  const urgentBilling = billing.filter((record) => record.status === 'overdue' || isOverdueDate(record.dueDate))
  const lateTasks = getLateTasks(tasks).filter((task) => task.clientId && task.projectId && clientById.has(String(task.clientId)) && projectById.has(task.projectId))
  const riskyProjects = projects.filter((project) => Boolean(findOverdueStage(project)))
  const validLinkedTasks = tasks.filter((task) => task.clientId && task.projectId && clientById.has(String(task.clientId)) && projectById.has(task.projectId))
  const teamTasks = validLinkedTasks.filter((task) => ['dodeljen', 'u_radu', 'na_cekanju'].includes(task.status))
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
      <section className="pulse-panel pulse-panel-red"><h3>HITNO – BITNO !!!</h3><div className="pulse-list">
        {urgentBilling.map((record) => <article className="pulse-item" key={`billing-${record.id}`}><div className="pulse-item-title-row"><h4>Naplati projekat !</h4><span className="pulse-pill pulse-pill-red">KASNI</span></div><dl className="pulse-mini-dl"><div><dt>Klijent :</dt><dd>{clientName(record.clientId)}</dd></div><div><dt>Projekat:</dt><dd>{projectTitle(record.projectId)}</dd></div><div><dt>Rok za plaćanje:</dt><dd>{formatDate(record.dueDate)}</dd></div></dl><button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'billing', record })}>OTVORI</button></article>)}
        {riskyProjects.map((project) => <article className="pulse-item" key={`project-${project.id}`}><div className="pulse-item-title-row"><h4>FAZA KASNI {daysLate(getStageDueDate(findOverdueStage(project)))} DANA !!!</h4></div><dl className="pulse-mini-dl"><div><dt>Klijent :</dt><dd>{clientName(project.clientId)}</dd></div><div><dt>Projekat:</dt><dd>{project.title}</dd></div><div><dt>Rok :</dt><dd>{formatDate(getStageDueDate(findOverdueStage(project)))}</dd></div></dl><button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'project', project })}>OTVORI</button></article>)}
        {lateTasks.map((task) => <article className="pulse-item" key={`task-${task.id}`}><div className="pulse-item-title-row"><h4>{task.title}</h4><span className="pulse-pill pulse-pill-red">ZADATAK</span></div><dl className="pulse-mini-dl"><div><dt>Klijent :</dt><dd>{clientName(String(task.clientId))}</dd></div><div><dt>Projekat:</dt><dd>{projectTitle(task.projectId)}</dd></div><div><dt>Rok :</dt><dd>{formatDate(task.dueDate)}</dd></div></dl><button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'task', task })}>OTVORI</button></article>)}
        {urgentBilling.length + riskyProjects.length + lateTasks.length === 0 ? <p className="pulse-empty">Nema hitnih stavki.</p> : null}
      </div></section>
      <section className="pulse-panel pulse-panel-green"><h3>MOJ TIM – šta ko radi danas</h3><div className="pulse-list">{teamTasks.length ? teamTasks.map((task) => { const project = projectById.get(task.projectId); return <article className="pulse-item pulse-team-card" key={task.id}><div className="pulse-item-title-row"><h4>{task.assignedToLabel || 'Bez dodele'}</h4><button className="pulse-pill pulse-pill-red" type="button" onClick={() => setModal({ type: 'task', task })}>ZADATAK</button></div><p>{clientName(String(task.clientId))} – {projectTitle(task.projectId)}</p><p><strong>Rok :</strong> {formatDate(task.dueDate)}</p>{project ? <button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'project', project })}>PROJEKAT</button> : null}</article> }) : <p className="pulse-empty">Nema aktivnih zadataka.</p>}</div></section>
      <section className="pulse-panel pulse-panel-white"><h3>NAPLATA</h3><div className="pulse-list">{sortedBilling.map((record) => <article className="pulse-item pulse-billing-row" key={record.id} onClick={() => setModal({ type: 'billing', record })}><div className="pulse-item-title-row"><h4>{formatAmount(record)}</h4><span className={`pulse-pill ${record.status === 'overdue' ? 'pulse-pill-red' : record.status === 'paid' ? 'pulse-pill-green' : 'pulse-pill-blue'}`}>{BILLING_STATUS_LABELS[record.status]}</span></div><dl className="pulse-mini-dl"><div><dt>Klijent :</dt><dd>{clientName(record.clientId)}</dd></div><div><dt>Projekat:</dt><dd>{projectTitle(record.projectId)}</dd></div><div><dt>Rok za plaćanje:</dt><dd>{formatDate(record.dueDate)}</dd></div></dl></article>)}</div></section>
      <section className="pulse-panel pulse-panel-blue"><h3>KLIJENTI – score card</h3><input className="pulse-search" placeholder="PRETRAGA" /><div className="pulse-create-row"><button className="pulse-outline-btn" onClick={() => setModal({ type: 'create-client' })}>+ NOVI KLIJENT</button><button className="pulse-outline-btn" onClick={() => setModal({ type: 'create-project' })}>+ NOVI PROJEKAT</button></div><div className="pulse-list">{clientScores.map(({ client, score }) => <article className="pulse-item pulse-client-score" key={client.id}><div className="pulse-item-title-row"><h4>{client.name}</h4><span className="pulse-pill pulse-pill-cyan">PULSE {score}</span></div><p><strong>Tekući projekti</strong> – {projects.find((project) => project.clientId === String(client.id))?.title ?? '-'}</p><p><strong>Naplata :</strong> u roku</p><button className="pulse-outline-btn pulse-card-open" type="button" onClick={() => setModal({ type: 'client', client, score })}>DETALJI</button></article>)}</div></section>
      <AdminModal state={modal} clients={clients} projects={projects} tasks={tasks} billing={billing} onClose={() => setModal(null)} onCreateClient={handleCreateClient} onCreateProject={handleCreateProject} onUpdateClient={async (clientId, patch) => { await updateClient(clientId, patch) }} onCreateTask={handleCreateTask} onCreateBillingFromProject={handleCreateBillingFromProject} />
    </section>
  )
}

export default AdminHome
