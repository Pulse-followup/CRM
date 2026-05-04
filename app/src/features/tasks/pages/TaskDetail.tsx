import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import NoAccessPage from '../../../pages/NoAccessPage'
import { useAuthStore } from '../../auth/authStore'
import { useClientStore } from '../../clients/clientStore'
import '../../clients/pages/client-detail.css'
import { useProjectStore } from '../../projects/projectStore'
import { completeTask, pauseTask, resumeTask, startTask } from '../taskActions'
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../taskLabels'
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

function formatDurationMinutes(value?: number) {
  if (!value) return '-'
  if (value < 60) return `${value} min`
  const hours = Math.round((value / 60) * 10) / 10
  return `${hours}h`
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
  const { currentUser } = useAuthStore()
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

  const [isCompleting, setIsCompleting] = useState(false)
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(String(task?.timeSpentMinutes ?? ''))
  const [materialCost, setMaterialCost] = useState(String(task?.materialCost ?? 0))
  const [materialDescription, setMaterialDescription] = useState(task?.materialDescription ?? '')

  useEffect(() => {
    setTimeSpentMinutes(String(task?.timeSpentMinutes ?? ''))
    setMaterialCost(String(task?.materialCost ?? 0))
    setMaterialDescription(task?.materialDescription ?? '')

    if (task?.status !== 'u_radu') {
      setIsCompleting(false)
    }
  }, [task])

  if (!task) {
    return (
      <section className="page-card client-detail-shell">
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

  const isWaitingForPreviousStep = task.status === 'na_cekanju' && Boolean(task.dependsOnTaskId)

  const handleStart = () => {
    if (task.status !== 'dodeljen') return
    updateTask(startTask(task))
  }

  const handlePause = () => {
    if (task.status !== 'u_radu') return
    updateTask(pauseTask(task))
  }

  const handleResume = () => {
    if (isWaitingForPreviousStep || (task.status !== 'na_cekanju' && task.status !== 'vracen')) return
    updateTask(resumeTask(task))
  }

  const handleCancelComplete = () => {
    setIsCompleting(false)
    setTimeSpentMinutes(String(task.timeSpentMinutes ?? ''))
    setMaterialCost(String(task.materialCost ?? 0))
    setMaterialDescription(task.materialDescription ?? '')
  }

  const handleConfirmComplete = () => {
    if (task.status !== 'u_radu') return

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

  return (
    <section className="page-card client-detail-shell">
      <button type="button" className="secondary-link-button" onClick={() => navigate('/')}>
        Nazad
      </button>

      <header className="customer-card-header">
        <div>
          <h2 className="customer-card-title">{task.title}</h2>
          <p className="customer-card-subtitle">Task detalj</p>
        </div>
        <span className={`customer-status-badge is-${getStatusTone(task)}`}>
          {TASK_STATUS_LABELS[task.status]}
        </span>
      </header>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Detalji taska</h3>
        </div>

        <div className="customer-card-group">
          <dl className="customer-card-detail-list">
            <div>
              <dt>Tip</dt>
              <dd>{task.type ? TASK_TYPE_LABELS[task.type] : '-'}</dd>
            </div>
            <div>
              <dt>Klijent</dt>
              <dd>{client?.name ?? 'Nepoznat klijent'}</dd>
            </div>
            <div>
              <dt>Projekat</dt>
              <dd>{project?.title ?? 'Nepoznat projekat'}</dd>
            </div>
            <div>
              <dt>Opis</dt>
              <dd>{task.description?.trim() ? task.description : '-'}</dd>
            </div>
            <div>
              <dt>Operativna rola</dt>
              <dd>{task.requiredRole || task.assignedToLabel || '-'}</dd>
            </div>
            {task.assignedToUserId ? (
              <div>
                <dt>Dodeljeno korisniku</dt>
                <dd>{task.assignedToLabel || '-'}</dd>
              </div>
            ) : null}
            <div>
              <dt>Rok</dt>
              <dd>{formatDueDate(task.dueDate)}</dd>
            </div>
            {task.sequenceOrder ? (
              <div>
                <dt>Korak procesa</dt>
                <dd>{task.sequenceOrder}</dd>
              </div>
            ) : null}
            {task.estimatedMinutes ? (
              <div>
                <dt>Procena trajanja</dt>
                <dd>{formatDurationMinutes(task.estimatedMinutes)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Utrošeno vreme</dt>
              <dd>{typeof task.timeSpentMinutes === 'number' ? `${task.timeSpentMinutes} min` : '-'}</dd>
            </div>
            <div>
              <dt>Trošak materijala</dt>
              <dd>{typeof task.materialCost === 'number' && task.materialCost > 0 ? `${task.materialCost} RSD` : '-'}</dd>
            </div>
            <div>
              <dt>Opis materijala</dt>
              <dd>{task.materialDescription?.trim() ? task.materialDescription : '-'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Akcije</h3>
        </div>

        {task.status !== 'zavrsen' ? (
          <div className="customer-task-actions">
            {task.status === 'dodeljen' ? (
              <button type="button" className="customer-project-toggle" onClick={handleStart}>
                Preuzmi
              </button>
            ) : null}

            {task.status === 'u_radu' ? (
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

            {!isWaitingForPreviousStep && (task.status === 'na_cekanju' || task.status === 'vracen') ? (
              <button type="button" className="customer-project-toggle" onClick={handleResume}>
                Nastavi rad
              </button>
            ) : null}
          </div>
        ) : (
          <div className="customer-card-empty">Task je završen i trenutno je samo za pregled.</div>
        )}

        {isCompleting ? (
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
