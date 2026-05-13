import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
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

type WorkspaceRow = {
  id: string
  name: string
}

type RangeKey = 'today' | '7d' | '14d' | '30d'

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; days: number }> = [
  { key: 'today', label: 'Danas', days: 1 },
  { key: '7d', label: '7 dana', days: 7 },
  { key: '14d', label: '14 dana', days: 14 },
  { key: '30d', label: '30 dana', days: 30 },
]

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
  return winner
}

function AdminUsagePage() {
  const { currentUser } = useAuthStore()
  const [range, setRange] = useState<RangeKey>('14d')
  const [emailFilter, setEmailFilter] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [events, setEvents] = useState<UsageEventRow[]>([])
  const [recentEvents, setRecentEvents] = useState<UsageEventRow[]>([])
  const [workspaces, setWorkspaces] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
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

      const [{ data: summaryData, error: summaryError }, { data: recentData, error: recentError }] =
        await Promise.all([summaryQuery, recentQuery])

      if (summaryError || recentError) {
        throw new Error(summaryError?.message || recentError?.message || 'Usage podaci nisu dostupni.')
      }

      const allEvents = (summaryData || []) as UsageEventRow[]
      const lastEvents = (recentData || []) as UsageEventRow[]
      const workspaceIds = Array.from(
        new Set(
          [...allEvents, ...lastEvents]
            .map((event) => event.workspace_id)
            .filter((value): value is string => Boolean(value)),
        ),
      )

      let workspaceMap: Record<string, string> = {}
      if (workspaceIds.length) {
        const { data: workspaceData } = await supabase
          .from('workspaces')
          .select('id,name')
          .in('id', workspaceIds)
        workspaceMap = Object.fromEntries(((workspaceData || []) as WorkspaceRow[]).map((item) => [item.id, item.name]))
      }

      if (!isMounted) return
      setEvents(allEvents)
      setRecentEvents(lastEvents)
      setWorkspaces(workspaceMap)
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

  const stats = useMemo(() => {
    const todayIso = startOfDayIso(1)
    const todayEvents = events.filter((event) => event.created_at >= todayIso)
    const last7Iso = startOfDayIso(7)
    const last7Events = events.filter((event) => event.created_at >= last7Iso)

    return [
      { label: 'Aktivni korisnici danas', value: uniqueUsers(todayEvents) },
      { label: 'Aktivni korisnici 7 dana', value: uniqueUsers(last7Events) },
      { label: 'Otvorene sesije danas', value: countEvent(todayEvents, 'app_opened') },
      { label: 'Demo otvaranja', value: countEvent(events, 'demo_opened') },
      { label: 'Otvoreni taskovi', value: countEvent(events, 'task_opened') },
      { label: 'Zavrseni taskovi', value: countEvent(events, 'task_completed') },
      { label: 'Otvorene billing strane', value: countEvent(events, 'billing_opened') },
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

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <section className="page-card settings-page-shell account-page-shell admin-usage-shell">
      <div className="account-page-head">
        <h2>Usage / Beta activity</h2>
        <p>Globalni pregled beta korišćenja aplikacije.</p>
      </div>

      <section className="account-card admin-usage-filters">
        <div className="admin-usage-filter-grid">
          <label>
            <span>Period</span>
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

      <section className="admin-usage-stats">
        {stats.map((item) => (
          <article key={item.label} className="account-card admin-usage-stat-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="account-card admin-usage-table-card">
        <div className="settings-dev-tools-head">
          <h3>Poslednjih 100 događaja</h3>
          <p>{isLoading ? 'Učitavanje...' : `${recentEvents.length} događaja`}</p>
        </div>
        <div className="admin-usage-table-wrap">
          <table className="admin-usage-table">
            <thead>
              <tr>
                <th>Vreme</th>
                <th>User email</th>
                <th>Workspace</th>
                <th>Event type</th>
                <th>Entity type</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateTime(event.created_at)}</td>
                  <td>{event.user_email || '-'}</td>
                  <td>{event.workspace_id ? (workspaces[event.workspace_id] || event.workspace_id) : '-'}</td>
                  <td>{event.event_type}</td>
                  <td>{event.entity_type || '-'}</td>
                  <td>{event.metadata ? JSON.stringify(event.metadata) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="account-card admin-usage-table-card">
        <div className="settings-dev-tools-head">
          <h3>Dnevni presek</h3>
          <p>Default pregled za poslednjih {RANGE_OPTIONS.find((item) => item.key === range)?.days || 14} dana.</p>
        </div>
        <div className="admin-usage-table-wrap">
          <table className="admin-usage-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Aktivni useri</th>
                <th>Broj eventova</th>
                <th>Top event</th>
                <th>task_opened</th>
                <th>billing_opened</th>
                <th>demo_opened</th>
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
  )
}

export default AdminUsagePage
