import { useEffect, useMemo, useState } from 'react'
import type { ProjectStage } from '../../projects/types'
import { PROJECT_STAGE_ROLE_LABELS } from '../../projects/projectTemplates'
import { mockUsers } from '../../workspace/mockUsers'
import { TASK_TYPE_LABELS } from '../taskLabels'
import type { TaskType } from '../types'

export interface CreateTaskFormValues {
  title: string
  description: string
  projectId: string
  stageId: string
  type: TaskType | ''
  assignedToUserId: string
  assignedToLabel: string
  dueDate: string
}

export interface CreateTaskProjectOption {
  id: string
  label: string
  stages?: ProjectStage[]
}

export interface CreateTaskFormProps {
  onCancel: () => void
  onSubmit: (values: CreateTaskFormValues) => void
  projectOptions?: CreateTaskProjectOption[]
  requireProjectSelection?: boolean
  initialProjectId?: string
  initialStageId?: string
}

const initialValues: CreateTaskFormValues = {
  title: '',
  description: '',
  projectId: '',
  stageId: '',
  type: '',
  assignedToUserId: '',
  assignedToLabel: '',
  dueDate: '',
}

type FormErrors = Partial<
  Record<'title' | 'projectId' | 'type' | 'assignedToUserId' | 'dueDate', string>
>

const taskTypeOptions: TaskType[] = [
  'poziv',
  'mail',
  'sastanak',
  'follow_up',
  'ponuda',
  'naplata',
  'interni_zadatak',
  'drugo',
]

function getDefaultStageId(stages?: ProjectStage[], preferredStageId?: string) {
  if (!stages?.length) {
    return ''
  }

  if (preferredStageId && stages.some((stage) => stage.id === preferredStageId)) {
    return preferredStageId
  }

  const activeStage = stages.find((stage) => stage.status === 'active')
  return activeStage?.id ?? stages[0]?.id ?? ''
}

function formatStageOption(stage: ProjectStage) {
  const roleLabel = stage.defaultRole
    ? PROJECT_STAGE_ROLE_LABELS[stage.defaultRole as keyof typeof PROJECT_STAGE_ROLE_LABELS] ??
      stage.defaultRole
    : null

  return roleLabel ? `${stage.name} · ${roleLabel}` : stage.name
}

