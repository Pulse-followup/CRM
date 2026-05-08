import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBillingStore } from '../../billing/billingStore'
import { PROJECT_FREQUENCY_LABELS, PROJECT_TYPE_LABELS } from '../../projects/projectLabels'
import { getProjectHealth } from '../../projects/projectHealth'
import { getProjectLifecycle, getProjectProgress } from '../../projects/projectLifecycle'
import { useProjectStore } from '../../projects/projectStore'
import type { Project } from '../../projects/types'
import { readProducts } from '../../products/productStorage'
import { readProcessTemplates } from '../../templates/templateStorage'
import TaskList from '../../tasks/components/TaskList'
import { getActiveTasks, getTasksByProject as selectTasksByProject } from '../../tasks/taskSelectors'
import { useTaskStore } from '../../tasks/taskStore'

export interface ClientProjectsSectionProps {
  projects: Project[]
  title?: string
  emptyText?: string
  hideArchived?: boolean
}

function ClientProjectsSection({ projects, title = 'Projekti', emptyText = 'Nema projekata', hideArchived = false }: ClientProjectsSectionProps) {
  const navigate = useNavigate()
  const { archiveProject, restoreProject } = useProjectStore()
  const { tasks } = useTaskStore()
  const { billing } = useBillingStore()
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([])
  const activeProjects = hideArchived
    ? projects
    : projects.filter((project) => project.status !== 'arhiviran' && getProjectLifecycle(project, tasks, billing).status === 'active')
  const archivedProjects = hideArchived ? [] : projects.filter((project) => project.status === 'arhiviran')
  const products = readProducts()
  const processTemplates = readProcessTemplates()

  const getProjectSourceLabel = (project: Project) => {
    if (project.source !== 'product' && !project.sourceProductId) return ''
    const productTitle = project.sourceProductTitle || products.find((product) => product.id === project.sourceProductId)?.title || 'proizvoda'
    return `IZ: ${productTitle}`
  }

  const getProjectTemplateLabel = (project: Project) => {
    if (!project.sourceTemplateId && !project.sourceTemplateTitle) return ''
    return project.sourceTemplateTitle || processTemplates.find((template) => template.id === project.sourceTemplateId)?.title || ''
  }

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
    const lifecycle = getProjectLifecycle(project, tasks, billing)
    const progress = getProjectProgress(projectTasks)
    const activeTaskCount = getActiveTasks(projectTasks).length
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
              {lifecycle.label}
            </span>
            <span className={`customer-status-badge is-${projectHealth.tone}`}>
              {projectHealth.label}
            </span>
            {getProjectSourceLabel(project) ? (
              <span className="customer-status-badge is-info">{getProjectSourceLabel(project)}</span>
            ) : null}
          </div>
        </div>

        {getProjectTemplateLabel(project) ? (
          <p className="customer-source-note">Sablon procesa: <strong>{getProjectTemplateLabel(project)}</strong></p>
        ) : null}

        <div className="customer-project-summary-grid">
          <div className="customer-project-summary-item">
            <span>Procenjena vrednost</span>
            <strong>{project.value ? `${project.value} RSD` : '-'}</strong>
          </div>
          <div className="customer-project-summary-item">
            <span>Task summary</span>
            <strong>
              Ukupno: {progress.totalTasks} - Aktivni: {activeTaskCount} - Zavrseni: {progress.completedTasks}
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
    <details className="customer-card-section customer-card-collapsible">
      <summary className="customer-card-section-head">
        <h3>{title}</h3>
        <span className="customer-collapse-icon" aria-hidden="true">▾</span>
      </summary>

      <div className="customer-card-section-body">
        {activeProjects.length ? (
          <div className="customer-card-stack">{activeProjects.map((project) => renderProjectCard(project, project.status === 'arhiviran'))}</div>
        ) : (
          <div className="customer-card-empty">{emptyText}</div>
        )}

        {!hideArchived && archivedProjects.length > 0 && (
          <details className="customer-archived-projects">
            <summary>Arhivirani projekti</summary>
            <div className="customer-card-stack">
              {archivedProjects.map((project) => renderProjectCard(project, true))}
            </div>
          </details>
        )}
      </div>
    </details>
  )
}

export default ClientProjectsSection
