import { useMemo, useState } from 'react'
import { useAuthStore } from '../features/auth/authStore'
import { useCloudStore } from '../features/cloud/cloudStore'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'
import { completeTask, pauseTask, resumeTask, startTask } from '../features/tasks/taskActions'
import { TASK_STATUS_LABELS } from '../features/tasks/taskLabels'
import { getUserTaskBuckets } from '../features/tasks/taskSelectors'
import { useTaskStore } from '../features/tasks/taskStore'
import type { Task } from '../features/tasks/types'

type Item = { task: Task; client: string; project: string; stage: string }

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function TaskCard({ item, onOpen }: { item: Item; onOpen: (task: Task) => void }) {
  return (
    <article className="pulse-item pulse-task-card">
      <div className="pulse-item-title-row">
        <h4>{item.task.title}</h4>
        <span className="pulse-pill pulse-pill-blue">{TASK_STATUS_LABELS[item.task.status] ?? item.task.status}</span>
      </div>
      <dl className="pulse-mini-dl">
        <div><dt>Klijent:</dt><dd>{item.client}</dd></div>
        <div><dt>Projekat:</dt><dd>{item.project}</dd></div>
        <div><dt>Faza:</dt><dd>{item.stage}</dd></div>
      </dl>
      <div className="pulse-item-actions">
        <span className="pulse-date-pill">{formatDate(item.task.dueDate)}</span>
        <button className="pulse-outline-btn" type="button" onClick={() => onOpen(item.task)}>OTVORI</button>
      </div>
    </article>
  )
}

function Section({ title, empty, items, tone, onOpen }: { title: string; empty: string; items: Item[]; tone: 'red' | 'white' | 'blue'; onOpen: (task: Task) => void }) {
  return (
    <section className={`pulse-panel pulse-panel-${tone}`}>
      <h3>{title}</h3>
      {items.length === 0 ? <p className="pulse-empty">{empty}</p> : <div className="pulse-list">{items.map((item) => <TaskCard key={item.task.id} item={item} onOpen={onOpen} />)}</div>}
    </section>
  )
}

function CompletionForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (payload: { timeSpentMinutes: number; materialCost: number; materialDescription: string }) => void
}) {
  const [timeSpentMinutes, setTimeSpentMinutes] = useState('')
  const [materialCost, setMaterialCost] = useState('0')
  const [materialDescription, setMaterialDescription] = useState('')

  const handleSubmit = () => {
    const parsedTime = Number(timeSpentMinutes)
    const parsedMaterial = Number(materialCost)
    if (!Number.isFinite(parsedTime) || parsedTime < 0) return
    if (!Number.isFinite(parsedMaterial) || parsedMaterial < 0) return
    onSubmit({
      timeSpentMinutes: parsedTime,
      materialCost: parsedMaterial,
      materialDescription,
    })
  }

  return (
    <div className="pulse-complete-form">
      <h4>Unos utrošenog vremena i materijala</h4>
      <label className="pulse-form-field">
        <span>Utrošeno vreme (min)</span>
        <input type="number" min="0" value={timeSpentMinutes} onChange={(event) => setTimeSpentMinutes(event.target.value)} placeholder="npr. 45" />
      </label>
      <label className="pulse-form-field">
        <span>Trošak materijala (RSD)</span>
        <input type="number" min="0" value={materialCost} onChange={(event) => setMaterialCost(event.target.value)} placeholder="npr. 1200" />
      </label>
      <label className="pulse-form-field">
        <span>Opis materijala</span>
        <input type="text" value={materialDescription} onChange={(event) => setMaterialDescription(event.target.value)} placeholder="npr. štampa, nosači, transport..." />
      </label>
      <div className="pulse-modal-actions">
        <button className="pulse-modal-btn pulse-modal-btn-green" type="button" onClick={handleSubmit}>POTVRDI ZAVRŠETAK</button>
        <button className="pulse-modal-btn pulse-modal-btn-red" type="button" onClick={onCancel}>OTKAŽI</button>
      </div>
    </div>
  )
}

