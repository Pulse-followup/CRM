import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../auth/authStore'
import { useClientStore } from '../../clients/clientStore'
import { useProjectStore } from '../../projects/projectStore'
import '../../clients/pages/client-detail.css'
import { getBillingStatus } from '../billingLifecycle'
import {
  getBillingCollections,
  getBillingReadyItems,
  getInvoicedItems,
  getOverdueBillingItems,
  getPaidItems,
  getPaidThisWeekItems,
} from '../billingSelectors'
import { useBillingStore } from '../billingStore'
import BillingCard from '../components/BillingCard'
import type { BillingStatus } from '../types'
import { trackEvent } from '../../usage/usageTracker'

const FILTER_OPTIONS: Array<{ key: 'all' | BillingStatus; label: string }> = [
  { key: 'all', label: 'Svi' },
  { key: 'draft', label: 'Za fakturisanje' },
  { key: 'invoiced', label: 'Fakturisano' },
  { key: 'overdue', label: 'Kasni' },
  { key: 'paid', label: 'Placeno' },
]

function normalizeFilterParam(value: string | null): 'all' | BillingStatus {
  if (value === 'paid-week') return 'paid'
  if (value === 'ready') return 'draft'
  if (value === 'draft' || value === 'invoiced' || value === 'overdue' || value === 'paid') return value
  return 'all'
}

function BillingPage() {
  const navigate = useNavigate()
  const { currentUser } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const externalFilter = searchParams.get('filter')
  const [activeFilter, setActiveFilter] = useState<'all' | BillingStatus>(normalizeFilterParam(externalFilter))
  const { getAllBilling, markBillingInvoiced, markBillingOverdue, markBillingPaid } = useBillingStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()
  const billing = getAllBilling()
  const billingCollections = useMemo(() => getBillingCollections(billing), [billing])
  const isPaidWeekFilter = externalFilter === 'paid-week'

  useEffect(() => {
    setActiveFilter(normalizeFilterParam(externalFilter))
  }, [externalFilter])

  useEffect(() => {
    trackEvent('billing_opened', {
      entityType: 'billing',
      metadata: {
        filter: externalFilter || 'all',
      },
    })
  }, [externalFilter])

  const counts = useMemo(() => {
    return FILTER_OPTIONS.reduce<Record<string, number>>((acc, option) => {
      acc[option.key] = option.key === 'all'
        ? billingCollections.active.length
        : option.key === 'draft'
          ? billingCollections.ready.length
          : option.key === 'invoiced'
            ? billingCollections.invoiced.length
            : option.key === 'overdue'
              ? billingCollections.overdue.length
              : billingCollections.paid.length
      return acc
    }, {})
  }, [billingCollections])

  const filteredBilling = useMemo(() => {
    if (isPaidWeekFilter) {
      return getPaidThisWeekItems(billing)
    }

    if (activeFilter === 'all') return billingCollections.active
    if (activeFilter === 'draft') {
      return getBillingReadyItems(billing)
    }
    if (activeFilter === 'invoiced') {
      return getInvoicedItems(billing)
    }
    if (activeFilter === 'overdue') {
      return getOverdueBillingItems(billing)
    }
    return getPaidItems(billing)
  }, [activeFilter, billing, billingCollections.active, isPaidWeekFilter])
  const canManageBillingStatus = currentUser.role === 'finance'

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
            const billingStatus = getBillingStatus(record)

            return (
              <BillingCard
                key={record.id}
                record={record}
                clientName={client?.name || record.clientName}
                projectTitle={project?.title || record.projectName}
                onMarkInvoiced={canManageBillingStatus && billingStatus === 'issued' && (record.status === 'draft' || record.status === 'ready') ? () => markBillingInvoiced(record.id) : undefined}
                onMarkOverdue={canManageBillingStatus && billingStatus === 'issued' && record.status === 'invoiced' ? () => markBillingOverdue(record.id) : undefined}
                onMarkPaid={canManageBillingStatus && (billingStatus === 'issued' || billingStatus === 'overdue') ? () => markBillingPaid(record.id) : undefined}
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
