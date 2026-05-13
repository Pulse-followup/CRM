import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import { isUsageOwnerEmail } from '../features/usage/usageAccess'
import { getSupabaseClient } from '../lib/supabaseClient'

type UsageEventRow = {
  id: string
  workspace_id: string | null
  user_id: string | null
  user_email: string | null
  event_type: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type RangeKey = 'today' | '7d' | '14d' | '30d'

type SnapshotBucket = {
  total: number
  new7d: number
  new30d: number
  older: number
}

type SnapshotResponse = {
  workspaces: SnapshotBucket
  users: SnapshotBucket
  clients: SnapshotBucket
  products: SnapshotBucket
  tasks: SnapshotBucket
}

type OwnerEntityKey = keyof SnapshotResponse

type OwnerEntityRow = {
  entity_kind: string
  entity_id: string
  primary_label: string
  secondary_label: string
  status_label: string
  workspace_label: string
  created_at: string
}

const EMPTY_BUCKET: SnapshotBucket = {
  total: 0,
  new7d: 0,
  new30d: 0,
  older: 0,
}

const EMPTY_SNAPSHOT: SnapshotResponse = {
  workspaces: EMPTY_BUCKET,
  users: EMPTY_BUCKET,
  clients: EMPTY_BUCKET,
  products: EMPTY_BUCKET,
  tasks: EMPTY_BUCKET,
}

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: 'today', label: 'Danas', days: 1 },
  { key: '7d', label: '7 dana', days: 7 },
  { key: '14d', label: '14 dana', days: 14 },
  { key: '30d', label: '30 dana', days: 30 },
]

const EVENT_LABELS: Record<string, string> = {
  app_opened: 'Otvorio app',
  login_success: 'Uspešan login',
  demo_opened: 'Otvorio demo',
  client_opened: 'Otvorio klijenta',
  project_opened: 'Otvorio projekat',
  task_opened: 'Otvorio task',
  task_created: 'Kreirao task',
  task_completed: 'Završio task',
  billing_opened: 'Otvorio naplatu',
  invite_created: 'Kreirao invite',
  notification_clicked: 'Kliknuo notifikaciju',
  push_enabled: 'Uključio push',
  onboarding_completed: 'Završio onboarding',
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatDay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function startOfDayIso(daysBack: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - (daysBack - 1))
  return date.toISOString()
}

function uniqueUsers(events: UsageEventRow[]) {
  const values = new Set<string>()
  events.forEach((event) => {
    const key = (event.user_email || event.user_id || '').trim().toLowerCase()
    if (key) values.add(key)
  })
  return values.size
}

