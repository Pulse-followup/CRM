import { useState } from 'react'
import { mockUsers } from '../../workspace/mockUsers'
import { TASK_TYPE_LABELS } from '../taskLabels'
import type { TaskType } from '../types'

export interface CreateTaskFormValues {
  title: string
  description: string
  projectId: string
  type: TaskType | ''
  assignedToUserId: string
  assignedToLabel: string
  dueDate: string
}

export interface CreateTaskProjectOption {
  id: string
  label: string
}

export interface CreateTaskFormProps {
  onCancel: () => void
  onSubmit: (values: CreateTaskFormValues) => void
  projectOptions?: CreateTaskProjectOption[]
  requireProjectSelection?: boolean
}

const initialValues: CreateTaskFormValues = {
  title: '',
  description: '',
  projectId: '',
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

function CreateTaskForm({
  onCancel,
  onSubmit,
  projectOptions = [],
  requireProjectSelection = false,
}: CreateTaskFormProps) {
  const [values, setValues] = useState<CreateTaskFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const assignableUsers = mockUsers.filter((user) => user.role !== 'admin')

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
    setValues(initialValues)
    setErrors({})
  }

  return (
    <form className="customer-task-create-form" onSubmit={handleSubmit}>
      {requireProjectSelection ? (
        <label className="customer-task-form-field">
          <span>Projekat</span>
          <select value={values.projectId} onChange={handleChange('projectId')}>
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
