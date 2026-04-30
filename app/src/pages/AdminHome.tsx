import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BILLING_STATUS_LABELS } from '../features/billing/billingLabels'
import { useBillingStore } from '../features/billing/billingStore'
import type { BillingRecord, BillingStatus } from '../features/billing/types'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'
import { getProjectHealth } from '../features/projects/projectHealth'
import { getProjectStageProgress } from '../features/projects/projectWorkflow'
import { calculateClientScore } from '../features/scoring/scoringEngine'
import { TASK_STATUS_LABELS } from '../features/tasks/taskLabels'
import { getCompletedTasks, getLateTasks, getTasksByStatus, getTodayTasks } from '../features/tasks/taskSelectors'
import { useTaskStore } from '../features/tasks/taskStore'
import type { Task } from '../features/tasks/types'

const MAX_PRIORITY_ITEMS = 5
const MAX_TASKS_PER_COLUMN = 3
const MAX_PROJECTS = 5
const MAX_BILLING_ITEMS = 5
const MAX_CLIENTS = 3
const ADMIN_BILLING_STATUSES = ['draft', 'invoiced', 'overdue', 'paid'] as const

type PriorityTone = 'danger' | 'warning' | 'info' | 'success' | 'muted'

interface PriorityItem {
  id: string
  typeLabel: string
  description: string
  context?: string
  tone: PriorityTone
  href: string
}

function formatDueDate(value?: string | null) {
  if (!value) {
    return 'Bez roka'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatAmount(amount: number | null, currency = 'RSD') {
  if (typeof amount !== 'number') {
    return '-'
  }

  return `${amount} ${currency}`
}

function getProjectHealthPresentation(projectId: string, tasks: Task[]) {
  const health = getProjectHealth(projectId, tasks)

  const labels = {
    no_tasks: 'Nema taskova',
    late: 'Kasni',
    waiting: 'Na ?ekanju',
    active: 'U toku',
    done: 'Zavr?eno',
  } as const

  return {
    ...health,
    label: labels[health.key],
  }
}

function getPriorityLabel(priority: 'low' | 'medium' | 'high') {
  if (priority === 'high') return 'Visok prioritet'
  if (priority === 'medium') return 'Srednji prioritet'
  return 'Nizak prioritet'
}

function getPriorityToneFromScore(priority: 'low' | 'medium' | 'high'): PriorityTone {
  if (priority === 'high') return 'danger'
  if (priority === 'medium') return 'warning'
  return 'muted'
}

function sortTasksByDueDate(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    return leftTime - rightTime
  })
}

function sortBillingByPriority(records: BillingRecord[]) {
  const statusRank: Record<BillingStatus, number> = {
    overdue: 0,
    draft: 1,
    invoiced: 2,
    paid: 3,
    cancelled: 4,
  }

  return [...records].sort((left, right) => {
    const statusDelta = statusRank[left.status] - statusRank[right.status]
    if (statusDelta !== 0) {
      return statusDelta
    }

    const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    return leftTime - rightTime
  })
}

