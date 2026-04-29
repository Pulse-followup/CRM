import { useState } from 'react'
import type { CreateBillingPayload } from '../types'

export interface BillingFormProps {
  onCancel: () => void
  onSubmit: (values: CreateBillingPayload) => void
  initialDescription?: string
}

interface BillingFormValues {
  description: string
  amount: string
  currency: string
  dueDate: string
  invoiceNumber: string
}

interface BillingFormErrors {
  description?: string
  amount?: string
}

function BillingForm({ onCancel, onSubmit, initialDescription = '' }: BillingFormProps) {
  const [values, setValues] = useState<BillingFormValues>({
    description: initialDescription,
    amount: '',
    currency: 'RSD',
    dueDate: '',
    invoiceNumber: '',
  })
  const [errors, setErrors] = useState<BillingFormErrors>({})

  const handleChange =
    (field: keyof BillingFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValues((current) => ({
        ...current,
        [field]: event.target.value,
      }))
      setErrors((current) => ({
        ...current,
        [field]: undefined,
      }))
    }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: BillingFormErrors = {
      description: values.description.trim() ? undefined : 'Opis je obavezan.',
      amount:
        values.amount.trim() && Number(values.amount) > 0
          ? undefined
          : 'Iznos mora biti broj veci od 0.',
    }

    if (nextErrors.description || nextErrors.amount) {
      setErrors(nextErrors)
      return
    }

    onSubmit({
      description: values.description.trim(),
      amount: Number(values.amount),
      currency: values.currency.trim() || 'RSD',
      dueDate: values.dueDate || null,
      invoiceNumber: values.invoiceNumber.trim(),
    })
  }

  return (
    <form className="customer-task-create-form" onSubmit={handleSubmit}>
      <label className="customer-task-form-field">
        <span>Opis</span>
        <textarea value={values.description} onChange={handleChange('description')} />
        {errors.description ? (
          <small className="customer-task-form-error">{errors.description}</small>
        ) : null}
      </label>
      <label className="customer-task-form-field">
        <span>Iznos</span>
        <input type="number" min="0" step="0.01" value={values.amount} onChange={handleChange('amount')} />
        {errors.amount ? <small className="customer-task-form-error">{errors.amount}</small> : null}
      </label>
      <label className="customer-task-form-field">
        <span>Valuta</span>
        <input type="text" value={values.currency} onChange={handleChange('currency')} />
      </label>
      <label className="customer-task-form-field">
        <span>Rok placanja</span>
        <input type="date" value={values.dueDate} onChange={handleChange('dueDate')} />
      </label>
      <label className="customer-task-form-field">
        <span>Broj fakture</span>
        <input type="text" value={values.invoiceNumber} onChange={handleChange('invoiceNumber')} />
      </label>
      <div className="customer-task-actions">
        <button type="submit" className="customer-project-toggle">
          Sacuvaj nalog
        </button>
        <button type="button" className="customer-project-toggle" onClick={onCancel}>
          Otkazi
        </button>
      </div>
    </form>
  )
}

export default BillingForm
