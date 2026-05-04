import { useEffect, useState } from 'react'
import { completeTask, pauseTask, resumeTask, startTask } from '../taskActions'
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../taskLabels'
import { readProcessTemplates } from '../../templates/templateStorage'
import { useAuthStore } from '../../auth/authStore'
import { getTaskBlockReason, normalizeOperationalRole } from '../taskStore'
import type { Task, TaskStatus } from '../types'

export interface TaskCardProps {
  task: Task
  onTaskChange?: (task: Task) => void
}

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

function withTaskUpdate(task: Task, updates: Partial<Task>): Task {
  const now = new Date().toISOString()
  return {
    ...task,
    ...updates,
    updatedAt: now,
  }
}

function statusLabel(status: TaskStatus) {
  return TASK_STATUS_LABELS[status] || status
}

function TaskCard({ task, onTaskChange }: TaskCardProps) {
  const { users, currentUser } = useAuthStore()
  const processTemplates = readProcessTemplates()
  const templateTitle = task.sourceTemplateTitle || processTemplates.find((template) => template.id === task.sourceTemplateId)?.title || ''
  const [isCompleting, setIsCompleting] = useState(false)
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(String(task.timeSpentMinutes ?? ''))
  const [materialCost, setMaterialCost] = useState(String(task.materialCost ?? 0))
  const [materialDescription, setMaterialDescription] = useState(task.materialDescription ?? '')
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('')
  const isWaitingForPreviousStep = task.status === 'na_cekanju' && Boolean(task.dependsOnTaskId)
  const isAdmin = currentUser.role === 'admin'
  const assignedUser = task.assignedToUserId ? users.find((user) => user.id === task.assignedToUserId) : null
  const requiredRole = normalizeOperationalRole(task.requiredRole)
  const blockReason = getTaskBlockReason(task, users)

  useEffect(() => {
    setTimeSpentMinutes(String(task.timeSpentMinutes ?? ''))
    setMaterialCost(String(task.materialCost ?? 0))
    setMaterialDescription(task.materialDescription ?? '')
    if (task.status !== 'u_radu') {
      setIsCompleting(false)
    }
    if (task.assignedToUserId) {
      setIsAssigning(false)
    }
  }, [task])

  const handleStart = () => {
    if (!onTaskChange || task.status !== 'dodeljen') return
    onTaskChange(startTask(task))
  }

  const handlePause = () => {
    if (!onTaskChange || task.status !== 'u_radu') return
    onTaskChange(pauseTask(task))
  }

  const handleResume = () => {
    if (!onTaskChange || isWaitingForPreviousStep || (task.status !== 'na_cekanju' && task.status !== 'vracen')) return
    onTaskChange(resumeTask(task))
  }

  const handleOpenComplete = () => {
    if (!onTaskChange || task.status !== 'u_radu') return
    setIsCompleting(true)
  }

  const handleCancelComplete = () => {
    setIsCompleting(false)
    setTimeSpentMinutes(String(task.timeSpentMinutes ?? ''))
    setMaterialCost(String(task.materialCost ?? 0))
    setMaterialDescription(task.materialDescription ?? '')
  }

  const handleConfirmComplete = () => {
    if (!onTaskChange || task.status !== 'u_radu') return

    const parsedTime = Number(timeSpentMinutes)
    const parsedMaterial = Number(materialCost)

    if (!Number.isFinite(parsedTime) || parsedTime < 0) return
    if (!Number.isFinite(parsedMaterial) || parsedMaterial < 0) return

    onTaskChange(
      completeTask(task, {
        timeSpentMinutes: parsedTime,
        materialCost: parsedMaterial,
        materialDescription,
      }),
    )
    setIsCompleting(false)
  }

  const handleOpenAssign = () => {
    setSelectedAssigneeId(task.assignedToUserId || users[0]?.id || '')
    setIsAssigning(true)
  }

  const handleConfirmAssign = () => {
    if (!onTaskChange || !selectedAssigneeId) return
    const selectedUser = users.find((user) => user.id === selectedAssigneeId)
    if (!selectedUser) return

    onTaskChange(
      withTaskUpdate(task, {
        assignedToUserId: selectedUser.id,
        assignedToLabel: selectedUser.name || selectedUser.email,
      }),
    )
    setIsAssigning(false)
  }

  const handleActivateNow = () => {
    if (!onTaskChange || !isAdmin) return
    onTaskChange(
      withTaskUpdate(task, {
        status: 'dodeljen',
        activatedAt: new Date().toISOString(),
      }),
    )
  }

  const handleReturnToWaiting = () => {
    if (!onTaskChange || !isAdmin) return
    onTaskChange(
      withTaskUpdate(task, {
        status: 'na_cekanju',
        activatedAt: null,
      }),
    )
  }

  const handleSkipStep = () => {
    if (!onTaskChange || !isAdmin) return
    const now = new Date().toISOString()
    onTaskChange(
      withTaskUpdate(task, {
        status: 'zavrsen',
        completedAt: now,
        timeSpentMinutes: task.timeSpentMinutes ?? 0,
        materialCost: task.materialCost ?? 0,
        materialDescription: task.materialDescription || 'Korak preskočen od strane admina.',
        billingState: task.billingState || 'not_billable',
      }),
    )
  }

  const handleForceComplete = () => {
    if (!onTaskChange || !isAdmin) return
    onTaskChange(
      withTaskUpdate(task, {
        status: 'zavrsen',
        completedAt: new Date().toISOString(),
      }),
    )
  }

  const handleReopen = () => {
    if (!onTaskChange || !isAdmin) return
    onTaskChange(
      withTaskUpdate(task, {
        status: 'dodeljen',
        completedAt: null,
        activatedAt: new Date().toISOString(),
      }),
    )
  }

  return (
    <article className="customer-task-card">
      <div className="customer-task-card-head">
        <strong>{task.title}</strong>
        <span className="customer-status-badge is-muted">{statusLabel(task.status)}</span>
      </div>

      {blockReason ? (
        <p className="customer-source-note">🚫 <strong>BLOKIRANO:</strong> {blockReason}</p>
      ) : null}

      {task.source === 'template' || templateTitle ? (
        <p className="customer-source-note">Iz šablona: <strong>{templateTitle || 'Proces'}</strong>{task.sourceProductTitle ? ` · Proizvod: ${task.sourceProductTitle}` : ''}</p>
      ) : null}

      <dl className="customer-task-detail-list">
        {task.type ? (
          <div>
            <dt>Tip</dt>
            <dd>{TASK_TYPE_LABELS[task.type]}</dd>
          </div>
        ) : null}
        <div>
          <dt>Operativna rola</dt>
          <dd>{requiredRole || task.assignedToLabel || '-'}</dd>
        </div>
        {task.assignedToUserId ? (
          <div>
            <dt>Dodeljeno korisniku</dt>
            <dd>{task.assignedToLabel || assignedUser?.name || '-'}</dd>
          </div>
        ) : null}
        {assignedUser?.productionRole ? (
          <div>
            <dt>Rola korisnika</dt>
            <dd>{normalizeOperationalRole(assignedUser.productionRole)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Rok</dt>
          <dd>{formatDueDate(task.dueDate)}</dd>
        </div>
        {task.sequenceOrder ? (
          <div>
            <dt>Korak</dt>
            <dd>{task.sequenceOrder}</dd>
          </div>
        ) : null}
        {task.estimatedMinutes ? (
          <div>
            <dt>Procena</dt>
            <dd>{formatDurationMinutes(task.estimatedMinutes)}</dd>
          </div>
        ) : null}
        {typeof task.timeSpentMinutes === 'number' && (
          <div>
            <dt>Utrošeno vreme</dt>
            <dd>{task.timeSpentMinutes} min</dd>
          </div>
        )}
        {typeof task.materialCost === 'number' && task.materialCost > 0 && (
          <div>
            <dt>Materijal</dt>
            <dd>{task.materialCost} RSD</dd>
          </div>
        )}
      </dl>

      {onTaskChange ? (
        <div className="customer-task-actions">
          {!task.assignedToUserId ? (
            <button type="button" className="customer-project-toggle" onClick={handleOpenAssign}>
              Dodeli
            </button>
          ) : null}

          {isAdmin && task.assignedToUserId ? (
            <button type="button" className="customer-project-toggle" onClick={handleOpenAssign}>
              Re-dodeli
            </button>
          ) : null}

          {task.status === 'dodeljen' ? (
            <button type="button" className="customer-project-toggle" onClick={handleStart}>
              Preuzmi
            </button>
          ) : null}

          {task.status === 'u_radu' ? (
            <>
              <button type="button" className="customer-project-toggle" onClick={handlePause}>
                Na cekanju
              </button>
              <button type="button" className="customer-project-toggle" onClick={handleOpenComplete}>
                Zavrsi
              </button>
            </>
          ) : null}

          {isWaitingForPreviousStep ? (
            <span className="customer-status-badge is-muted">Čeka prethodni korak</span>
          ) : null}

          {!isWaitingForPreviousStep && (task.status === 'na_cekanju' || task.status === 'vracen') ? (
            <button type="button" className="customer-project-toggle" onClick={handleResume}>
              Vrati u rad
            </button>
          ) : null}

          {task.status === 'zavrsen' ? (
            <span className="customer-status-badge">{TASK_STATUS_LABELS.zavrsen}</span>
          ) : null}

          {isAdmin ? (
            <>
              {task.status === 'na_cekanju' ? (
                <button type="button" className="customer-project-toggle" onClick={handleActivateNow}>
                  Aktiviraj
                </button>
              ) : null}

              {task.status === 'dodeljen' || task.status === 'u_radu' ? (
                <button type="button" className="customer-project-toggle" onClick={handleReturnToWaiting}>
                  Vrati na čekanje
                </button>
              ) : null}

              {task.status !== 'zavrsen' && task.status !== 'naplacen' ? (
                <button type="button" className="customer-project-toggle" onClick={handleSkipStep}>
                  Preskoči
                </button>
              ) : null}

              {task.status !== 'zavrsen' && task.status !== 'naplacen' ? (
                <button type="button" className="customer-project-toggle" onClick={handleForceComplete}>
                  Admin završi
                </button>
              ) : null}

              {task.status === 'zavrsen' ? (
                <button type="button" className="customer-project-toggle" onClick={handleReopen}>
                  Vrati u aktivno
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {isAssigning ? (
        <div className="customer-task-complete-form">
          <label className="customer-task-form-field">
            <span>Dodeli korisniku</span>
            <select value={selectedAssigneeId} onChange={(event) => setSelectedAssigneeId(event.target.value)}>
              <option value="">-- Izaberi člana --</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} {user.productionRole ? `(${normalizeOperationalRole(user.productionRole)})` : '(bez operativne role)'}
                </option>
              ))}
            </select>
          </label>
          {requiredRole ? <p className="customer-source-note">Potrebna rola: <strong>{requiredRole}</strong></p> : null}
          <div className="customer-task-actions">
            <button type="button" className="customer-project-toggle" onClick={handleConfirmAssign} disabled={!selectedAssigneeId}>
              Potvrdi dodelu
            </button>
            <button type="button" className="customer-project-toggle" onClick={() => setIsAssigning(false)}>
              Otkaži
            </button>
          </div>
        </div>
      ) : null}

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
            <button type="button" className="customer-project-toggle" onClick={handleConfirmComplete}>
              Potvrdi završetak
            </button>
            <button type="button" className="customer-project-toggle" onClick={handleCancelComplete}>
              Otkaži
            </button>
          </div>
        </div>
      ) : null}
    </article>
  )
}

export default TaskCard
