import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CreateTaskForm from '../../tasks/components/CreateTaskForm'
import type { CreateTaskFormValues } from '../../tasks/components/CreateTaskForm'
import TaskList from '../../tasks/components/TaskList'
import { getTasksByProjectId } from '../../tasks/selectors'
import type { Task } from '../../tasks/types'
import { getProjectById } from '../selectors'
import '../../clients/pages/client-detail.css'

function ProjectDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const projectId = id ?? ''
  const project = useMemo(() => getProjectById(projectId), [projectId])
  const projectTasks = useMemo(() => getTasksByProjectId(projectId), [projectId])
  const [tasks, setTasks] = useState<Task[]>(projectTasks)
  const [isCreatingTask, setIsCreatingTask] = useState(false)

  useEffect(() => {
    setTasks(projectTasks)
    setIsCreatingTask(false)
  }, [projectTasks])

  const handleTaskChange = (updatedTask: Task) => {
    setTasks((current) =>
      current.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
    )
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

    setTasks((current) => [nextTask, ...current])
    setIsCreatingTask(false)
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
      </header>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Osnovni podaci</h3>
        </div>

        <div className="customer-card-group">
          <dl className="customer-card-detail-list">
            <div>
              <dt>Status</dt>
              <dd>{project.status}</dd>
            </div>
            <div>
              <dt>Tip</dt>
              <dd>{project.type || '-'}</dd>
            </div>
            <div>
              <dt>Frekvencija</dt>
              <dd>{project.frequency || '-'}</dd>
            </div>
            <div>
              <dt>Vrednost</dt>
              <dd>{project.value ? `${project.value} RSD` : '-'}</dd>
            </div>
            <div>
              <dt>Billing status</dt>
              <dd>{project.billingStatus || '-'}</dd>
            </div>
          </dl>
        </div>
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
          />
        ) : null}

        <TaskList tasks={tasks} onTaskChange={handleTaskChange} />
      </section>
    </section>
  )
}

export default ProjectDetail
