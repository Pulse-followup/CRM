import { useEffect, useState } from 'react'
import {
  BUSINESS_TYPE_OPTIONS,
  DECISION_LEVEL_OPTIONS,
  INNOVATION_READY_OPTIONS,
  RELATIONSHIP_LEVEL_OPTIONS,
  REVENUE_BAND_OPTIONS,
} from '../clientCommercialOptions'
import type { Client, ClientContact, CommercialInputs } from '../types'

export interface ClientEditFormPatch {
  name: string
  city: string
  address: string
  contacts: ClientContact[]
  commercial: CommercialInputs
}

export interface ClientEditFormProps {
  client: Client
  onCancel: () => void
  onSubmit: (patch: ClientEditFormPatch) => void
}

interface ClientEditValues {
  name: string
  city: string
  address: string
  contacts: ClientContact[]
  commercial: CommercialInputs
}

type ContactError = {
  name?: string
  role?: string
}

type FormErrors = {
  contacts: ContactError[]
}

const CONTACT_ROLE_OPTIONS = [
  { value: 'vlasnik/direktor', label: 'Vlasnik/direktor' },
  { value: 'prodaja', label: 'Prodaja' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'logistika', label: 'Logistika' },
  { value: 'finansije', label: 'Finansije' },
  { value: 'drugo', label: 'Drugo' },
]

function createEmptyContact(): ClientContact {
  return {
    name: '',
    role: '',
    email: '',
    phone: '',
    note: '',
  }
}

function toInputValue(value: number | null) {
  return value ?? ''
}

