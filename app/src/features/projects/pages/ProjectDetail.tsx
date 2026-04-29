import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BillingForm from '../../billing/components/BillingForm'
import BillingCard from '../../billing/components/BillingCard'
import { BILLING_STATUS_LABELS } from '../../billing/billingLabels'
import { useBillingStore } from '../../billing/billingStore'
import type { CreateBillingPayload } from '../../billing/types'
import CreateTaskForm from '../../tasks/components/CreateTaskForm'
import type { CreateTaskFormValues } from '../../tasks/components/CreateTaskForm'
import TaskList from '../../tasks/components/TaskList'
import type { Task } from '../../tasks/types'
import { useTaskStore } from '../../tasks/taskStore'
import {
  PROJECT_FREQUENCY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../projectLabels'
import { getProjectHealth } from '../projectHealth'
import { useProjectStore } from '../projectStore'
import '../../clients/pages/client-detail.css'

function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const projectId = id ?? ''
  const { getProjectById } = useProjectStore()
  const project = getProjectById(projectId)
  const { getTasksByProjectId, updateTask, addTask } = useTaskStore()
  const {
    getActiveBillingByProjectId,
    createBillingForProject,
    markBillingInvoiced,
    markBillingOverdue,
    markBillingPaid,
  } = useBillingStore()
  const tasks = getTasksByProjectId(projectId)
  const projectHealth = getProjectHealth(projectId, tasks)
  const activeBilling = getActiveBillingByProjectId(projectId)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isCreatingBilling, setIsCreatingBilling] = useState(false)

  const handleTaskChange = (updatedTask: Task) => {
    updateTask(updatedTask)
  }

  const handleCreateTask = (values: CreateTaskFormValues) => {
    if (!project) return

    const nextTask: Task = {
      id: `task-${Date.now()}`,
      clientId: project.clientId,
      projectId: project.id,
      title: values.title.trim() || 'Novi task',
      description: values.description.trim(),
      type: values.type || undefined,
      assignedToUserId: values.assignedToUserId,
      assignedToLabel: values.assignedToLabel.trim(),
      dueDate: values.dueDate || undefined,
      status: 'dodeljen',
    }

    addTask(nextTask)
    setIsCreatingTask(false)
  }

  const handleCreateBilling = (values: CreateBillingPayload) => {
    if (!project) return

    const totalLaborCost = tasks.reduce((sum, task) => sum + (task.laborCost ?? 0), 0)
    const totalMaterialCost = tasks.reduce((sum, task) => sum + (task.materialCost ?? 0), 0)
    const totalCost = totalLaborCost + totalMaterialCost

    createBillingForProject(project.id, {
      ...values,
      totalLaborCost,
      totalMaterialCost,
      totalCost,
    })
    setIsCreatingBilling(false)
  }

  if (!project) {
    return (
      <section className="page-card client-detail-shell">
        <button
          type="button"
          className="secondary-link-button"
          onClick={() => navigate('/projects')}
        >
          Nazad na projekte
        </button>

        <div className="clients-empty-state">
          <h2>Projekat nije pronadjen</h2>
          <p>Vrati se na projekte i izaberi postojeci zapis.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-card client-detail-shell">
      <button
        type="button"
        className="secondary-link-button"
        onClick={() => navigate(`/clients/${project.clientId}`)}
      >
        Nazad na klijenta
      </button>

      <header className="customer-card-header">
        <div>
          <h2 className="customer-card-title">{project.title}</h2>
          <p className="customer-card-subtitle">Projekat</p>
        </div>
        <div className="customer-project-badges">
          <span className="customer-status-badge">{PROJECT_STATUS_LABELS[project.status]}</span>
          <span className={`customer-status-badge is-${projectHealth.tone}`}>
            {projectHealth.label}
          </span>
        </div>
      </header>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Osnovni podaci</h3>
        </div>

        <div className="customer-card-group">
          <dl className="customer-card-detail-list">
            <div>
              <dt>Status</dt>
              <dd>{PROJECT_STATUS_LABELS[project.status]}</dd>
            </div>
            <div>
              <dt>Tip</dt>
              <dd>{project.type ? PROJECT_TYPE_LABELS[project.type] : '-'}</dd>
            </div>
            <div>
              <dt>Frekvencija</dt>
              <dd>{project.frequency ? PROJECT_FREQUENCY_LABELS[project.frequency] : '-'}</dd>
            </div>
            <div>
              <dt>Vrednost</dt>
              <dd>{project.value ? `${project.value} RSD` : '-'}</dd>
            </div>
            <div>
              <dt>Billing status</dt>
              <dd>{project.billingStatus ? BILLING_STATUS_LABELS[project.billingStatus] : '-'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Naplata</h3>
          {!activeBilling ? (
            <button
              type="button"
              className="customer-project-toggle"
              onClick={() => setIsCreatingBilling((current) => !current)}
            >
              {isCreatingBilling ? 'Sakrij formu' : 'Kreiraj nalog za naplatu'}
            </button>
          ) : null}
        </div>

        {!activeBilling && isCreatingBilling ? (
          <BillingForm
            onCancel={() => setIsCreatingBilling(false)}
            onSubmit={handleCreateBilling}
            initialDescription={project.title}
          />
        ) : null}

        {activeBilling ? (
          <BillingCard
            record={activeBilling}
            projectTitle={project.title}
            onMarkInvoiced={activeBilling.status === 'draft' ? () => markBillingInvoiced(activeBilling.id) : undefined}
            onMarkOverdue={activeBilling.status === 'invoiced' ? () => markBillingOverdue(activeBilling.id) : undefined}
            onMarkPaid={activeBilling.status === 'invoiced' || activeBilling.status === 'overdue' ? () => markBillingPaid(activeBilling.id) : undefined}
          />
        ) : (
          !isCreatingBilling ? <div className="customer-card-empty">Nema billing naloga za ovaj projekat.</div> : null
        )}
      </section>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Taskovi</h3>
          <button
            type="button"
            className="customer-project-toggle"
            onClick={() => setIsCreatingTask((current) => !current)}
          >
            {isCreatingTask ? 'Sakrij formu' : 'Novi task'}
          </button>
        </div>

        {isCreatingTask ? (
          <CreateTaskForm
            onCancel={() => setIsCreatingTask(false)}
            onSubmit={handleCreateTask}
            requireProjectSelection={false}
          />
        ) : null}

        <TaskList tasks={tasks} onTaskChange={handleTaskChange} />
      </section>
    </section>
  )
}

export default ProjectDetail