function countEvent(events: UsageEventRow[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length
}

function topEvent(events: UsageEventRow[]) {
  const map = new Map<string, number>()
  events.forEach((event) => {
    map.set(event.event_type, (map.get(event.event_type) || 0) + 1)
  })
  let winner = '-'
  let max = 0
  map.forEach((count, key) => {
    if (count > max) {
      winner = key
      max = count
    }
  })
  return EVENT_LABELS[winner] || winner
}

function formatWorkspace(workspaceId: string | null, metadata: Record<string, unknown> | null) {
  if (metadata?.demoMode) return 'DEMO'
  if (!workspaceId) return '-'
  return workspaceId.length > 16 ? `${workspaceId.slice(0, 8)}...` : workspaceId
}

function formatMetadata(metadata: Record<string, unknown> | null) {
  if (!metadata || !Object.keys(metadata).length) return '-'
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ')
}

function AdminUsagePage() {
  const { currentUser } = useAuthStore()
  const [range, setRange] = useState<RangeKey>('14d')
  const [emailFilter, setEmailFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [events, setEvents] = useState<UsageEventRow[]>([])
  const [recentEvents, setRecentEvents] = useState<UsageEventRow[]>([])
  const [snapshot, setSnapshot] = useState<SnapshotResponse>(EMPTY_SNAPSHOT)
  const [selectedEntity, setSelectedEntity] = useState<OwnerEntityKey>('workspaces')
  const [entityRows, setEntityRows] = useState<OwnerEntityRow[]>([])
  const [entityRange, setEntityRange] = useState<'all' | '7' | '30'>('30')
  const [isLoading, setIsLoading] = useState(true)
  const [isEntityLoading, setIsEntityLoading] = useState(false)
  const [error, setError] = useState('')

  const canAccess = isUsageOwnerEmail(currentUser.email)

  useEffect(() => {
    if (!canAccess) return

    const supabase = getSupabaseClient()
    if (!supabase) {
      setError('Supabase nije konfigurisan.')
      setIsLoading(false)
      return
    }

    const activeRange = RANGE_OPTIONS.find((item) => item.key === range) || RANGE_OPTIONS[2]
    const fromIso = startOfDayIso(activeRange.days)
    const cleanEmail = emailFilter.trim().toLowerCase()
    const cleanEventType = eventTypeFilter.trim().toLowerCase()

    let isMounted = true
    setIsLoading(true)
    setError('')

    const fetchUsage = async () => {
      let summaryQuery = supabase
        .from('usage_events')
        .select('*')
        .gte('created_at', fromIso)
        .order('created_at', { ascending: false })
        .limit(2000)

      let recentQuery = supabase
        .from('usage_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (cleanEmail) {
        summaryQuery = summaryQuery.ilike('user_email', `%${cleanEmail}%`)
        recentQuery = recentQuery.ilike('user_email', `%${cleanEmail}%`)
      }

      if (cleanEventType) {
        summaryQuery = summaryQuery.eq('event_type', cleanEventType)
        recentQuery = recentQuery.eq('event_type', cleanEventType)
      }

      const [
        { data: snapshotData, error: snapshotError },
        { data: summaryData, error: summaryError },
        { data: recentData, error: recentError },
      ] = await Promise.all([
        supabase.rpc('owner_usage_snapshot'),
        summaryQuery,
        recentQuery,
      ])

      if (snapshotError || summaryError || recentError) {
        throw new Error(
          snapshotError?.message || summaryError?.message || recentError?.message || 'Usage podaci nisu dostupni.',
        )
      }

      if (!isMounted) return
      setSnapshot((snapshotData as SnapshotResponse | null) || EMPTY_SNAPSHOT)
      setEvents((summaryData || []) as UsageEventRow[])
      setRecentEvents((recentData || []) as UsageEventRow[])
      setIsLoading(false)
    }

    void fetchUsage().catch((fetchError) => {
      if (!isMounted) return
      setError(fetchError instanceof Error ? fetchError.message : 'Usage podaci nisu dostupni.')
      setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [canAccess, emailFilter, eventTypeFilter, range])

  useEffect(() => {
    if (!canAccess) return

    const supabase = getSupabaseClient()
    if (!supabase) return

    let isMounted = true
    setIsEntityLoading(true)

    const fetchEntityRows = async () => {
      const daysValue = entityRange === 'all' ? null : Number(entityRange)
      const { data, error: entityError } = await supabase.rpc('owner_usage_entities', {
        p_entity: selectedEntity,
        p_days: daysValue,
      })

      if (entityError) {
        throw entityError
      }

      if (!isMounted) return
      setEntityRows((data || []) as OwnerEntityRow[])
      setIsEntityLoading(false)
    }

    void fetchEntityRows().catch((fetchError) => {
      if (!isMounted) return
      setError(fetchError instanceof Error ? fetchError.message : 'Detalji nisu dostupni.')
      setIsEntityLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [canAccess, entityRange, selectedEntity])

  const activityStats = useMemo(() => {
    const todayIso = startOfDayIso(1)
    const todayEvents = events.filter((event) => event.created_at >= todayIso)
    const last7Iso = startOfDayIso(7)
    const last7Events = events.filter((event) => event.created_at >= last7Iso)

    return [
      { label: 'Aktivni korisnici danas', value: uniqueUsers(todayEvents) },
      { label: 'Aktivni korisnici 7 dana', value: uniqueUsers(last7Events) },
      { label: 'Otvaranja app danas', value: countEvent(todayEvents, 'app_opened') },
      { label: 'Demo otvaranja', value: countEvent(events, 'demo_opened') },
      { label: 'Otvoreni taskovi', value: countEvent(events, 'task_opened') },
      { label: 'Završeni taskovi', value: countEvent(events, 'task_completed') },
      { label: 'Otvorena naplata', value: countEvent(events, 'billing_opened') },
      { label: 'Kreirani invite linkovi', value: countEvent(events, 'invite_created') },
    ]
  }, [events])

  const dailySummary = useMemo(() => {
    const buckets = new Map<string, UsageEventRow[]>()
    events.forEach((event) => {
      const key = event.created_at.slice(0, 10)
      buckets.set(key, [...(buckets.get(key) || []), event])
    })

    return Array.from(buckets.entries())
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([date, bucket]) => ({
        date,
        activeUsers: uniqueUsers(bucket),
        totalEvents: bucket.length,
        topEvent: topEvent(bucket),
        taskOpened: countEvent(bucket, 'task_opened'),
        billingOpened: countEvent(bucket, 'billing_opened'),
        demoOpened: countEvent(bucket, 'demo_opened'),
      }))
  }, [events])

  const eventTypes = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.event_type))).sort((left, right) => left.localeCompare(right))
  }, [events])

  const foundationCards: Array<{ key: OwnerEntityKey; label: string; bucket: SnapshotBucket }> = [
    { key: 'workspaces', label: 'Workspace-ovi', bucket: snapshot.workspaces },
    { key: 'users', label: 'Useri', bucket: snapshot.users },
    { key: 'clients', label: 'Klijenti', bucket: snapshot.clients },
    { key: 'products', label: 'Proizvodi', bucket: snapshot.products },
    { key: 'tasks', label: 'Taskovi', bucket: snapshot.tasks },
  ]

  const selectedEntityLabel =
    foundationCards.find((item) => item.key === selectedEntity)?.label || 'Detalji'

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="usage-owner-screen">
      <section className="usage-owner-hero">
        <div>
          <span className="usage-owner-kicker">PULSE Founder Dashboard</span>
          <h1>Control Center</h1>
        </div>
        <div className="usage-owner-actions">
          <Link to="/" className="usage-owner-link">Nazad u app</Link>
        </div>
      </section>

      <section className="usage-owner-foundation-grid">
        {foundationCards.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`usage-owner-panel usage-entity-card${selectedEntity === item.key ? ' is-active' : ''}`}
            onClick={() => setSelectedEntity(item.key)}
          >
            <header>
              <span>{item.label}</span>
              <strong>{item.bucket.total}</strong>
            </header>
            <div className="usage-entity-breakdown">
              <div>
                <label>Novi 7 dana</label>
                <b>{item.bucket.new7d}</b>
              </div>
              <div>
                <label>Novi 30 dana</label>
                <b>{item.bucket.new30d}</b>
              </div>
              <div>
                <label>Stariji</label>
                <b>{item.bucket.older}</b>
              </div>
            </div>
          </button>
        ))}
      </section>

      <section className="usage-owner-panel usage-owner-entity-detail">
        <div className="usage-owner-section-head">
          <h2>{selectedEntityLabel}</h2>
          <div className="usage-owner-inline-filters">
            <button type="button" className={entityRange === 'all' ? 'is-active' : ''} onClick={() => setEntityRange('all')}>Svi</button>
            <button type="button" className={entityRange === '7' ? 'is-active' : ''} onClick={() => setEntityRange('7')}>7 dana</button>
            <button type="button" className={entityRange === '30' ? 'is-active' : ''} onClick={() => setEntityRange('30')}>30 dana</button>
          </div>
        </div>
        <div className="usage-owner-table-wrap">
          <table className="usage-owner-table">
            <thead>
              <tr>
                <th>Naziv</th>
                <th>Dodatno</th>
                <th>Status</th>
                <th>Workspace</th>
                <th>Kreirano</th>
              </tr>
            </thead>
            <tbody>
              {entityRows.map((row) => (
                <tr key={`${row.entity_kind}-${row.entity_id}`}>
                  <td>{row.primary_label}</td>
                  <td>{row.secondary_label || '-'}</td>
                  <td>{row.status_label || '-'}</td>
                  <td>{row.workspace_label || '-'}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                </tr>
              ))}
              {!entityRows.length && !isEntityLoading ? (
                <tr>
                  <td colSpan={5}>Nema podataka za izabrani pregled.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="usage-owner-panel usage-owner-filters">
        <div className="usage-owner-filter-grid">
          <label>
            <span>Period usage-a</span>
            <select value={range} onChange={(event) => setRange(event.target.value as RangeKey)}>
              {RANGE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>User email</span>
            <input value={emailFilter} onChange={(event) => setEmailFilter(event.target.value)} placeholder="npr. ime@firma.rs" />
          </label>
          <label>
            <span>Event type</span>
            <input list="usage-event-types" value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)} placeholder="npr. task_opened" />
            <datalist id="usage-event-types">
              {eventTypes.map((eventType) => (
                <option key={eventType} value={eventType} />
              ))}
            </datalist>
          </label>
        </div>
      </section>

      {error ? <p className="settings-error-text">{error}</p> : null}

      <section className="usage-owner-activity-grid">
        {activityStats.map((item) => (
          <article key={item.label} className="usage-owner-panel usage-owner-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="usage-owner-grid-2">
        <section className="usage-owner-panel">
          <div className="usage-owner-section-head">
            <h2>Poslednjih 100 događaja</h2>
            <p>{isLoading ? 'Učitavanje...' : `${recentEvents.length} događaja`}</p>
          </div>
          <div className="usage-owner-table-wrap">
            <table className="usage-owner-table">
              <thead>
                <tr>
                  <th>Vreme</th>
                  <th>Korisnik</th>
                  <th>Šta je uradio</th>
                  <th>Objekat</th>
                  <th>Workspace</th>
                  <th>Detalji</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.created_at)}</td>
                    <td>{event.user_email || '-'}</td>
                    <td>{EVENT_LABELS[event.event_type] || event.event_type}</td>
                    <td>{event.entity_type || '-'}</td>
                    <td>{formatWorkspace(event.workspace_id, event.metadata)}</td>
                    <td>{formatMetadata(event.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="usage-owner-panel">
          <div className="usage-owner-section-head">
            <h2>Dnevni trend</h2>
            <p>Brzi pregled šta se dešava po danima.</p>
          </div>
          <div className="usage-owner-table-wrap">
            <table className="usage-owner-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Aktivni useri</th>
                  <th>Eventi</th>
                  <th>Top radnja</th>
                  <th>Task open</th>
                  <th>Billing open</th>
                  <th>Demo open</th>
                </tr>
              </thead>
              <tbody>
                {dailySummary.map((row) => (
                  <tr key={row.date}>
                    <td>{formatDay(row.date)}</td>
                    <td>{row.activeUsers}</td>
                    <td>{row.totalEvents}</td>
                    <td>{row.topEvent}</td>
                    <td>{row.taskOpened}</td>
                    <td>{row.billingOpened}</td>
                    <td>{row.demoOpened}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

export default AdminUsagePage
