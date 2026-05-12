import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NoAccessPage from '../../../pages/NoAccessPage'
import { useAuthStore } from '../../auth/authStore'
import { useClientStore } from '../../clients/clientStore'
import '../../clients/pages/client-detail.css'
import { useProjectStore } from '../../projects/projectStore'
import { completeTask, pauseTask, resumeTask, startTask } from '../taskActions'
import { TASK_STATUS_LABELS } from '../taskLabels'
import { getTaskById as selectTaskById, getTasksByUser } from '../taskSelectors'
import { useTaskStore } from '../taskStore'
import type { Task } from '../types'

function formatDueDate(value?: string) {
  if (!value) return 'Bez roka'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
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

function TaskDetail() {
  const navigate = useNavigate()
  const { taskId } = useParams()
  const { currentUser, users } = useAuthStore()
  const { tasks, updateTask } = useTaskStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()

  const task = selectTaskById(tasks, taskId ?? '')
  const client = task ? getClientById(String(task.clientId)) : null
  const project = task ? getProjectById(task.projectId) : null
  const myTasks = useMemo(
    () => getTasksByUser(tasks, currentUser.id, currentUser.name),
    [tasks, currentUser.id, currentUser.name],
  )
  const assignableUsers = useMemo(() => {
    const operationalUsers = users.filter((user) => user.role === 'user')
    return operationalUsers.length ? operationalUsers : users
  }, [users])

  const [isCompleting, setIsCompleting] = useState(false)
  const [isReassigning, setIsReassigning] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(task?.assignedToUserId ?? '')
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(String(task?.timeSpentMinutes ?? ''))
  const [materialCost, setMaterialCost] = useState(String(task?.materialCost ?? 0))
  const [materialDescription, setMaterialDescription] = useState(task?.materialDescription ?? '')

  useEffect(() => {
    setTimeSpentMinutes(String(task?.timeSpentMinutes ?? ''))
    setMaterialCost(String(task?.materialCost ?? 0))
    setMaterialDescription(task?.materialDescription ?? '')
    setSelectedAssigneeId(task?.assignedToUserId ?? assignableUsers[0]?.id ?? '')
    setIsReassigning(false)

    if (task?.status !== 'u_radu') {
      setIsCompleting(false)
    }
  }, [task, assignableUsers])

  if (!task) {
    return (
      <section className="page-card client-detail-shell task-detail-clean">
        <button type="button" className="secondary-link-button" onClick={() => navigate('/')}>
          Nazad
        </button>

        <div className="clients-empty-state">
          <h2>Task nije pronađen</h2>
          <p>Vrati se na početni ekran i izaberi postojeći zadatak.</p>
        </div>
      </section>
    )
  }

  if (currentUser.role === 'user' && !myTasks.some((myTask) => myTask.id === task.id)) {
    return <NoAccessPage />
  }

  const isAdminView = currentUser.role === 'admin'
  const isAssignedUser =
    currentUser.role === 'user' && task.assignedToUserId === currentUser.id
  const isWaitingForPreviousStep = task.status === 'na_cekanju' && Boolean(task.dependsOnTaskId)
  const canTakeTask = isAssignedUser && task.status === 'dodeljen'
  const canPauseTask = isAssignedUser && task.status === 'u_radu'
  const canResumeTask =
    isAssignedUser &&
    !isWaitingForPreviousStep &&
    (task.status === 'na_cekanju' || task.status === 'vracen')
  const canCompleteTask = isAssignedUser && task.status === 'u_radu'
  const assigneeLabel = task.assignedToLabel || 'Nije dodeljeno'

  const handleStart = () => {
    if (!canTakeTask) return
    updateTask(startTask(task))
  }

  const handlePause = () => {
    if (!canPauseTask) return
    updateTask(pauseTask(task))
  }

  const handleResume = () => {
    if (!canResumeTask) return
    updateTask(resumeTask(task))
  }

  const handleCancelComplete = () => {
    setIsCompleting(false)
    setTimeSpentMinutes(String(task.timeSpentMinutes ?? ''))
    setMaterialCost(String(task.materialCost ?? 0))
    setMaterialDescription(task.materialDescription ?? '')
  }

  const handleConfirmComplete = () => {
    if (!canCompleteTask) return

    const parsedTime = Number(timeSpentMinutes)
    const parsedMaterial = Number(materialCost)

    if (!Number.isFinite(parsedTime) || parsedTime < 0) return
    if (!Number.isFinite(parsedMaterial) || parsedMaterial < 0) return

    updateTask(
      completeTask(task, {
        timeSpentMinutes: parsedTime,
        materialCost: parsedMaterial,
        materialDescription,
      }),
    )
    setIsCompleting(false)
  }

  const handleReturnForRevision = () => {
    if (!isAdminView) return
    updateTask({
      ...task,
      status: 'vracen',
      completedAt: null,
      updatedAt: new Date().toISOString(),
    })
  }

  const handleConfirmReassign = () => {
    if (!isAdminView || !selectedAssigneeId) return
    const nextAssignee = assignableUsers.find((user) => user.id === selectedAssigneeId)
    if (!nextAssignee) return

    updateTask({
      ...task,
      assignedToUserId: nextAssignee.id,
      assignedToLabel: nextAssignee.name || nextAssignee.email,
      needsAssignment: false,
      updatedAt: new Date().toISOString(),
    })
    setIsReassigning(false)
  }

  return (
    <section className="page-card client-detail-shell task-detail-clean">
      <button type="button" className="secondary-link-button" onClick={() => navigate('/')}>
        Nazad
      </button>

      <header className="customer-card-header task-detail-header-clean">
        <div>
          <p className="task-detail-eyebrow">{client?.name ?? 'Task detalj'}</p>
          <h2 className="customer-card-title">{task.title}</h2>
        </div>
        <span className={`customer-status-badge is-${getStatusTone(task)}`}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </header>

      <section className="customer-card-section task-detail-summary">
        {project ? (
          <div className="task-detail-summary-row">
            <span>Projekat</span>
            <strong>{project.title}</strong>
          </div>
        ) : null}
        <div className="task-detail-summary-row task-detail-description">
          <span>Opis taska</span>
          <p>{task.description?.trim() ? task.description : 'Nema dodatnog opisa za ovaj task.'}</p>
        </div>
        <div className="task-detail-summary-row">
          <span>Dodeljeno korisniku</span>
          <strong>{assigneeLabel}</strong>
        </div>
        <div className="task-detail-summary-row">
          <span>Rok</span>
          <strong>{formatDueDate(task.dueDate)}</strong>
        </div>
      </section>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Akcije</h3>
        </div>

        {isAdminView ? (
          <>
            <div className="customer-task-actions">
              <button
                type="button"
                className="customer-project-toggle"
                onClick={() => setIsReassigning((current) => !current)}
              >
                Re-dodeli task
              </button>
              <button
                type="button"
                className="customer-project-toggle"
                onClick={handleReturnForRevision}
              >
                Vrati na doradu
              </button>
              {project ? (
                <button
                  type="button"
                  className="customer-project-toggle"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  Otvori projekat
                </button>
              ) : null}
            </div>

            {isReassigning ? (
              <div className="customer-task-complete-form">
                <label className="customer-task-form-field">
                  <span>Dodeli korisniku</span>
                  <select
                    value={selectedAssigneeId}
                    onChange={(event) => setSelectedAssigneeId(event.target.value)}
                  >
                    <option value="">-- Izaberi člana --</option>
                    {assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="customer-task-actions">
                  <button
                    type="button"
                    className="customer-project-toggle"
                    onClick={handleConfirmReassign}
                    disabled={!selectedAssigneeId}
                  >
                    Sačuvaj dodelu
                  </button>
                  <button
                    type="button"
                    className="customer-project-toggle"
                    onClick={() => setIsReassigning(false)}
                  >
                    Otkaži
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : task.status !== 'zavrsen' ? (
          <div className="customer-task-actions">
            {canTakeTask ? (
              <button type="button" className="customer-project-toggle" onClick={handleStart}>
                Preuzmi
              </button>
            ) : null}

            {canPauseTask ? (
              <>
                <button type="button" className="customer-project-toggle" onClick={handlePause}>
                  Stavi na čekanje
                </button>
                <button
                  type="button"
                  className="customer-project-toggle"
                  onClick={() => setIsCompleting(true)}
                >
                  Završi task
                </button>
              </>
            ) : null}

            {isWaitingForPreviousStep ? (
              <span className="customer-status-badge is-muted">Čeka prethodni korak</span>
            ) : null}

            {canResumeTask ? (
              <button type="button" className="customer-project-toggle" onClick={handleResume}>
                Nastavi rad
              </button>
            ) : null}
          </div>
        ) : (
          <div className="customer-card-empty">Task je završen i trenutno je samo za pregled.</div>
        )}

        {!isAdminView && isCompleting ? (
          <div className="customer-task-complete-form">
            <label className="customer-task-form-field">
              <span>Utrošeno vreme (min)</span>
              <input
                type="number"
                min="0"
                value={timeSpentMinutes}
                onChange={(event) => setTimeSpentMinutes(event.target.value)}
              />
            </label>

            <label className="customer-task-form-field">
              <span>Trošak materijala (RSD)</span>
              <input
                type="number"
                min="0"
                value={materialCost}
                onChange={(event) => setMaterialCost(event.target.value)}
              />
            </label>

            <label className="customer-task-form-field">
              <span>Opis materijala</span>
              <input
                type="text"
                value={materialDescription}
                onChange={(event) => setMaterialDescription(event.target.value)}
              />
            </label>

            <div className="customer-task-actions">
              <button
                type="button"
                className="customer-project-toggle"
                onClick={handleConfirmComplete}
              >
                Potvrdi završetak
              </button>
              <button
                type="button"
                className="customer-project-toggle"
                onClick={handleCancelComplete}
              >
                Otkaži
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default TaskDetail
