import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClientStore } from '../features/clients/clientStore'
import {
  PROJECT_FREQUENCY_LABELS,
  PROJECT_TYPE_LABELS,
} from '../features/projects/projectLabels'
import { useProjectStore } from '../features/projects/projectStore'
import { getProjectLifecycle, type ProjectLifecycleStatus } from '../features/projects/projectLifecycle'
import { useTaskStore } from '../features/tasks/taskStore'
import { useBillingStore } from '../features/billing/billingStore'
import { BILLING_STATUS_LABELS } from '../features/billing/billingLabels'

function getLifecycleBillingLabel(status?: keyof typeof BILLING_STATUS_LABELS | 'issued' | 'closed') {
  if (!status) return null
  if (status === 'issued') return 'Poslato'
  if (status === 'closed') return 'Placeno'
  return BILLING_STATUS_LABELS[status]
}

function ProjectsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { getAllClients } = useClientStore()
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const { billing } = useBillingStore()
  const clients = getAllClients()
  const initialClientId = searchParams.get('clientId') || 'all'
  const initialStatus = (searchParams.get('status') as ProjectLifecycleStatus | null) || 'active'
  const [selectedClientId, setSelectedClientId] = useState(initialClientId)
  const [selectedStatus, setSelectedStatus] = useState<ProjectLifecycleStatus>(
    ['setup', 'active', 'billing', 'completed', 'overdue', 'closed'].includes(initialStatus) ? initialStatus : 'active',
  )
  const projectsStageRef = useRef<HTMLDivElement | null>(null)

  const clientById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client])),
    [clients],
  )

  const nonArchivedProjects = useMemo(
    () => projects.filter((project) => project.status !== 'arhiviran'),
    [projects],
  )

  const projectsWithLifecycle = useMemo(
    () => nonArchivedProjects.map((project) => ({
      project,
      lifecycle: getProjectLifecycle(project, tasks, billing),
    })),
    [billing, nonArchivedProjects, tasks],
  )

  const statusCounts = useMemo(
    () => ({
      setup: projectsWithLifecycle.filter((item) => item.lifecycle.status === 'setup').length,
      active: projectsWithLifecycle.filter((item) => item.lifecycle.status === 'active').length,
      billing: projectsWithLifecycle.filter((item) => item.lifecycle.status === 'billing').length,
      completed: projectsWithLifecycle.filter((item) => item.lifecycle.status === 'completed').length,
    }),
    [projectsWithLifecycle],
  )

  const visibleProjects = useMemo(() => {
    return projectsWithLifecycle.filter(({ project, lifecycle }) => {
      const clientMatch = selectedClientId === 'all' || String(project.clientId) === selectedClientId
      return clientMatch && lifecycle.status === selectedStatus
    })
  }, [projectsWithLifecycle, selectedClientId, selectedStatus])

  const writeFiltersToUrl = (clientId: string, status: ProjectLifecycleStatus) => {
    const next: Record<string, string> = {}
    if (clientId !== 'all') next.clientId = clientId
    if (status !== 'active') next.status = status
    setSearchParams(next)
  }

  const changeClient = (clientId: string) => {
    setSelectedClientId(clientId)
    writeFiltersToUrl(clientId, selectedStatus)
  }

  const changeStatus = (status: ProjectLifecycleStatus) => {
    setSelectedStatus(status)
    writeFiltersToUrl(selectedClientId, status)
  }

  useEffect(() => {
    if (!projectsStageRef.current) return

    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>('.projects-command-card')
      if (!cards.length) return

      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 24, rotateX: 3, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          scale: 1,
          duration: 0.5,
          ease: 'power3.out',
          stagger: 0.07,
          clearProps: 'transform,opacity',
        },
      )
    }, projectsStageRef)

    return () => ctx.revert()
  }, [selectedClientId, selectedStatus, visibleProjects.length])

  return (
    <section className="page-card projects-page-shell projects-command-page">
      <div className="projects-page-header">
        <button
          type="button"
          className="projects-dashboard-link"
          onClick={() => navigate('/')}
        >
          ← Dashboard
        </button>
        <div className="projects-page-title-block">
          <p className="projects-page-kicker">Project command view</p>
          <h1>PROJEKTI</h1>
          <p>Pregled poslova, faza i naplate</p>
        </div>
      </div>

      <div className="project-client-filter project-status-filter projects-filter-row" aria-label="Filter po statusu projekta">
        <button
          type="button"
          className={`project-filter-bubble${selectedStatus === 'setup' ? ' is-active' : ''}`}
          onClick={() => changeStatus('setup')}
        >
          U pripremi <span>{statusCounts.setup}</span>
        </button>
        <button
          type="button"
          className={`project-filter-bubble${selectedStatus === 'active' ? ' is-active' : ''}`}
          onClick={() => changeStatus('active')}
        >
          Aktivni <span>{statusCounts.active}</span>
        </button>
        <button
          type="button"
          className={`project-filter-bubble${selectedStatus === 'billing' ? ' is-active' : ''}`}
          onClick={() => changeStatus('billing')}
        >
          Na naplati <span>{statusCounts.billing}</span>
        </button>
        <button
          type="button"
          className={`project-filter-bubble${selectedStatus === 'completed' ? ' is-active' : ''}`}
          onClick={() => changeStatus('completed')}
        >
          Završeni <span>{statusCounts.completed}</span>
        </button>
      </div>

      <div className="project-client-filter projects-filter-row projects-client-filter" aria-label="Filter po klijentu">
        <button
          type="button"
          className={`project-filter-bubble${selectedClientId === 'all' ? ' is-active' : ''}`}
          onClick={() => changeClient('all')}
        >
          Svi
        </button>
        {clients.map((client) => {
          const id = String(client.id)
          const count = projectsWithLifecycle.filter((item) => item.lifecycle.status === selectedStatus && String(item.project.clientId) === id).length
          return (
            <button
              key={id}
              type="button"
              className={`project-filter-bubble${selectedClientId === id ? ' is-active' : ''}`}
              onClick={() => changeClient(id)}
            >
              {client.name}
              <span>{count}</span>
            </button>
          )
        })}
      </div>

      {visibleProjects.length ? (
        <div ref={projectsStageRef} className="projects-wide-list projects-command-grid">
          {visibleProjects.map(({ project, lifecycle }) => {
            const client = clientById.get(String(project.clientId))
            const projectValue = project.value || (project.unitPrice && project.quantity ? project.unitPrice * project.quantity : 0)
            const commercialLine = project.unitPrice && project.quantity
              ? `${project.quantity} kom × ${Math.round(project.unitPrice).toLocaleString('sr-RS')} RSD = ${Math.round(projectValue).toLocaleString('sr-RS')} RSD`
              : projectValue ? `${Math.round(projectValue).toLocaleString('sr-RS')} RSD` : ''

            return (
              <button
                key={project.id}
                type="button"
                className="project-wide-card project-lifecycle-card projects-command-card"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div className="project-wide-main">
                  <span className="project-wide-client">{client?.name || 'Nepoznat klijent'}</span>
                  <strong>{project.title}</strong>
                  <p>
                    {project.type ? PROJECT_TYPE_LABELS[project.type] : 'Bez tipa'} ·{' '}
                    {project.frequency ? PROJECT_FREQUENCY_LABELS[project.frequency] : 'Bez frekvencije'}
                  </p>
                  {commercialLine ? <p className="project-commercial-mini">{commercialLine}</p> : null}
                </div>
                <div className="project-wide-status">
                  <span className={`customer-status-badge is-${lifecycle.tone}`}>{lifecycle.label}</span>
                  {lifecycle.billingStatus ? <span className="customer-status-badge is-muted">Naplata: {getLifecycleBillingLabel(lifecycle.billingStatus)}</span> : null}
                </div>
                <div className="project-wide-stats">
                  <span>Koraci</span>
                  <strong>{lifecycle.totalTaskCount ? `${lifecycle.completedTaskCount}/${lifecycle.totalTaskCount} završeno` : 'Taskovi nisu kreirani'}</strong>
                  {lifecycle.totalTaskCount ? (
                    <span className="project-progress-track" aria-hidden="true">
                      <i style={{ width: `${Math.round((lifecycle.completedTaskCount / lifecycle.totalTaskCount) * 100)}%` }} />
                    </span>
                  ) : null}
                  {lifecycle.status === 'setup' ? <em>U pripremi</em> : null}
                  {lifecycle.status === 'active' ? <em>{lifecycle.activeTaskCount} aktivno</em> : null}
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="clients-empty-state">
          <h2>Nema projekata za izabrani filter</h2>
          <p>Promeni status ili filter po klijentu.</p>
        </div>
      )}
    </section>
  )
}

export default ProjectsPage
