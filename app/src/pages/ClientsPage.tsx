import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllClients } from '../features/clients/selectors'

function ClientsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const clients = useMemo(() => getAllClients(), [])

  const visibleClients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return clients

    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(normalizedQuery) ||
        client.city.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [query])

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

        <button type="button" className="clients-primary-action" disabled>
          + Novi klijent
        </button>
      </div>

      {visibleClients.length > 0 ? (
        <div className="clients-list">
          {visibleClients.map((client) => (
            <button
              key={client.id}
              type="button"
              className="client-list-card"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <strong>{client.name}</strong>
              <span>{client.city}</span>
            </button>
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
