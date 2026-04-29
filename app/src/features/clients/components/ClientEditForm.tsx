import { useEffect, useState } from 'react'
import type { Client, ClientContact, CommercialInputs } from '../types'

export interface ClientEditFormProps {
  client: Client
  onCancel: () => void
  onSubmit: (client: Client) => void
}

interface ClientEditValues {
  name: string
  city: string
  address: string
  contacts: ClientContact[]
  commercial: CommercialInputs
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

  useEffect(() => {
    setValues({
      name: client.name,
      city: client.city,
      address: client.address,
      contacts: client.contacts,
      commercial: client.commercial,
    })
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
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({
        ...current,
        contacts: current.contacts.map((contact, contactIndex) =>
          contactIndex === index ? { ...contact, [field]: event.target.value } : contact,
        ),
      }))
    }

  const handleCommercialChange =
    (field: keyof CommercialInputs) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
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

    onSubmit({
      ...client,
      name: values.name.trim(),
      city: values.city.trim(),
      address: values.address.trim(),
      contacts: values.contacts.map((contact) => ({
        ...contact,
        name: contact.name.trim(),
        role: contact.role.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
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
        </div>
        <div className="customer-card-stack">
          {values.contacts.map((contact, index) => (
            <div key={`${contact.email}-${index}`} className="customer-card-group">
              <div className="customer-client-edit-grid">
                <label className="customer-task-form-field">
                  <span>Ime</span>
                  <input
                    type="text"
                    value={contact.name}
                    onChange={handleContactChange(index, 'name')}
                  />
                </label>
                <label className="customer-task-form-field">
                  <span>Funkcija</span>
                  <input
                    type="text"
                    value={contact.role}
                    onChange={handleContactChange(index, 'role')}
                  />
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
            <input
              type="text"
              value={values.commercial.businessType}
              onChange={handleCommercialChange('businessType')}
            />
          </label>
          <label className="customer-task-form-field">
            <span>Promet</span>
            <input
              type="text"
              value={values.commercial.revenueBand}
              onChange={handleCommercialChange('revenueBand')}
            />
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
            <input
              type="text"
              value={values.commercial.decisionLevel}
              onChange={handleCommercialChange('decisionLevel')}
            />
          </label>
          <label className="customer-task-form-field">
            <span>Odnos</span>
            <input
              type="text"
              value={values.commercial.relationshipLevel}
              onChange={handleCommercialChange('relationshipLevel')}
            />
          </label>
          <label className="customer-task-form-field customer-client-edit-field-full">
            <span>Spremnost za inovacije</span>
            <input
              type="text"
              value={values.commercial.innovationReady}
              onChange={handleCommercialChange('innovationReady')}
            />
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
