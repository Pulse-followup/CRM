import { useMemo, useState } from 'react'
import { useAuthStore } from '../features/auth/authStore'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'
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

function typeLabel(type?: string) {
  const labels: Record<string, string> = {
    poziv: 'Poziv', mail: 'Mail', sastanak: 'Sastanak', follow_up: 'Follow-up', ponuda: 'Ponuda', naplata: 'Naplata', interni_zadatak: 'Interni zadatak', drugo: 'Drugo',
  }
  return type ? labels[type] ?? type : '-'
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

function TaskModal({ task, item, onClose, onHold, onDone }: { task: Task; item?: Item; onClose: () => void; onHold: () => void; onDone: () => void }) {
  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div className="pulse-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="pulse-modal-x" type="button" onClick={onClose}>x</button>
        <h3>{task.title}</h3>
        <p><strong>Tip</strong> - {typeLabel(task.type)}</p>
        <p><strong>Klijent</strong> - {item?.client ?? '-'}</p>
        <p><strong>Projekat</strong> - {item?.project ?? '-'}</p>
        <p><strong>Opis:</strong> {task.description || '-'}</p>
        <br />
        <p>Dodeljeno - {task.assignedToLabel || '-'}</p>
        <p>Rok - {formatDate(task.dueDate)}</p>
        <p>Utrošeno vreme - {task.timeSpentMinutes ? `${task.timeSpentMinutes} min` : '-'}</p>
        <p>Trošak materijala - {task.materialCost ?? '-'}</p>
        <p>Opis materijala:</p>
        <p>{task.materialDescription || '-'}</p>
        <div className="pulse-modal-actions">
          <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onHold}>STAVI NA ČEKANJE</button>
          <button className="pulse-modal-btn pulse-modal-btn-green" type="button" onClick={onDone}>ZAVRŠI TASK</button>
        </div>
      </div>
    </div>
  )
}

function UserHome() {
  const { currentUser } = useAuthStore()
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

  return (
    <section className="pulse-phone-screen">
      <h2>Tvoj fokus danas</h2>
      <Section title="Zadaci koji kasne" empty="Nema kašnjenja" items={toItems(buckets.late)} tone="red" onOpen={setOpened} />
      <Section title="Danas" empty="Nema zadataka za danas" items={toItems(buckets.today)} tone="white" onOpen={setOpened} />
      <Section title="U radu" empty="Nema aktivnih zadataka" items={toItems(buckets.inProgress)} tone="blue" onOpen={setOpened} />
      {opened ? <TaskModal task={opened} item={openedItem} onClose={() => setOpened(null)} onHold={() => { updateTask({ ...opened, status: 'na_cekanju', updatedAt: new Date().toISOString() }); setOpened(null) }} onDone={() => { updateTask({ ...opened, status: 'zavrsen', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); setOpened(null) }} /> : null}
    </section>
  )
}

export default UserHome
