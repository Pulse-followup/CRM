import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BillingCard from '../../billing/components/BillingCard'
import { BILLING_STATUS_LABELS } from '../../billing/billingLabels'
import { useBillingStore } from '../../billing/billingStore'
import { readProducts } from '../../products/productStorage'
import { readProcessTemplates } from '../../templates/templateStorage'
import { useCloudStore } from '../../cloud/cloudStore'
import { getSupabaseClient } from '../../../lib/supabaseClient'
import '../../clients/pages/client-detail.css'
import CreateTaskForm from '../../tasks/components/CreateTaskForm'
import type { CreateTaskFormValues } from '../../tasks/components/CreateTaskForm'
import TaskList from '../../tasks/components/TaskList'
import {
  getCompletedTasks,
  getTasksByProject as selectTasksByProject,
  getTasksByStage,
  getTasksWithoutStage,
} from '../../tasks/taskSelectors'
import { useTaskStore } from '../../tasks/taskStore'
import type { Task } from '../../tasks/types'
import {
  PROJECT_FREQUENCY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../projectLabels'
import { getProjectHealth } from '../projectHealth'
import { useProjectStore } from '../projectStore'
import { PROJECT_STAGE_ROLE_LABELS } from '../projectTemplates'
import { getProjectStageProgress } from '../projectWorkflow'

function getStageTone(status: 'locked' | 'active' | 'done') {
  switch (status) {
    case 'done': return 'success'
    case 'active': return 'info'
    default: return 'muted'
  }
}

function getStageLabel(status: 'locked' | 'active' | 'done') {
  switch (status) {
    case 'done': return 'Done'
    case 'active': return 'Active'
    default: return 'Locked'
  }
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString('sr-RS')} RSD`
}


function getWorkflowSummary(tasks: Task[]) {
  const workflowTasks = tasks
    .filter((task) => task.source === 'template' || task.sequenceOrder)
    .slice()
    .sort((first, second) => (first.sequenceOrder || 999) - (second.sequenceOrder || 999))
  const total = workflowTasks.length
  const completed = workflowTasks.filter((task) => task.status === 'zavrsen' || task.status === 'naplacen').length
  const activeTask = workflowTasks.find((task) => task.status === 'dodeljen' || task.status === 'u_radu')
  const progress = total ? Math.round((completed / total) * 100) : 0
  return { total, completed, activeTask, progress }
}

function getEffectiveStageStatus(_stageId: string, stageTasks: Task[]) {
  if (!stageTasks.length) return 'locked' as const
  if (stageTasks.every((task) => task.status === 'zavrsen' || task.status === 'naplacen')) return 'done' as const
  if (stageTasks.some((task) => task.status === 'dodeljen' || task.status === 'u_radu')) return 'active' as const
  return 'locked' as const
}

function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const projectId = id ?? ''
  const { getProjectById } = useProjectStore()
  const { activeWorkspace, members } = useCloudStore()
  const project = getProjectById(projectId)
  const { tasks: allTasks, updateTask, addTask } = useTaskStore()
  const { getActiveBillingByProjectId, createBillingForProject } = useBillingStore()
  const tasks = selectTasksByProject(allTasks, projectId)
  const projectHealth = getProjectHealth(projectId, tasks)
  const activeBilling = getActiveBillingByProjectId(projectId)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingBilling, setIsCreatingBilling] = useState(false)
  const [marginPercent, setMarginPercent] = useState('30')
  const products = readProducts()
  const processTemplates = readProcessTemplates()
  const projectSourceProductTitle = project?.sourceProductTitle || products.find((product) => product.id === project?.sourceProductId)?.title || ''
  const projectSourceTemplateTitle = project?.sourceTemplateTitle || processTemplates.find((template) => template.id === project?.sourceTemplateId)?.title || ''
  const workflowSummary = useMemo(() => getWorkflowSummary(tasks), [tasks])

  const stageProgress = useMemo(() => (project ? getProjectStageProgress(project, tasks) : []), [project, tasks])
  const tasksWithoutStage = useMemo(() => getTasksWithoutStage(tasks), [tasks])
  const projectHasBilling = Boolean(
    activeBilling ||
    (project?.billingId && project.billingStatus && project.billingStatus !== 'cancelled')
  )
  const billableTasks = useMemo(
    () => projectHasBilling ? [] : tasks.filter((task) => task.status === 'zavrsen' && !task.billingId && task.billingState !== 'sent_to_billing' && task.billingState !== 'billed'),
    [projectHasBilling, tasks],
  )
  const billingPreview = useMemo(() => {
    const totalTimeMinutes = billableTasks.reduce((sum, task) => sum + (task.timeSpentMinutes ?? 0), 0)
    const totalLaborCost = billableTasks.reduce((sum, task) => sum + (task.laborCost ?? 0), 0)
    const totalMaterialCost = billableTasks.reduce((sum, task) => sum + (task.materialCost ?? 0), 0)
    const netAmount = totalLaborCost + totalMaterialCost
    const margin = Number(marginPercent)
    const suggestedAmount = Number.isFinite(margin) ? Math.round(netAmount * (1 + margin / 100)) : netAmount
    return { taskCount: billableTasks.length, totalTimeMinutes, totalLaborCost, totalMaterialCost, netAmount, suggestedAmount, marginPercent: Number.isFinite(margin) ? margin : 0 }
  }, [billableTasks, marginPercent])

  const handleTaskChange = (updatedTask: Task) => { updateTask(updatedTask) }

  const handleCreateTask = (values: CreateTaskFormValues) => {
    if (!project) return
    const timestamp = new Date().toISOString()
    const activeStage = project.stages?.find((stage) => stage.status === 'active')
    const nextTask: Task = {
      id: makeId('task'),
      clientId: project.clientId,
      projectId: project.id,
      title: values.title.trim() || 'Novi task',
      description: values.description.trim(),
      type: values.type || undefined,
      assignedToUserId: values.assignedToUserId,
      assignedToLabel: values.assignedToLabel.trim(),
      dueDate: values.dueDate || undefined,
      stageId: values.stageId || activeStage?.id,
      status: 'dodeljen',
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      billingState: 'not_billable',
    }
    void addTask(nextTask)
    setIsCreatingTask(false)
  }

  const handleCreateBilling = async () => {
    if (!project || billingPreview.taskCount === 0) return
    const record = await createBillingForProject(project.id, {
      description: `Nalog za naplatu - ${project.title}`,
      amount: billingPreview.suggestedAmount,
      currency: 'RSD',
      dueDate: null,
      invoiceNumber: '',
      taskCount: billingPreview.taskCount,
      totalTimeMinutes: billingPreview.totalTimeMinutes,
      totalLaborCost: billingPreview.totalLaborCost,
      totalMaterialCost: billingPreview.totalMaterialCost,
      totalCost: billingPreview.netAmount,
      marginPercent: billingPreview.marginPercent,
      netAmount: billingPreview.netAmount,
    })
    const financeMember = members.find((member) => member.role === 'finance')
    const supabase = getSupabaseClient()

    if (record && supabase && activeWorkspace?.id && project) {
      await supabase.from('billing_records').upsert(
        {
          id: record.id,
          workspace_id: activeWorkspace.id,
          client_id: String(project.clientId),
          project_id: String(project.id),
          client_name: record.clientName || '',
          project_name: project.title,
          description: record.description,
          amount: billingPreview.suggestedAmount,
          currency: 'RSD',
          due_date: null,
          status: 'ready',
          invoice_number: '',
          task_count: billingPreview.taskCount,
          total_tasks: billingPreview.taskCount,
          total_time_minutes: billingPreview.totalTimeMinutes,
          total_time: billingPreview.totalTimeMinutes,
          total_labor_cost: billingPreview.totalLaborCost,
          labor_cost: billingPreview.totalLaborCost,
          total_material_cost: billingPreview.totalMaterialCost,
          total_material: billingPreview.totalMaterialCost,
          total_cost: billingPreview.netAmount,
          margin_percent: billingPreview.marginPercent,
          margin: billingPreview.marginPercent,
          net_amount: billingPreview.netAmount,
          total_with_margin: billingPreview.suggestedAmount,
          suggested_invoice_amount: billingPreview.suggestedAmount,
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
      billableTasks.forEach((task) => {
        void updateTask({ ...task, billingId: record.id, billingState: 'sent_to_billing', billingStatus: 'sent_to_billing', updatedAt: new Date().toISOString() })
      })
    }
    setIsCreatingBilling(false)
  }

  if (!project) {
    return <section className="page-card client-detail-shell"><button type="button" className="secondary-link-button" onClick={() => navigate('/projects')}>Nazad na projekte</button><div className="clients-empty-state"><h2>Projekat nije pronadjen</h2><p>Vrati se na projekte i izaberi postojeci zapis.</p></div></section>
  }

  return (
    <section className="page-card client-detail-shell">
      <button type="button" className="secondary-link-button" onClick={() => navigate("/")}>Nazad na dashboard</button>
      <header className="customer-card-header"><div><h2 className="customer-card-title">{project.title}</h2><p className="customer-card-subtitle">Projekat</p>{projectSourceProductTitle ? <p className="customer-source-note">Kreirano iz proizvoda: <strong>{projectSourceProductTitle}</strong>{projectSourceTemplateTitle ? ` · Šablon: ${projectSourceTemplateTitle}` : ''}</p> : null}{workflowSummary.total ? <p className="customer-source-note">Proces: <strong>{workflowSummary.completed}/{workflowSummary.total}</strong> · {workflowSummary.progress}%{workflowSummary.activeTask ? ` · Trenutni korak: ${workflowSummary.activeTask.requiredRole || workflowSummary.activeTask.title}` : ''}</p> : null}</div><div className="customer-project-badges"><span className="customer-status-badge">{PROJECT_STATUS_LABELS[project.status]}</span><span className={`customer-status-badge is-${projectHealth.tone}`}>{projectHealth.label}</span>{projectSourceProductTitle ? <span className="customer-status-badge is-info">IZ PROIZVODA</span> : null}</div></header>

      <section className="customer-card-section"><div className="customer-card-section-head"><h3>Osnovni podaci</h3></div><div className="customer-card-group"><dl className="customer-card-detail-list"><div><dt>Status</dt><dd>{PROJECT_STATUS_LABELS[project.status]}</dd></div><div><dt>Tip</dt><dd>{project.type ? PROJECT_TYPE_LABELS[project.type] : '-'}</dd></div><div><dt>Frekvencija</dt><dd>{project.frequency ? PROJECT_FREQUENCY_LABELS[project.frequency] : '-'}</dd></div><div><dt>Vrednost</dt><dd>{project.value ? `${project.value} RSD` : '-'}</dd></div><div><dt>Billing status</dt><dd>{project.billingStatus ? BILLING_STATUS_LABELS[project.billingStatus] : '-'}</dd></div></dl></div></section>

      <section className="customer-card-section"><div className="customer-card-section-head"><h3>Workflow projekta</h3></div>{project.stages?.length ? <div className="customer-workflow-list">{project.stages.slice().sort((l, r) => l.order - r.order).map((stage) => { const progress = stageProgress.find((item) => item.stageId === stage.id); const stageTasks = getTasksByStage(tasks, stage.id); const roleLabel = stage.defaultRole ? PROJECT_STAGE_ROLE_LABELS[stage.defaultRole as keyof typeof PROJECT_STAGE_ROLE_LABELS] ?? stage.defaultRole : null; const effectiveStatus = getEffectiveStageStatus(stage.id, stageTasks); return <div className="customer-workflow-stage customer-workflow-stage-block" key={stage.id}><div className="customer-workflow-stage-top"><div><strong>{stage.order}. {stage.name}</strong>{roleLabel ? <p>Preporucena rola: {roleLabel}</p> : null}</div><span className={`customer-status-badge is-${getStageTone(effectiveStatus)}`}>{getStageLabel(effectiveStatus)}</span></div><div className="customer-workflow-stage-metrics"><span>Taskovi: {progress?.totalTasks ?? 0}</span><span>Zavrseni: {progress?.completedTasks ?? 0}</span><span>Aktivni: {progress?.activeTasks ?? 0}</span></div>{stageTasks.length ? <TaskList tasks={stageTasks} onTaskChange={handleTaskChange} /> : <div className="customer-task-empty">Nema taskova u ovoj fazi</div>}</div> })}{tasksWithoutStage.length ? <div className="customer-workflow-stage customer-workflow-stage-block"><div className="customer-workflow-stage-top"><div><strong>Bez faze</strong><p>Taskovi koji jos nisu vezani za workflow fazu.</p></div><span className="customer-status-badge is-muted">Neutral</span></div><div className="customer-workflow-stage-metrics"><span>Taskovi: {tasksWithoutStage.length}</span><span>Zavrseni: {getCompletedTasks(tasksWithoutStage).length}</span></div><TaskList tasks={tasksWithoutStage} onTaskChange={handleTaskChange} /></div> : null}</div> : <div className="customer-card-empty">Workflow jos nije definisan za ovaj projekat.</div>}</section>

      <section className="customer-card-section"><div className="customer-card-section-head"><h3>Naplata</h3>{!activeBilling ? <button type="button" className="customer-project-toggle" onClick={() => setIsCreatingBilling((current) => !current)}>{isCreatingBilling ? 'Sakrij nalog' : 'Kreiraj nalog za naplatu'}</button> : null}</div>{!activeBilling && isCreatingBilling ? <div className="customer-card-group"><h4>Predlog naloga za naplatu</h4><dl className="customer-card-detail-list"><div><dt>Broj taskova</dt><dd>{billingPreview.taskCount}</dd></div><div><dt>Ukupno vreme</dt><dd>{billingPreview.totalTimeMinutes} min</dd></div><div><dt>Rad / satnice</dt><dd>{formatMoney(billingPreview.totalLaborCost)}</dd></div><div><dt>Materijal</dt><dd>{formatMoney(billingPreview.totalMaterialCost)}</dd></div><div><dt>Neto interno</dt><dd>{formatMoney(billingPreview.netAmount)}</dd></div></dl><label className="pulse-form-field"><span>Marza / korekcija (%)</span><input type="number" value={marginPercent} onChange={(event) => setMarginPercent(event.target.value)} /></label><p><strong>Predlog iznosa za Finance:</strong> {formatMoney(billingPreview.suggestedAmount)}</p><div className="pulse-modal-actions"><button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={handleCreateBilling} disabled={billingPreview.taskCount === 0}>POŠALJI NA FAKTURISANJE</button><button className="pulse-modal-btn pulse-modal-btn-red" type="button" onClick={() => setIsCreatingBilling(false)}>OTKAŽI</button></div></div> : null}{activeBilling ? <BillingCard record={activeBilling} projectTitle={project.title} /> : !isCreatingBilling ? <div className="customer-card-empty">Nema billing naloga za ovaj projekat.</div> : null}</section>

      <section className="customer-card-section"><div className="customer-card-section-head"><h3>Taskovi</h3><button type="button" className="customer-project-toggle" onClick={() => setIsCreatingTask((current) => !current)}>{isCreatingTask ? 'Sakrij formu' : 'Novi task'}</button></div>{isCreatingTask ? <CreateTaskForm onCancel={() => setIsCreatingTask(false)} onSubmit={handleCreateTask} requireProjectSelection={false} initialProjectId={project.id} projectOptions={[{ id: project.id, label: project.title, stages: project.stages }]} /> : null}<TaskList tasks={tasks} onTaskChange={handleTaskChange} /></section>
    </section>
  )
}

export default ProjectDetail
