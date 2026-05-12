import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ClientCreateForm, {
  type ClientCreateFormValues,
} from '../features/clients/components/ClientCreateForm'
import { useBillingStore } from '../features/billing/billingStore'
import { useClientStore } from '../features/clients/clientStore'
import type { Client } from '../features/clients/types'
import { useProjectStore } from '../features/projects/projectStore'
import { getClientScore } from '../features/scoring/scoringSelectors'
import ProLimitModal from '../features/subscription/ProLimitModal'
import { useTaskStore } from '../features/tasks/taskStore'
import '../features/clients/pages/client-detail.css'

const PRIORITY_LABELS = {
  low: 'Nizak',
  medium: 'Srednji',
  high: 'Visok',
} as const

function ClientsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { clients: runtimeClients, getAllClients, addClient, limitReachedReason, clearLimitReachedReason } = useClientStore()
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const { billing } = useBillingStore()
  const [query, setQuery] = useState('')
  const [isCreatingClient, setIsCreatingClient] = useState(false)
  const stackViewportRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const clients = getAllClients()

  useEffect(() => {
    if (searchParams.get('setup') === 'create') {
      setIsCreatingClient(true)
    }
  }, [searchParams])

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

  const scoredClients = useMemo(
    () =>
      visibleClients.map((client) => ({
        client,
        score: getClientScore(String(client.id), {
          clients: runtimeClients,
          projects,
          tasks,
          billing,
        }),
      })),
    [billing, projects, runtimeClients, tasks, visibleClients],
  )

  useEffect(() => {
    if (!stackViewportRef.current) return

    const ctx = gsap.context(() => {
      const cards = cardRefs.current.filter(Boolean)
      if (!cards.length) return

      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 28, rotateX: 4, scale: 0.98 },
        {
          autoAlpha: 1,
          y: 0,
          rotateX: 0,
          scale: 1,
          duration: 0.55,
          ease: 'power3.out',
          stagger: 0.08,
          clearProps: 'transform,opacity',
        },
      )
    }, stackViewportRef)

    return () => ctx.revert()
  }, [scoredClients.length])

  return (
    <section className="page-card clients-page-shell">
      <div className="clients-page-header">
        <button
          type="button"
          className="clients-dashboard-link"
          onClick={() => navigate('/')}
        >
          ← Dashboard
        </button>
        <div className="clients-page-title-block">
          <p className="clients-page-kicker">Client command view</p>
          <h1>KLIJENTI</h1>
          <p>Pregled klijenata, prioriteta i aktivnosti</p>
        </div>
      </div>

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
      <ProLimitModal isOpen={limitReachedReason === 'clients'} onClose={clearLimitReachedReason} />

      {scoredClients.length > 0 ? (
        <div
          ref={stackViewportRef}
          className={`clients-stack-viewport${scoredClients.length === 1 ? ' is-single' : ''}`}
        >
          <div className="clients-list">
            {scoredClients.map(({ client, score }, index) => {
              return (
                <article
                  key={client.id}
                  ref={(node) => {
                    cardRefs.current[index] = node
                  }}
                  className="client-list-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      navigate(`/clients/${client.id}`)
                    }
                  }}
                >
                  <div className="client-list-card-head">
                    <div className="client-list-card-copy">
                      <strong>{client.name}</strong>
                      <span>{client.city || 'Lokacija nije uneta'}</span>
                    </div>
                    <div className="client-list-score">
                      <span className="client-list-score-value">
                        PULSE SCORE {score.total}/100
                      </span>
                      <span
                        className={`customer-status-badge client-list-priority is-${score.priority === 'high' ? 'success' : score.priority === 'medium' ? 'warning' : 'muted'}`}
                      >
                        Prioritet: {PRIORITY_LABELS[score.priority].toLowerCase()}
                      </span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="clients-empty-state">
          <h2>{clients.length ? 'Nema rezultata za ovu pretragu' : 'Nema klijenata još'}</h2>
          <p>
            {clients.length
              ? 'Promeni pretragu ili otvori karticu postojećeg klijenta.'
              : 'Dodaj prvog klijenta da bi iz njegove kartice nastajali projekti, aktivnosti i naplata.'}
          </p>
          {!clients.length ? (
            <button
              type="button"
              className="clients-primary-action"
              onClick={() => setIsCreatingClient(true)}
            >
              Dodaj prvog klijenta
            </button>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default ClientsPage