function CreateTaskForm({
  onCancel,
  onSubmit,
  projectOptions = [],
  requireProjectSelection = false,
  initialProjectId,
  initialStageId,
}: CreateTaskFormProps) {
  const [values, setValues] = useState<CreateTaskFormValues>({
    ...initialValues,
    projectId: initialProjectId ?? initialValues.projectId,
    stageId: initialStageId ?? initialValues.stageId,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const assignableUsers = mockUsers.filter((user) => user.role !== 'admin')

  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.id === values.projectId),
    [projectOptions, values.projectId],
  )

  const availableStages = selectedProject?.stages
    ? [...selectedProject.stages].sort((left, right) => left.order - right.order)
    : []

  useEffect(() => {
    if (requireProjectSelection) {
      return
    }

    if (initialProjectId && values.projectId !== initialProjectId) {
      setValues((current) => ({
        ...current,
        projectId: initialProjectId,
      }))
    }
  }, [initialProjectId, requireProjectSelection, values.projectId])

  useEffect(() => {
    const nextStageId = getDefaultStageId(availableStages, values.stageId || initialStageId)

    if (nextStageId !== values.stageId) {
      setValues((current) => ({
        ...current,
        stageId: nextStageId,
      }))
    }
  }, [availableStages, initialStageId, values.stageId])

  const handleChange =
    (field: keyof CreateTaskFormValues) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => {
      setValues((current) => ({
        ...current,
        [field]: event.target.value,
      }))
      setErrors((current) => ({
        ...current,
        [field]: '',
      }))
    }

  const handleProjectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextProjectId = event.target.value
    const nextProject = projectOptions.find((project) => project.id === nextProjectId)
    const nextStages = nextProject?.stages
      ? [...nextProject.stages].sort((left, right) => left.order - right.order)
      : []
    const nextStageId = getDefaultStageId(nextStages)

    setValues((current) => ({
      ...current,
      projectId: nextProjectId,
      stageId: nextStageId,
    }))
    setErrors((current) => ({
      ...current,
      projectId: '',
    }))
  }

  const handleAssignedUserChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUser = assignableUsers.find((user) => user.id === event.target.value)

    setValues((current) => ({
      ...current,
      assignedToUserId: event.target.value,
      assignedToLabel: selectedUser?.name || '',
    }))
    setErrors((current) => ({
      ...current,
      assignedToUserId: '',
    }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}

    if (!values.title.trim()) {
      nextErrors.title = 'Naslov je obavezan.'
    }
    if (requireProjectSelection && !values.projectId) {
      nextErrors.projectId = 'Projekat je obavezan.'
    }
    if (!values.type) {
      nextErrors.type = 'Tip taska je obavezan.'
    }
    if (!values.assignedToUserId) {
      nextErrors.assignedToUserId = 'Dodeljeni korisnik je obavezan.'
    }
    if (!values.dueDate) {
      nextErrors.dueDate = 'Rok je obavezan.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onSubmit(values)
    setValues({
      ...initialValues,
      projectId: initialProjectId ?? initialValues.projectId,
      stageId: initialStageId ?? initialValues.stageId,
    })
    setErrors({})
  }

  return (
    <form className="customer-task-create-form" onSubmit={handleSubmit}>
      {requireProjectSelection ? (
        <label className="customer-task-form-field">
          <span>Projekat</span>
          <select value={values.projectId} onChange={handleProjectChange}>
            <option value="">Izaberi projekat</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
          {errors.projectId ? (
            <small className="customer-task-form-error">{errors.projectId}</small>
          ) : null}
        </label>
      ) : null}

      {availableStages.length ? (
        <label className="customer-task-form-field">
          <span>Faza</span>
          <select value={values.stageId} onChange={handleChange('stageId')}>
            {availableStages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {formatStageOption(stage)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="customer-task-form-field">
        <span>Naslov</span>
        <input type="text" value={values.title} onChange={handleChange('title')} />
        {errors.title ? <small className="customer-task-form-error">{errors.title}</small> : null}
      </label>

      <label className="customer-task-form-field">
        <span>Opis</span>
        <textarea value={values.description} onChange={handleChange('description')} />
      </label>

      <label className="customer-task-form-field">
        <span>Tip</span>
        <select value={values.type} onChange={handleChange('type')}>
          <option value="">Izaberi tip</option>
          {taskTypeOptions.map((option) => (
            <option key={option} value={option}>
              {TASK_TYPE_LABELS[option]}
            </option>
          ))}
        </select>
        {errors.type ? <small className="customer-task-form-error">{errors.type}</small> : null}
      </label>

      <label className="customer-task-form-field">
        <span>Dodeljeno</span>
        <select value={values.assignedToUserId} onChange={handleAssignedUserChange}>
          <option value="">Izaberi korisnika</option>
          {assignableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        {errors.assignedToUserId ? (
          <small className="customer-task-form-error">{errors.assignedToUserId}</small>
        ) : null}
      </label>

      <label className="customer-task-form-field">
        <span>Rok</span>
        <input type="date" value={values.dueDate} onChange={handleChange('dueDate')} />
        {errors.dueDate ? <small className="customer-task-form-error">{errors.dueDate}</small> : null}
      </label>

      <div className="customer-task-actions">
        <button type="submit" className="customer-project-toggle">
          Sacuvaj task
        </button>
        <button type="button" className="customer-project-toggle" onClick={onCancel}>
          Otkazi
        </button>
      </div>
    </form>
  )
}

export default CreateTaskForm