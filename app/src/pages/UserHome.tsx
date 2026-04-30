import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'
import { TASK_STATUS_LABELS } from '../features/tasks/taskLabels'
import { getUserTaskBuckets, isTaskDueToday, isTaskLate } from '../features/tasks/taskSelectors'
import { useTaskStore } from '../features/tasks/taskStore'
import type { Task } from '../features/tasks/types'

const MAX_ITEMS_PER_SECTION = 5

interface UserHomeTaskItem {
  task: Task
  clientName: string
  projectTitle: string
  stageName: string
}

function formatDueDate(dueDate?: string) {
  if (!dueDate) {
    return 'Rok nije unet'
  }

  const parsed = new Date(dueDate)

  if (Number.isNaN(parsed.getTime())) {
    return dueDate
  }

  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function sortByDueDate(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER

    return leftTime - rightTime
  })
}

function getStatusTone(task: Task) {
  switch (task.status) {
    case 'zavrsen':
    case 'naplacen':
      return 'success'
    case 'na_cekanju':
      return 'warning'
    case 'vracen':
    case 'poslat_na_naplatu':
      return 'info'
    case 'u_radu':
      return 'active'
    case 'dodeljen':
    default:
      return 'muted'
  }
}

function getDueTone(task: Task) {
  if (isTaskLate(task)) {
    return 'danger'
  }

  if (isTaskDueToday(task)) {
    return 'today'
  }

  return 'default'
}

function UserTaskCard({
  item,
  onOpen,
}: {
  item: UserHomeTaskItem
  onOpen: (task: Task) => void
}) {
  const { task, clientName, projectTitle, stageName } = item

  const dueTone = getDueTone(task)

  return (
    <div className="role-home-task-item">
      <div className="role-home-task-copy">
        <div className="role-home-task-head">
          <h4>{task.title}</h4>
          <span className={`role-home-task-badge is-${getStatusTone(task)}`}>
            {TASK_STATUS_LABELS[task.status]}
          </span>
        </div>

        <dl>
          <div>
            <dt>Klijent</dt>
            <dd>{clientName}</dd>
          </div>
          <div>
            <dt>Projekat</dt>
            <dd>{projectTitle}</dd>
          </div>
          <div>
            <dt>Faza</dt>
            <dd>{stageName}</dd>
          </div>
          <div>
            <dt>Rok</dt>
            <dd className={`role-home-due is-${dueTone}`}>{formatDueDate(task.dueDate)}</dd>
          </div>
        </dl>
      </div>

      <button
        className="settings-secondary-button role-home-open-button"
        type="button"
        onClick={() => onOpen(task)}
      >
        Otvori
      </button>
    </div>
  )
}

function TaskFocusList({
  title,
  emptyText,
  items,
  onOpen,
}: {
  title: string
  emptyText: string
  items: UserHomeTaskItem[]
  onOpen: (task: Task) => void
}) {
  return (
    <article className="role-home-card role-home-focus-card">
      <div className="role-home-focus-head">
        <div className="role-home-focus-title">
          <h3>{title}</h3>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="role-home-empty">{emptyText}</p>
      ) : (
        <div className="role-home-task-list">
          {items.map((item) => (
            <UserTaskCard key={item.task.id} item={item} onOpen={onOpen} />
          ))}
        </div>
      )}
    </article>
  )
}

function UserHome() {
  const navigate = useNavigate()
  const { currentUser } = useAuthStore()
  const { tasks } = useTaskStore()
  const { clients } = useClientStore()
  const { projects } = useProjectStore()

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client.name])),
    [clients],
  )

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects])

  const buckets = useMemo(() => getUserTaskBuckets(tasks, currentUser), [tasks, currentUser])

  const myTasks = useMemo(
    () => tasks.filter((task) => task.assignedToUserId === currentUser.id || task.assignedToLabel === currentUser.name),
    [tasks, currentUser.id, currentUser.name],
  )

  const toTaskItems = (sectionTasks: Task[]): UserHomeTaskItem[] =>
    sortByDueDate(sectionTasks)
      .slice(0, MAX_ITEMS_PER_SECTION)
      .map((task) => {
        const project = projectById.get(task.projectId)
        const stageName =
          project?.stages?.find((stage) => stage.id === task.stageId)?.name ?? (task.stageId ? 'Bez faze' : 'Bez faze')

        return {
          task,
          clientName: clientNameById.get(String(task.clientId)) ?? 'Nepoznat klijent',
          projectTitle: project?.title ?? 'Nepoznat projekat',
          stageName,
        }
      })

  const handleOpenTask = (task: Task) => {
    navigate(`/tasks/${task.id}`)
  }

  const hasNoTasks = myTasks.length === 0

  return (
    <section className="role-home-shell">
      <header className="role-home-header">
        <h2>Tvoj fokus danas</h2>
      </header>

      {hasNoTasks ? (
        <article className="role-home-card role-home-focus-card">
          <p className="role-home-empty role-home-empty-global">
            Nema zadataka. Sa?ekaj dodelu od admina.
          </p>
        </article>
      ) : (
        <div className="role-home-grid role-home-grid-focus">
          <TaskFocusList
            title="Kasni zadaci"
            emptyText="Nema kašnjenja"
            items={toTaskItems(buckets.late)}
            onOpen={handleOpenTask}
          />
          <TaskFocusList
            title="Danas"
            emptyText="Nema zadataka za danas"
            items={toTaskItems(buckets.today)}
            onOpen={handleOpenTask}
          />
          <TaskFocusList
            title="U radu"
            emptyText="Nema aktivnih zadataka"
            items={toTaskItems(buckets.inProgress)}
            onOpen={handleOpenTask}
          />
        </div>
      )}
    </section>
  )
}

export default UserHome
