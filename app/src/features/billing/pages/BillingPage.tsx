import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useClientStore } from '../../clients/clientStore'
import { useProjectStore } from '../../projects/projectStore'
import '../../clients/pages/client-detail.css'
import { useBillingStore } from '../billingStore'
import BillingCard from '../components/BillingCard'
import type { BillingStatus } from '../types'

const FILTER_OPTIONS: Array<{ key: 'all' | BillingStatus; label: string }> = [
  { key: 'all', label: 'Svi' },
  { key: 'draft', label: 'Za fakturisanje' },
  { key: 'invoiced', label: 'Fakturisano' },
  { key: 'overdue', label: 'Kasni' },
  { key: 'paid', label: 'Plaćeno' },
]

function normalizeFilterParam(value: string | null): 'all' | BillingStatus {
  if (value === 'paid-week') return 'paid'
  if (value === 'ready') return 'draft'
  if (value === 'draft' || value === 'invoiced' || value === 'overdue' || value === 'paid') return value
  return 'all'
}

function isPaidThisWeek(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today)
  const day = weekStart.getDay() || 7
  weekStart.setDate(weekStart.getDate() - day + 1)

  return date.getTime() >= weekStart.getTime()
}

function BillingPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const externalFilter = searchParams.get('filter')
  const [activeFilter, setActiveFilter] = useState<'all' | BillingStatus>(normalizeFilterParam(externalFilter))
  const { getAllBilling, markBillingInvoiced, markBillingOverdue, markBillingPaid } = useBillingStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()
  const billing = getAllBilling().filter((record) => record.status !== 'cancelled')
  const isPaidWeekFilter = externalFilter === 'paid-week'

  useEffect(() => {
    setActiveFilter(normalizeFilterParam(externalFilter))
  }, [externalFilter])

  const counts = useMemo(() => {
    return FILTER_OPTIONS.reduce<Record<string, number>>((acc, option) => {
      acc[option.key] = option.key === 'all'
        ? billing.length
        : option.key === 'draft'
          ? billing.filter((record) => record.status === 'draft' || record.status === 'ready').length
          : billing.filter((record) => record.status === option.key).length
      return acc
    }, {})
  }, [billing])

  const filteredBilling = useMemo(
    () => {
      if (isPaidWeekFilter) {
        return billing.filter((record) => record.status === 'paid' && isPaidThisWeek(record.paidAt || record.updatedAt || record.createdAt))
      }
      return activeFilter === 'all'
        ? billing
        : billing.filter((record) => (activeFilter === 'draft' ? record.status === 'draft' || record.status === 'ready' : record.status === activeFilter))
    },
    [activeFilter, billing, isPaidWeekFilter],
  )

  return (
    <section className="page-card client-detail-shell billing-clean-page">
      <button type="button" className="secondary-link-button" onClick={() => navigate('/')}>
        Nazad na dashboard
      </button>

      <div className="billing-clean-filters" aria-label="Filteri naplate">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`billing-filter-bubble${activeFilter === option.key ? ' is-active' : ''}`}
            onClick={() => { setActiveFilter(option.key); setSearchParams(option.key === 'all' ? {} : { filter: option.key }) }}
          >
            {option.label} <span>{counts[option.key] || 0}</span>
          </button>
        ))}
      </div>

      {filteredBilling.length ? (
        <div className="billing-clean-list">
          {filteredBilling.map((record) => {
            const client = getClientById(record.clientId)
            const project = getProjectById(record.projectId)

            return (
              <BillingCard
                key={record.id}
                record={record}
                clientName={client?.name || record.clientName}
                projectTitle={project?.title || record.projectName}
                onMarkInvoiced={record.status === 'draft' || record.status === 'ready' ? () => markBillingInvoiced(record.id) : undefined}
                onMarkOverdue={record.status === 'invoiced' ? () => markBillingOverdue(record.id) : undefined}
                onMarkPaid={record.status === 'invoiced' || record.status === 'overdue' ? () => markBillingPaid(record.id) : undefined}
              />
            )
          })}
        </div>
      ) : (
        <div className="customer-card-empty">Nema naloga za izabrani filter.</div>
      )}
    </section>
  )
}

export default BillingPage
