import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClientStore } from '../clientStore'
import ClientActionsBar from '../components/ClientActionsBar'
import ClientCommercialSection from '../components/ClientCommercialSection'
import ClientContactsSection from '../components/ClientContactsSection'
import ClientEditForm, { type ClientEditFormPatch } from '../components/ClientEditForm'
import ClientHeader from '../components/ClientHeader'
import ClientInfoSection from '../components/ClientInfoSection'
import ClientProjectsSection from '../components/ClientProjectsSection'
import { useBillingStore } from '../../billing/billingStore'
import { getClientScore } from '../../scoring/scoringSelectors'
import CreateTaskForm, {
  type CreateTaskFormValues,
} from '../../tasks/components/CreateTaskForm'
import ProjectForm, { type ProjectFormValues } from '../../projects/components/ProjectForm'
import { useProjectStore } from '../../projects/projectStore'
import type { Task } from '../../tasks/types'
import { useTaskStore } from '../../tasks/taskStore'
import type { Project } from '../../projects/types'
import './client-detail.css'

const PRIORITY_LABELS = {
  low: 'Nizak prioritet',
  medium: 'Srednji prioritet',
  high: 'Visok prioritet',
} as const

function ClientDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const clientId = id ?? ''
  const { clients, getClientById, updateClient } = useClientStore()
  const { tasks, addTask } = useTaskStore()
  const { projects: allProjects, getProjectsByClientId, addProject } = useProjectStore()
  const { billing } = useBillingStore()
  const [isEditingClient, setIsEditingClient] = useState(false)
  const [isCreatingActivity, setIsCreatingActivity] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const client = getClientById(clientId)
  const projects = getProjectsByClientId(clientId)
  const score = client
    ? getClientScore(String(client.id), {
        clients,
        projects: allProjects,
        tasks,
        billing,
      })
    : null

  const handleCreateActivity = (values: CreateTaskFormValues) => {
    if (!client) return

    const nextTask: Task = {
      id: `task-${Date.now()}`,
      clientId: String(client.id),
      projectId: values.projectId,
      title: values.title.trim() || 'Nova aktivnost',
      description: values.description.trim(),
      type: values.type || undefined,
      assignedToUserId: values.assignedToUserId,
      assignedToLabel: values.assignedToLabel.trim(),
      dueDate: values.dueDate || undefined,
      status: 'dodeljen',
    }

    addTask(nextTask)
    setIsCreatingActivity(false)
  }

  const handleCreateProject = (values: ProjectFormValues) => {
    if (!client) return

    const nextProject: Project = {
      id: `project-${Date.now()}`,
      clientId: String(client.id),
      title: values.title.trim() || 'Novi projekat',
      type: values.type || undefined,
      frequency: values.frequency || undefined,
      value: values.value.trim() ? Number(values.value) : undefined,
      status: 'aktivan',
    }

    addProject(nextProject)
    setIsCreatingProject(false)
  }

  const handleUpdateClient = (patch: ClientEditFormPatch) => {
    updateClient(clientId, patch)
    setIsEditingClient(false)
  }

  if (!client) {
    return (
      <section className="page-card client-detail-shell">
        <button
          type="button"
          className="secondary-link-button"
          onClick={() => navigate('/clients')}
        >
          Nazad na klijente
        </button>

        <div className="clients-empty-state">
          <h2>Klijent nije pronađen</h2>
          <p>Vrati se na listu klijenata i izaberi postojeći zapis.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-card client-detail-shell">
      <button
        type="button"
        className="secondary-link-button"
        onClick={() => navigate('/clients')}
      >
        Nazad na klijente
      </button>

      <ClientHeader
        name={client.name}
        city={client.city}
        pulseScore={score?.total}
        priorityLabel={score ? PRIORITY_LABELS[score.priority] : undefined}
        priorityTone={
          score?.priority === 'high'
            ? 'success'
            : score?.priority === 'medium'
              ? 'warning'
              : 'muted'
        }
        risks={score?.signals.risks ?? []}
      />
      <ClientActionsBar
        clientId={clientId}
        onEditClient={() => setIsEditingClient((current) => !current)}
        onNewActivity={() => setIsCreatingActivity((current) => !current)}
        onNewProject={() => setIsCreatingProject((current) => !current)}
      />
      {isEditingClient ? (
        <ClientEditForm
          client={client}
          onCancel={() => setIsEditingClient(false)}
          onSubmit={handleUpdateClient}
        />
      ) : null}
      {isCreatingProject ? (
        <ProjectForm
          onCancel={() => setIsCreatingProject(false)}
          onSubmit={handleCreateProject}
        />
      ) : null}
      {isCreatingActivity ? (
        <CreateTaskForm
          onCancel={() => setIsCreatingActivity(false)}
          onSubmit={handleCreateActivity}
          requireProjectSelection
          projectOptions={projects.map((project) => ({
            id: project.id,
            label: project.title,
          }))}
        />
      ) : null}
      <ClientInfoSection name={client.name} city={client.city} address={client.address} />
      <ClientContactsSection contacts={client.contacts} />
      <ClientCommercialSection {...client.commercial} />
      <ClientProjectsSection projects={projects} />
    </section>
  )
}

export default ClientDetail