function TaskModal({
  task,
  item,
  onClose,
  onStart,
  onHold,
  onResume,
  onComplete,
}: {
  task: Task
  item?: Item
  onClose: () => void
  onStart: () => void
  onHold: () => void
  onResume: () => void
  onComplete: (payload: { timeSpentMinutes: number; materialCost: number; materialDescription: string }) => void
}) {
  const [isCompleting, setIsCompleting] = useState(false)
  const isWaitingForPreviousStep = task.status === 'na_cekanju' && Boolean(task.dependsOnTaskId)

  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div className="pulse-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="pulse-modal-x" type="button" onClick={onClose}>x</button>
        <h3>{task.title}</h3>
        <div className="pulse-task-order">
          <p><strong>Klijent</strong> - {item?.client ?? '-'}</p>
          <p><strong>Opis:</strong> {task.description || '-'}</p>
          <p><strong>Rok</strong> - {formatDate(task.dueDate)}</p>
        </div>

        {isCompleting ? (
          <CompletionForm onCancel={() => setIsCompleting(false)} onSubmit={onComplete} />
        ) : (
          <div className="pulse-modal-actions">
            {task.status === 'dodeljen' ? <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onStart}>PREUZMI TASK</button> : null}
            {task.status === 'u_radu' ? <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onHold}>STAVI NA ČEKANJE</button> : null}
            {isWaitingForPreviousStep ? <span className="pulse-pill pulse-pill-blue">ČEKA PRETHODNI KORAK</span> : null}
            {!isWaitingForPreviousStep && (task.status === 'na_cekanju' || task.status === 'vracen') ? <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onResume}>NASTAVI RAD</button> : null}
            {task.status === 'u_radu' ? <button className="pulse-modal-btn pulse-modal-btn-green" type="button" onClick={() => setIsCompleting(true)}>ZAVRŠI TASK</button> : null}
          </div>
        )}
      </div>
    </div>
  )
}

function UserHome() {
  const { currentUser } = useAuthStore()
  const { membership } = useCloudStore()
  const { tasks, updateTask } = useTaskStore()
  const { clients } = useClientStore()
  const { projects } = useProjectStore()
  const [opened, setOpened] = useState<Task | null>(null)

  const itemsById = useMemo(() => {
    const clientById = new Map(clients.map((c) => [String(c.id), c.name]))
    const projectById = new Map(projects.map((p) => [p.id, p]))
    const map = new Map<string, Item>()
    tasks.forEach((task) => {
      const project = projectById.get(task.projectId)
      const stage = project?.stages?.find((s) => s.id === task.stageId)?.name ?? 'Bez faze'
      map.set(task.id, { task, client: clientById.get(String(task.clientId)) ?? 'Nepoznat klijent', project: project?.title ?? 'Nepoznat projekat', stage })
    })
    return map
  }, [clients, projects, tasks])

  const buckets = useMemo(() => getUserTaskBuckets(tasks, currentUser), [tasks, currentUser])
  const toItems = (list: Task[]) => list.map((task) => itemsById.get(task.id)).filter(Boolean) as Item[]
  const openedItem = opened ? itemsById.get(opened.id) : undefined

  const closeModal = () => setOpened(null)
  const updateOpenedTask = (nextTask: Task) => {
    updateTask(nextTask)
    setOpened(nextTask)
  }

  return (
    <section className="pulse-phone-screen">
      <h2>Tvoj fokus danas</h2>
      <Section title="Zadaci koji kasne" empty="Nema kašnjenja" items={toItems(buckets.late)} tone="red" onOpen={setOpened} />
      <Section title="Danas" empty="Nema zadataka za danas" items={toItems(buckets.today)} tone="white" onOpen={setOpened} />
      <Section title="U radu" empty="Nema aktivnih zadataka" items={toItems(buckets.inProgress)} tone="blue" onOpen={setOpened} />
      {opened ? (
        <TaskModal
          task={opened}
          item={openedItem}
          onClose={closeModal}
          onStart={() => updateOpenedTask(startTask(opened))}
          onHold={() => updateOpenedTask(pauseTask(opened))}
          onResume={() => {
            if (opened.status === 'na_cekanju' && opened.dependsOnTaskId) return
            updateOpenedTask(resumeTask(opened))
          }}
          onComplete={(payload) => {
            const hourlyRate = membership?.hourly_rate ?? 0
            const laborCost = Math.round((payload.timeSpentMinutes / 60) * hourlyRate)
            updateTask({ ...completeTask(opened, payload), laborCost })
            setOpened(null)
          }}
        />
      ) : null}
    </section>
  )
}

export default UserHome
