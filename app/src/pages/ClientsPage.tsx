import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
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
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [isCompactLayout, setIsCompactLayout] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 760 : false,
  )
  const stackViewportRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
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

  const stackMode = scoredClients.length > 1 && !isCompactLayout
  const activeIndex = useMemo(
    () =>
      activeClientId
        ? scoredClients.findIndex(({ client }) => String(client.id) === activeClientId)
        : 0,
    [activeClientId, scoredClients],
  )

  useEffect(() => {
    const syncLayout = () => setIsCompactLayout(window.innerWidth <= 760)
    syncLayout()
    window.addEventListener('resize', syncLayout)
    return () => window.removeEventListener('resize', syncLayout)
  }, [])

  useEffect(() => {
    if (!scoredClients.length) {
      setActiveClientId(null)
      return
    }

    if (
      !activeClientId ||
      !scoredClients.some(({ client }) => String(client.id) === activeClientId)
    ) {
      setActiveClientId(String(scoredClients[0].client.id))
    }
  }, [activeClientId, scoredClients])

  useEffect(() => {
    if (!stackViewportRef.current) return

    const ctx = gsap.context(() => {
      const cards = cardRefs.current.filter(Boolean)
      if (!cards.length) return

      if (!stackMode) {
        gsap.fromTo(
          cards,
          { autoAlpha: 0, y: 20 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.55,
            ease: 'power2.out',
            stagger: 0.08,
            clearProps: 'transform,opacity',
          },
        )
        return
      }

      cardRefs.current.forEach((card, index) => {
        if (!card) return

        const offset = index - Math.max(0, activeIndex)
        const absOffset = Math.abs(offset)
        const limitedOffset = Math.max(-2, Math.min(3, offset))

        gsap.to(card, {
          yPercent: -50,
          y: limitedOffset * 104,
          scale: offset === 0 ? 1 : absOffset === 1 ? 0.94 : 0.86,
          rotateX: offset > 0 ? 4 : offset < 0 ? -3 : 0,
          opacity:
            absOffset > 2 ? 0 : absOffset === 2 ? 0.14 : absOffset === 1 ? 0.56 : 1,
          zIndex: 100 - absOffset,
          filter:
            offset === 0
              ? 'blur(0px)'
              : absOffset === 1
                ? 'blur(0.2px)'
                : 'blur(1px)',
          boxShadow:
            offset === 0
              ? '0 26px 80px rgba(2, 8, 23, 0.38)'
              : '0 16px 34px rgba(2, 8, 23, 0.2)',
          duration: 0.65,
          ease: 'power3.out',
          transformPerspective: 1200,
          transformOrigin: 'center center',
        })
      })
    }, stackViewportRef)

    return () => ctx.revert()
  }, [activeIndex, stackMode])

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

      {scoredClients.length > 0 ? (
        <div
          ref={stackViewportRef}
          className={`clients-stack-viewport${stackMode ? ' has-stack' : ''}${scoredClients.length === 1 ? ' is-single' : ''}`}
        >
          <div className={`clients-list${stackMode ? ' has-stack' : ''}`}>
            {scoredClients.map(({ client, score }, index) => {
              const clientId = String(client.id)
              const isActive = clientId === activeClientId

              return (
                <article
                  key={client.id}
                  ref={(node) => {
                    cardRefs.current[index] = node
                  }}
                  className={`client-list-card${isActive ? ' is-active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isActive) {
                      setActiveClientId(clientId)
                      return
                    }
                    navigate(`/clients/${client.id}`)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      if (!isActive) {
                        setActiveClientId(clientId)
                        return
                      }
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

                  <div className="client-list-card-footer">
                    <span className="client-list-card-caption">
                      {isActive ? 'Klijent je u fokusu' : 'Klik za fokus'}
                    </span>
                    <button
                      type="button"
                      className="client-list-open"
                      onClick={(event) => {
                        event.stopPropagation()
                        navigate(`/clients/${client.id}`)
                      }}
                    >
                      Otvori karticu
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
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
