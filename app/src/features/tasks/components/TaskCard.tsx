import { useEffect, useState } from 'react'
import { completeTask, pauseTask, resumeTask, startTask } from '../taskActions'
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../taskLabels'
import type { Task } from '../types'

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

function TaskCard({ task, onTaskChange }: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false)
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(String(task.timeSpentMinutes ?? ''))
  const [materialCost, setMaterialCost] = useState(String(task.materialCost ?? 0))
  const [materialDescription, setMaterialDescription] = useState(task.materialDescription ?? '')

  useEffect(() => {
    setTimeSpentMinutes(String(task.timeSpentMinutes ?? ''))
    setMaterialCost(String(task.materialCost ?? 0))
    setMaterialDescription(task.materialDescription ?? '')
    if (task.status !== 'u_radu') {
      setIsCompleting(false)
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
    if (!onTaskChange || (task.status !== 'na_cekanju' && task.status !== 'vracen')) return
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

  return (
    <article className="customer-task-card">
      <div className="customer-task-card-head">
        <strong>{task.title}</strong>
        <span className="customer-status-badge is-muted">{TASK_STATUS_LABELS[task.status]}</span>
      </div>

      <dl className="customer-task-detail-list">
        {task.type ? (
          <div>
            <dt>Tip</dt>
            <dd>{TASK_TYPE_LABELS[task.type]}</dd>
          </div>
        ) : null}
        <div>
          <dt>Dodeljeno</dt>
          <dd>{task.assignedToLabel || '-'}</dd>
        </div>
        <div>
          <dt>Rok</dt>
          <dd>{formatDueDate(task.dueDate)}</dd>
        </div>
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

          {task.status === 'na_cekanju' || task.status === 'vracen' ? (
            <button type="button" className="customer-project-toggle" onClick={handleResume}>
              Vrati u rad
            </button>
          ) : null}

          {task.status === 'zavrsen' ? (
            <span className="customer-status-badge">{TASK_STATUS_LABELS.zavrsen}</span>
          ) : null}
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
