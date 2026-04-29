import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ClientCreateForm, {
  type ClientCreateFormValues,
} from '../features/clients/components/ClientCreateForm'
import { useBillingStore } from '../features/billing/billingStore'
import { useClientStore } from '../features/clients/clientStore'
import type { Client } from '../features/clients/types'
import { useProjectStore } from '../features/projects/projectStore'
import { getClientScore } from '../features/scoring/scoringSelectors'
import { useTaskStore } from '../features/tasks/taskStore'
import '../features/clients/pages/client-detail.css'

const PRIORITY_LABELS = {
  low: 'Nizak',
  medium: 'Srednji',
  high: 'Visok',
} as const

function ClientsPage() {
  const navigate = useNavigate()
  const { clients: runtimeClients, getAllClients, addClient } = useClientStore()
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const { billing } = useBillingStore()
  const [query, setQuery] = useState('')
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const clients = getAllClients()

  const handleCreateClient = (values: ClientCreateFormValues) => {
    const nextClient: Client = {
      id: Date.now(),
      name: values.name,
      city: values.city,
      address: values.address,
      contacts: values.contacts,
      commercial: values.commercial,
    }

    addClient(nextClient)
    setIsCreatingClient(false)
  }

  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return clients

    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(normalizedQuery) ||
        client.city.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [clients, query])

  return (
    <section className="page-card clients-page-shell">
      <div className="clients-control-bar">
        <div className="clients-control-search">
          <input
            type="search"
            className="clients-search-input"
            placeholder="Pretraga klijenata..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="clients-primary-action"
          onClick={() => setIsCreatingClient((current) => !current)}
        >
          + Novi klijent
        </button>
      </div>

      {isCreatingClient ? (
        <ClientCreateForm
          onCancel={() => setIsCreatingClient(false)}
          onSubmit={handleCreateClient}
        />
      ) : null}

      {visibleClients.length > 0 ? (
        <div className="clients-list">
          {visibleClients.map((client) => (
            (() => {
              const score = getClientScore(String(client.id), {
                clients: runtimeClients,
                projects,
                tasks,
                billing,
              })

              return (
                <button
                  key={client.id}
                  type="button"
                  className="client-list-card"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <div className="client-list-card-head">
                    <div className="client-list-card-copy">
                      <strong>{client.name}</strong>
                      <span>{client.city}</span>
                    </div>
                    <div className="client-list-score">
                      <span className="client-list-score-value">PULSE {score.total}</span>
                      <span
                        className={`customer-status-badge client-list-priority is-${score.priority === 'high' ? 'success' : score.priority === 'medium' ? 'warning' : 'muted'}`}
                      >
                        {PRIORITY_LABELS[score.priority]}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })()
          ))}
        </div>
      ) : (
        <div className="clients-empty-state">
          <h2>Nema klijenata</h2>
          <p>Promeni pretragu da vidiš postojeće klijente.</p>
        </div>
      )}
    </section>
  )
}

export default ClientsPage
