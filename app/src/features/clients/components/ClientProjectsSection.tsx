import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PROJECT_FREQUENCY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../../projects/projectLabels'
import { useProjectStore } from '../../projects/projectStore'
import type { Project } from '../../projects/types'
import TaskList from '../../tasks/components/TaskList'
import { useTaskStore } from '../../tasks/taskStore'
import type { TaskStatus } from '../../tasks/types'

export interface ClientProjectsSectionProps {
  projects: Project[]
}

function ClientProjectsSection({ projects }: ClientProjectsSectionProps) {
  const navigate = useNavigate()
  const { archiveProject, restoreProject } = useProjectStore()
  const { getTasksByProjectId } = useTaskStore()
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([])
  const activeProjects = projects.filter((project) => project.status !== 'arhiviran')
  const archivedProjects = projects.filter((project) => project.status === 'arhiviran')
  const activeTaskStatuses: TaskStatus[] = ['dodeljen', 'u_radu', 'na_cekanju', 'vracen']
  const completedTaskStatuses: TaskStatus[] = ['zavrsen', 'poslat_na_naplatu', 'naplacen']

  const toggleProjectTasks = (projectId: string) => {
    setExpandedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    )
  }

  return (
    <section className="customer-card-section">
      <div className="customer-card-section-head">
        <h3>Projekti</h3>
      </div>

      {activeProjects.length ? (
        <div className="customer-card-stack">
          {activeProjects.map((project) => {
            const projectTasks = getTasksByProjectId(project.id)
            const activeTaskCount = projectTasks.filter((task) =>
              activeTaskStatuses.includes(task.status),
            ).length
            const completedTaskCount = projectTasks.filter((task) =>
              completedTaskStatuses.includes(task.status),
            ).length
            const isExpanded = expandedProjectIds.includes(project.id)

            return (
              <article key={project.id} className="customer-project-card">
                <div className="customer-project-head">
                  <strong>{project.title}</strong>
                  <span className="customer-status-badge">
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                </div>
                <p className="customer-project-meta">
                  {project.type ? PROJECT_TYPE_LABELS[project.type] : '-'} •{' '}
                  {project.frequency ? PROJECT_FREQUENCY_LABELS[project.frequency] : '-'}
                </p>
                <p className="customer-project-meta customer-project-meta-secondary">
                  Procenjena vrednost: {project.value ? `${project.value} RSD` : '-'}
                </p>
                <p className="customer-project-meta customer-project-meta-secondary">
                  Taskovi: {projectTasks.length} • Aktivni: {activeTaskCount} • Zavrseni:{' '}
                  {completedTaskCount}
                </p>
                <div className="customer-project-actions">
                  <button
                    type="button"
                    className="customer-project-toggle"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    Otvori projekat
                  </button>
                  <button
                    type="button"
                    className="customer-project-toggle"
                    onClick={() => toggleProjectTasks(project.id)}
                  >
                    {isExpanded ? 'Sakrij taskove' : 'Prikazi taskove'}
                  </button>
                  <button
                    type="button"
                    className="customer-project-toggle"
                    onClick={() => archiveProject(project.id)}
                  >
                    Arhiviraj
                  </button>
                </div>
                {isExpanded ? <TaskList tasks={projectTasks} /> : null}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="customer-card-empty">Nema projekata</div>
      )}

      {archivedProjects.length > 0 && (
        <details className="customer-archived-projects">
          <summary>Arhivirani projekti</summary>
          <div className="customer-card-stack">
            {archivedProjects.map((project) => {
              const projectTasks = getTasksByProjectId(project.id)
              const activeTaskCount = projectTasks.filter((task) =>
                activeTaskStatuses.includes(task.status),
              ).length
              const completedTaskCount = projectTasks.filter((task) =>
                completedTaskStatuses.includes(task.status),
              ).length
              const isExpanded = expandedProjectIds.includes(project.id)

              return (
                <article key={project.id} className="customer-project-card">
                  <div className="customer-project-head">
                    <strong>{project.title}</strong>
                    <span className="customer-status-badge is-muted">
                      {PROJECT_STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="customer-project-meta">
                    {project.type ? PROJECT_TYPE_LABELS[project.type] : '-'} •{' '}
                    {project.frequency ? PROJECT_FREQUENCY_LABELS[project.frequency] : '-'}
                  </p>
                  <p className="customer-project-meta customer-project-meta-secondary">
                    Taskovi: {projectTasks.length} • Aktivni: {activeTaskCount} • Zavrseni:{' '}
                    {completedTaskCount}
                  </p>
                  <div className="customer-project-actions">
                    <button
                      type="button"
                      className="customer-project-toggle"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      Otvori projekat
                    </button>
                    <button
                      type="button"
                      className="customer-project-toggle"
                      onClick={() => toggleProjectTasks(project.id)}
                    >
                      {isExpanded ? 'Sakrij taskove' : 'Prikazi taskove'}
                    </button>
                    <button
                      type="button"
                      className="customer-project-toggle"
                      onClick={() => restoreProject(project.id)}
                    >
                      Vrati iz arhive
                    </button>
                  </div>
                  {isExpanded ? <TaskList tasks={projectTasks} /> : null}
                </article>
              )
            })}
          </div>
        </details>
      )}
    </section>
  )
}

export default ClientProjectsSection
