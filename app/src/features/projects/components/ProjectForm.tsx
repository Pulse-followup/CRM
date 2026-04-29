import { useState } from 'react'
import {
  PROJECT_FREQUENCY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../projectLabels'
import type { ProjectFrequency, ProjectStatus, ProjectType } from '../types'

export interface ProjectFormValues {
  title: string
  type: ProjectType | ''
  frequency: ProjectFrequency | ''
  value: string
  status: ProjectStatus | ''
}

export interface ProjectFormProps {
  onCancel: () => void
  onSubmit: (values: ProjectFormValues) => void
}

const initialValues: ProjectFormValues = {
  title: '',
  type: '',
  frequency: '',
  value: '',
  status: 'aktivan',
}

type FormErrors = Partial<Record<'title' | 'type' | 'frequency' | 'value', string>>

function ProjectForm({ onCancel, onSubmit }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})

  const handleChange =
    (field: keyof ProjectFormValues) =>
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}

    if (!values.title.trim()) {
      nextErrors.title = 'Naziv projekta je obavezan.'
    }
    if (!values.type) {
      nextErrors.type = 'Tip projekta je obavezan.'
    }
    if (!values.frequency) {
      nextErrors.frequency = 'Frekvencija je obavezna.'
    }
    if (values.value.trim() && Number.isNaN(Number(values.value))) {
      nextErrors.value = 'Procenjena vrednost mora biti broj.'
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
        <span>Naziv projekta</span>
        <input type="text" value={values.title} onChange={handleChange('title')} />
        {errors.title ? <small className="customer-task-form-error">{errors.title}</small> : null}
      </label>

      <label className="customer-task-form-field">
        <span>Tip</span>
        <select value={values.type} onChange={handleChange('type')}>
          <option value="">Izaberi tip</option>
          {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.type ? <small className="customer-task-form-error">{errors.type}</small> : null}
      </label>

      <label className="customer-task-form-field">
        <span>Frekvencija</span>
        <select value={values.frequency} onChange={handleChange('frequency')}>
          <option value="">Izaberi frekvenciju</option>
          {Object.entries(PROJECT_FREQUENCY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.frequency ? (
          <small className="customer-task-form-error">{errors.frequency}</small>
        ) : null}
      </label>

      <label className="customer-task-form-field">
        <span>Procenjena vrednost</span>
        <input type="number" min="0" step="1" value={values.value} onChange={handleChange('value')} />
        {errors.value ? <small className="customer-task-form-error">{errors.value}</small> : null}
      </label>

      <label className="customer-task-form-field">
        <span>Status</span>
        <select value={values.status} onChange={handleChange('status')}>
          {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="customer-task-actions">
        <button type="submit" className="customer-project-toggle">
          Sacuvaj projekat
        </button>
        <button type="button" className="customer-project-toggle" onClick={onCancel}>
          Otkazi
        </button>
      </div>
    </form>
  )
}

export default ProjectForm
