import { useState } from 'react'
import { mockUsers } from '../../workspace/mockUsers'
import type { TaskType } from '../types'

export interface CreateTaskFormValues {
  title: string
  description: string
  type: TaskType | ''
  assignedToUserId: string
  assignedToLabel: string
  dueDate: string
}

export interface CreateTaskFormProps {
  onCancel: () => void
  onSubmit: (values: CreateTaskFormValues) => void
}

const initialValues: CreateTaskFormValues = {
  title: '',
  description: '',
  type: '',
  assignedToUserId: '',
  assignedToLabel: '',
  dueDate: '',
}

type FormErrors = Partial<Record<'title' | 'type' | 'assignedToUserId' | 'dueDate', string>>

const taskTypeOptions: Array<{ value: TaskType; label: string }> = [
  { value: 'poziv', label: 'Poziv' },
  { value: 'mail', label: 'Mail' },
  { value: 'sastanak', label: 'Sastanak' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'ponuda', label: 'Ponuda' },
  { value: 'naplata', label: 'Naplata' },
  { value: 'interni_zadatak', label: 'Interni zadatak' },
  { value: 'drugo', label: 'Drugo' },
]

function CreateTaskForm({ onCancel, onSubmit }: CreateTaskFormProps) {
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
            <option key={option.value} value={option.value}>
              {option.label}
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