function AdminHome() {
  const navigate = useNavigate()
  const { clients } = useClientStore()
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const { getAllBilling } = useBillingStore()

  const billing = getAllBilling()

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client.name])),
    [clients],
  )

  const projectTitleById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.title])),
    [projects],
  )

  const clientScores = useMemo(
    () =>
      clients.map((client) => ({
        client,
        score: calculateClientScore(String(client.id), {
          clients,
          projects,
          tasks,
          billing,
        }),
      })),
    [clients, projects, tasks, billing],
  )

  const priorityItems = useMemo(() => {
    const lateTaskItems: PriorityItem[] = sortTasksByDueDate(getLateTasks(tasks))
      .slice(0, 2)
      .map((task) => ({
        id: `task-${task.id}`,
        typeLabel: 'Kasni task',
        description: task.title,
        context: `${clientNameById.get(String(task.clientId)) ?? 'Klijent'} ? ${projectTitleById.get(task.projectId) ?? 'Projekat'}`,
        tone: 'danger',
        href: `/tasks/${task.id}`,
      }))

    const overdueBillingItems: PriorityItem[] = sortBillingByPriority(
      billing.filter((record) => record.status === 'overdue'),
    )
      .slice(0, 2)
      .map((record) => ({
        id: `billing-${record.id}`,
        typeLabel: 'Kasna naplata',
        description: formatAmount(record.amount, record.currency),
        context: `${clientNameById.get(record.clientId) ?? 'Klijent'} ? ${projectTitleById.get(record.projectId) ?? 'Projekat'}`,
        tone: 'danger',
        href: `/projects/${record.projectId}`,
      }))

    const projectSignalItems: PriorityItem[] = projects
      .filter((project) => project.status === 'aktivan')
      .map((project) => ({
        project,
        health: getProjectHealthPresentation(project.id, tasks),
      }))
      .filter(({ health }) => health.key === 'late' || health.key === 'waiting')
      .slice(0, 2)
      .map(({ project, health }) => ({
        id: `project-${project.id}`,
        typeLabel: 'Signal projekta',
        description: health.label,
        context: `${clientNameById.get(project.clientId) ?? 'Klijent'} ? ${project.title}`,
        tone: health.key === 'late' ? 'danger' : 'warning',
        href: `/projects/${project.id}`,
      }))

    const clientRiskItems: PriorityItem[] = clientScores
      .filter(({ score }) => score.signals.risks.length > 0)
      .sort(
        (left, right) =>
          right.score.signals.risks.length - left.score.signals.risks.length ||
          left.score.total - right.score.total,
      )
      .slice(0, 2)
      .map(({ client, score }) => ({
        id: `client-${client.id}`,
        typeLabel: 'Rizik klijenta',
        description: score.signals.risks[0],
        context: client.name,
        tone: getPriorityToneFromScore(score.priority),
        href: `/clients/${client.id}`,
      }))

    return [
      ...lateTaskItems,
      ...overdueBillingItems,
      ...projectSignalItems,
      ...clientRiskItems,
    ].slice(0, MAX_PRIORITY_ITEMS)
  }, [billing, clientNameById, clientScores, projectTitleById, projects, tasks])

  const operationalColumns = useMemo(
    () => [
      {
        key: 'late',
        title: 'Kasni',
        items: sortTasksByDueDate(getLateTasks(tasks)).slice(0, MAX_TASKS_PER_COLUMN),
      },
      {
        key: 'today',
        title: 'Danas',
        items: sortTasksByDueDate(getTodayTasks(tasks)).slice(0, MAX_TASKS_PER_COLUMN),
      },
      {
        key: 'in-progress',
        title: 'U radu',
        items: sortTasksByDueDate(getTasksByStatus(tasks, 'u_radu')).slice(0, MAX_TASKS_PER_COLUMN),
      },
      {
        key: 'done',
        title: 'Zavr?eno',
        items: [...getCompletedTasks(tasks)].slice(0, MAX_TASKS_PER_COLUMN),
      },
    ],
    [tasks],
  )

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'aktivan').slice(0, MAX_PROJECTS),
    [projects],
  )

  const billingSummaryByStatus = useMemo(() => {
    const base = {
      draft: { count: 0, amount: 0 },
      invoiced: { count: 0, amount: 0 },
      overdue: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
    }

    for (const record of billing) {
      if (record.status in base) {
        base[record.status as keyof typeof base].count += 1
        base[record.status as keyof typeof base].amount += record.amount ?? 0
      }
    }

    return base
  }, [billing])

  const importantBilling = useMemo(
    () => sortBillingByPriority(billing).slice(0, MAX_BILLING_ITEMS),
    [billing],
  )

  const topRiskClients = useMemo(
    () =>
      [...clientScores]
        .sort(
          (left, right) =>
            right.score.signals.risks.length - left.score.signals.risks.length ||
            left.score.total - right.score.total,
        )
        .slice(0, MAX_CLIENTS),
    [clientScores],
  )

  const topScoreClients = useMemo(
    () => [...clientScores].sort((left, right) => right.score.total - left.score.total).slice(0, MAX_CLIENTS),
    [clientScores],
  )

  return (
    <section className="role-home-shell admin-dashboard-shell">
      <header className="role-home-header admin-dashboard-header">
        <h2>Pregled poslovanja</h2>
        <p>?ta danas tra?i tvoju pa?nju.</p>
      </header>

      <article className="role-home-card admin-dashboard-card admin-dashboard-priorities">
        <div className="role-home-focus-head">
          <div className="role-home-focus-title">
            <h3>Prioriteti</h3>
          </div>
        </div>

        {priorityItems.length ? (
          <div className="admin-priority-list">
            {priorityItems.map((item) => (
              <div key={item.id} className="admin-priority-item">
                <div className="admin-priority-copy">
                  <span className={`customer-status-badge is-${item.tone}`}>{item.typeLabel}</span>
                  <strong>{item.description}</strong>
                  {item.context ? <p>{item.context}</p> : null}
                </div>
                <button
                  type="button"
                  className="settings-secondary-button"
                  onClick={() => navigate(item.href)}
                >
                  Otvori
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="role-home-empty">Sve pod kontrolom.</p>
        )}
      </article>

      <div className="admin-dashboard-grid">
        <article className="role-home-card admin-dashboard-card">
          <div className="role-home-focus-head">
            <div className="role-home-focus-title">
              <h3>Operativa</h3>
            </div>
          </div>

          <div className="admin-ops-grid">
            {operationalColumns.map((column) => (
              <section key={column.key} className="admin-ops-column">
                <h4>{column.title}</h4>
                {column.items.length ? (
                  <div className="admin-mini-list">
                    {column.items.map((task) => (
                      <div key={task.id} className="admin-mini-item">
                        <div className="admin-mini-copy">
                          <strong>{task.title}</strong>
                          <p>
                            {clientNameById.get(String(task.clientId)) ?? 'Klijent'} ?{' '}
                            {projectTitleById.get(task.projectId) ?? 'Projekat'}
                          </p>
                          <p>
                            {task.assignedToLabel || 'Bez dodele'} ? {TASK_STATUS_LABELS[task.status]}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="settings-secondary-button"
                          onClick={() => navigate(`/tasks/${task.id}`)}
                        >
                          Otvori
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="role-home-empty">Nema stavki.</p>
                )}
              </section>
            ))}
          </div>
        </article>

        <article className="role-home-card admin-dashboard-card">
          <div className="role-home-focus-head">
            <div className="role-home-focus-title">
              <h3>Projekti</h3>
            </div>
          </div>

          {activeProjects.length ? (
            <div className="admin-mini-list">
              {activeProjects.map((project) => {
                const health = getProjectHealthPresentation(project.id, tasks)
                const activeStage = project.stages?.find((stage) => stage.status === 'active')
                const progress = getProjectStageProgress(project, tasks)
                const totalTasks = progress.reduce((sum, item) => sum + item.totalTasks, 0)
                const completedTasks = progress.reduce((sum, item) => sum + item.completedTasks, 0)

                return (
                  <div key={project.id} className="admin-mini-item">
                    <div className="admin-mini-copy">
                      <strong>{project.title}</strong>
                      <p>{clientNameById.get(project.clientId) ?? 'Klijent'}</p>
                      <p>Faza: {activeStage?.name ?? 'Bez aktivne faze'}</p>
                      <p>
                        {health.label} ? {completedTasks}/{totalTasks} taskova zavr?eno
                      </p>
                    </div>
                    <button
                      type="button"
                      className="settings-secondary-button"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      Otvori
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="role-home-empty">Nema aktivnih projekata.</p>
          )}
        </article>

        <article className="role-home-card admin-dashboard-card">
          <div className="role-home-focus-head">
            <div className="role-home-focus-title">
              <h3>Naplata</h3>
            </div>
          </div>

          <div className="admin-billing-summary">
            {ADMIN_BILLING_STATUSES.map((status) => (
              <div key={status} className="detail-item">
                <span>{BILLING_STATUS_LABELS[status]}</span>
                <strong>{billingSummaryByStatus[status].count}</strong>
                <p>{formatAmount(billingSummaryByStatus[status].amount, 'RSD')}</p>
              </div>
            ))}
          </div>

          {importantBilling.length ? (
            <div className="admin-mini-list">
              {importantBilling.map((record) => (
                <div key={record.id} className="admin-mini-item">
                  <div className="admin-mini-copy">
                    <strong>{projectTitleById.get(record.projectId) ?? 'Projekat'}</strong>
                    <p>{clientNameById.get(record.clientId) ?? 'Klijent'}</p>
                    <p>
                      {formatAmount(record.amount, record.currency)} ? {formatDueDate(record.dueDate)}
                    </p>
                    <p>{BILLING_STATUS_LABELS[record.status]}</p>
                  </div>
                  <button
                    type="button"
                    className="settings-secondary-button"
                    onClick={() => navigate(`/projects/${record.projectId}`)}
                  >
                    Otvori
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="role-home-empty">Nema billing naloga.</p>
          )}
        </article>

        <article className="role-home-card admin-dashboard-card">
          <div className="role-home-focus-head">
            <div className="role-home-focus-title">
              <h3>Klijenti</h3>
            </div>
          </div>

          <div className="admin-clients-grid">
            <section className="admin-clients-column">
              <h4>Top rizik</h4>
              {topRiskClients.length ? (
                <div className="admin-mini-list">
                  {topRiskClients.map(({ client, score }) => (
                    <div key={`risk-${client.id}`} className="admin-mini-item">
                      <div className="admin-mini-copy">
                        <strong>{client.name}</strong>
                        <p>PULSE {score.total} ? {getPriorityLabel(score.priority)}</p>
                        <p>{score.signals.risks[0] ?? 'Nema izra?enih rizika.'}</p>
                      </div>
                      <button
                        type="button"
                        className="settings-secondary-button"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        Otvori
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="role-home-empty">Nema rizi?nih klijenata.</p>
              )}
            </section>

            <section className="admin-clients-column">
              <h4>Top score</h4>
              {topScoreClients.length ? (
                <div className="admin-mini-list">
                  {topScoreClients.map(({ client, score }) => (
                    <div key={`score-${client.id}`} className="admin-mini-item">
                      <div className="admin-mini-copy">
                        <strong>{client.name}</strong>
                        <p>PULSE {score.total} ? {getPriorityLabel(score.priority)}</p>
                        <p>{score.signals.positives[0] ?? 'Bez dodatnih pozitivnih signala.'}</p>
                      </div>
                      <button
                        type="button"
                        className="settings-secondary-button"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        Otvori
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="role-home-empty">Nema klijenata za prikaz.</p>
              )}
            </section>
          </div>
        </article>
      </div>
    </section>
  )
}

export default AdminHome
