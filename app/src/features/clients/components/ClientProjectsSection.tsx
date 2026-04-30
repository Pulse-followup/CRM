import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PROJECT_FREQUENCY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../../projects/projectLabels'
import { getProjectHealth } from '../../projects/projectHealth'
import { useProjectStore } from '../../projects/projectStore'
import type { Project } from '../../projects/types'
import TaskList from '../../tasks/components/TaskList'
import {
  getActiveTasks,
  getCompletedTasks,
  getTasksByProject as selectTasksByProject,
} from '../../tasks/taskSelectors'
import { useTaskStore } from '../../tasks/taskStore'

export interface ClientProjectsSectionProps {
  projects: Project[]
}

function ClientProjectsSection({ projects }: ClientProjectsSectionProps) {
  const navigate = useNavigate()
  const { archiveProject, restoreProject } = useProjectStore()
  const { tasks } = useTaskStore()
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([])
  const activeProjects = projects.filter((project) => project.status !== 'arhiviran')
  const archivedProjects = projects.filter((project) => project.status === 'arhiviran')

  const toggleProjectTasks = (projectId: string) => {
    setExpandedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    )
  }

  const renderProjectCard = (project: Project, archived = false) => {
    const projectTasks = selectTasksByProject(tasks, project.id)
    const projectHealth = getProjectHealth(project.id, projectTasks)
    const activeTaskCount = getActiveTasks(projectTasks).length
    const completedTaskCount = getCompletedTasks(projectTasks).length
    const isExpanded = expandedProjectIds.includes(project.id)

    return (
      <article key={project.id} className={`customer-project-card${archived ? ' is-archived' : ''}`}>
        <div className="customer-project-head">
          <div className="customer-project-heading">
            <strong>{project.title}</strong>
            <p className="customer-project-meta">
              {project.type ? PROJECT_TYPE_LABELS[project.type] : '-'}{' '}
              <span aria-hidden="true">-</span>{' '}
              {project.frequency ? PROJECT_FREQUENCY_LABELS[project.frequency] : '-'}
            </p>
          </div>
          <div className="customer-project-badges">
            <span className={`customer-status-badge${archived ? ' is-muted' : ''}`}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
            <span className={`customer-status-badge is-${projectHealth.tone}`}>
              {projectHealth.label}
            </span>
          </div>
        </div>

        <div className="customer-project-summary-grid">
          <div className="customer-project-summary-item">
            <span>Procenjena vrednost</span>
            <strong>{project.value ? `${project.value} RSD` : '-'}</strong>
          </div>
          <div className="customer-project-summary-item">
            <span>Task summary</span>
            <strong>
              Ukupno: {projectTasks.length} - Aktivni: {activeTaskCount} - Zavrseni: {completedTaskCount}
            </strong>
          </div>
        </div>

        <div className="customer-project-actions">
          <button
            type="button"
            className="customer-project-action-button"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            Otvori projekat
          </button>
          <button
            type="button"
            className="customer-project-action-button customer-project-action-button-secondary"
            onClick={() => toggleProjectTasks(project.id)}
          >
            {isExpanded ? 'Sakrij taskove' : 'Prikazi taskove'}
          </button>
          <button
            type="button"
            className="customer-project-action-button customer-project-action-button-secondary"
            onClick={() => (archived ? restoreProject(project.id) : archiveProject(project.id))}
          >
            {archived ? 'Vrati iz arhive' : 'Arhiviraj'}
          </button>
        </div>

        {isExpanded ? <TaskList tasks={projectTasks} /> : null}
      </article>
    )
  }

  return (
    <section className="customer-card-section">
      <div className="customer-card-section-head">
        <h3>Projekti</h3>
      </div>

      {activeProjects.length ? (
        <div className="customer-card-stack">{activeProjects.map((project) => renderProjectCard(project))}</div>
      ) : (
        <div className="customer-card-empty">Nema projekata</div>
      )}

      {archivedProjects.length > 0 && (
        <details className="customer-archived-projects">
          <summary>Arhivirani projekti</summary>
          <div className="customer-card-stack">
            {archivedProjects.map((project) => renderProjectCard(project, true))}
          </div>
        </details>
      )}
    </section>
  )
}

export default ClientProjectsSection