function ClientEditForm({ client, onCancel, onSubmit }: ClientEditFormProps) {
  const [values, setValues] = useState<ClientEditValues>({
    name: client.name,
    city: client.city,
    address: client.address,
    contacts: client.contacts,
    commercial: client.commercial,
  })
  const [errors, setErrors] = useState<FormErrors>({ contacts: [] })

  useEffect(() => {
    setValues({
      name: client.name,
      city: client.city,
      address: client.address,
      contacts: client.contacts,
      commercial: client.commercial,
    })
    setErrors({ contacts: [] })
  }, [client])

  const handleBasicChange =
    (field: 'name' | 'city' | 'address') =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({
        ...current,
        [field]: event.target.value,
      }))
    }

  const handleContactChange =
    (index: number, field: keyof ClientContact) =>
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => {
      setValues((current) => ({
        ...current,
        contacts: current.contacts.map((contact, contactIndex) =>
          contactIndex === index ? { ...contact, [field]: event.target.value } : contact,
        ),
      }))
      setErrors((current) => ({
        ...current,
        contacts: current.contacts.map((contactError, contactIndex) =>
          contactIndex === index ? { ...contactError, [field]: undefined } : contactError,
        ),
      }))
    }

  const handleAddContact = () => {
    setValues((current) => ({
      ...current,
      contacts: [...current.contacts, createEmptyContact()],
    }))
    setErrors((current) => ({
      ...current,
      contacts: [...current.contacts, {}],
    }))
  }

  const handleRemoveContact = (index: number) => {
    if (values.contacts.length <= 1) {
      window.alert('Klijent mora imati najmanje jedan kontakt.')
      return
    }

    setValues((current) => ({
      ...current,
      contacts: current.contacts.filter((_, contactIndex) => contactIndex !== index),
    }))
    setErrors((current) => ({
      ...current,
      contacts: current.contacts.filter((_, contactIndex) => contactIndex !== index),
    }))
  }

  const handleCommercialChange =
    (field: keyof CommercialInputs) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const rawValue = event.target.value

      setValues((current) => ({
        ...current,
        commercial: {
          ...current.commercial,
          [field]:
            field === 'employeeCount' || field === 'locationCount'
              ? rawValue === ''
                ? null
                : Number(rawValue)
              : rawValue,
        },
      }))
    }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextContactErrors = values.contacts.map((contact) => ({
      name: contact.name.trim() ? undefined : 'Ime kontakta je obavezno.',
      role: contact.role.trim() ? undefined : 'Funkcija/pozicija je obavezna.',
    }))

    const hasContactErrors = nextContactErrors.some(
      (contactError) => contactError.name || contactError.role,
    )

    if (hasContactErrors) {
      setErrors({ contacts: nextContactErrors })
      return
    }

    onSubmit({
      name: values.name.trim(),
      city: values.city.trim(),
      address: values.address.trim(),
      contacts: values.contacts.map((contact) => ({
        name: contact.name.trim(),
        role: contact.role.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        note: contact.note?.trim() || '',
      })),
      commercial: values.commercial,
    })
  }

  return (
    <form className="customer-client-edit-form" onSubmit={handleSubmit}>
      <div className="customer-card-group">
        <div className="customer-client-edit-grid">
          <label className="customer-task-form-field">
            <span>Naziv</span>
            <input type="text" value={values.name} onChange={handleBasicChange('name')} />
          </label>
          <label className="customer-task-form-field">
            <span>Grad</span>
            <input type="text" value={values.city} onChange={handleBasicChange('city')} />
          </label>
          <label className="customer-task-form-field customer-client-edit-field-full">
            <span>Adresa</span>
            <input type="text" value={values.address} onChange={handleBasicChange('address')} />
          </label>
        </div>
      </div>

      <div className="customer-card-group">
        <div className="customer-card-section-head">
          <h3>Kontakti</h3>
          <button type="button" className="customer-project-toggle" onClick={handleAddContact}>
            Dodaj kontakt
          </button>
        </div>
        <div className="customer-card-stack">
          {values.contacts.map((contact, index) => (
            <div key={`${contact.email}-${index}`} className="customer-card-group">
              <div className="customer-card-section-head">
                <h3>Kontakt {index + 1}</h3>
                <button
                  type="button"
                  className="customer-project-toggle"
                  onClick={() => handleRemoveContact(index)}
                >
                  Obrisi kontakt
                </button>
              </div>

              <div className="customer-client-edit-grid">
                <label className="customer-task-form-field">
                  <span>Ime i prezime</span>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={handleContactChange(index, 'name')}
                  />
                  {errors.contacts[index]?.name ? (
                    <small className="customer-task-form-error">
                      {errors.contacts[index]?.name}
                    </small>
                  ) : null}
                </label>
                <label className="customer-task-form-field">
                  <span>Funkcija/pozicija</span>
                  <select value={contact.role} onChange={handleContactChange(index, 'role')}>
                    <option value="">Izaberi funkciju</option>
                    {CONTACT_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.contacts[index]?.role ? (
                    <small className="customer-task-form-error">
                      {errors.contacts[index]?.role}
                    </small>
                  ) : null}
                </label>
                <label className="customer-task-form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={contact.email}
                    onChange={handleContactChange(index, 'email')}
                  />
                </label>
                <label className="customer-task-form-field">
                  <span>Telefon</span>
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={handleContactChange(index, 'phone')}
                  />
                </label>
                <label className="customer-task-form-field customer-client-edit-field-full">
                  <span>Napomena</span>
                  <textarea
                    value={contact.note ?? ''}
                    onChange={handleContactChange(index, 'note')}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="customer-card-group">
        <div className="customer-card-section-head">
          <h3>Komercijalni inputi</h3>
        </div>
        <div className="customer-client-edit-grid">
          <label className="customer-task-form-field">
            <span>Tip delatnosti</span>
            <select
              value={values.commercial.businessType}
              onChange={handleCommercialChange('businessType')}
            >
              <option value="">Izaberi tip delatnosti</option>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-task-form-field">
            <span>Promet</span>
            <select
              value={values.commercial.revenueBand}
              onChange={handleCommercialChange('revenueBand')}
            >
              <option value="">Izaberi promet</option>
              {REVENUE_BAND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-task-form-field">
            <span>Broj zaposlenih</span>
            <input
              type="number"
              min="0"
              value={toInputValue(values.commercial.employeeCount)}
              onChange={handleCommercialChange('employeeCount')}
            />
          </label>
          <label className="customer-task-form-field">
            <span>Broj objekata</span>
            <input
              type="number"
              min="0"
              value={toInputValue(values.commercial.locationCount)}
              onChange={handleCommercialChange('locationCount')}
            />
          </label>
          <label className="customer-task-form-field">
            <span>Nivo odlucivanja</span>
            <select
              value={values.commercial.decisionLevel}
              onChange={handleCommercialChange('decisionLevel')}
            >
              <option value="">Izaberi nivo odlucivanja</option>
              {DECISION_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-task-form-field">
            <span>Odnos</span>
            <select
              value={values.commercial.relationshipLevel}
              onChange={handleCommercialChange('relationshipLevel')}
            >
              <option value="">Izaberi odnos</option>
              {RELATIONSHIP_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="customer-task-form-field customer-client-edit-field-full">
            <span>Spremnost za inovacije</span>
            <select
              value={values.commercial.innovationReady}
              onChange={handleCommercialChange('innovationReady')}
            >
              <option value="">Izaberi odgovor</option>
              {INNOVATION_READY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="customer-task-actions">
        <button type="submit" className="customer-project-toggle">
          Sacuvaj
        </button>
        <button type="button" className="customer-project-toggle" onClick={onCancel}>
          Otkazi
        </button>
      </div>
    </form>
  )
}

export default ClientEditForm
