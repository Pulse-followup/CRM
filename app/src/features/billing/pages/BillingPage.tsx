import { useMemo, useState } from 'react'
import { useClientStore } from '../../clients/clientStore'
import { useProjectStore } from '../../projects/projectStore'
import { useBillingStore } from '../billingStore'
import BillingCard from '../components/BillingCard'
import type { BillingStatus } from '../types'

const FILTER_OPTIONS: Array<{ key: 'all' | BillingStatus; label: string }> = [
  { key: 'all', label: 'Svi' },
  { key: 'draft', label: 'Za fakturisanje' },
  { key: 'invoiced', label: 'Fakturisano' },
  { key: 'overdue', label: 'Kasni' },
  { key: 'paid', label: 'Placeno' },
]

function BillingPage() {
  const [activeFilter, setActiveFilter] = useState<'all' | BillingStatus>('all')
  const { getAllBilling, markBillingInvoiced, markBillingOverdue, markBillingPaid, getBillingSummary } =
    useBillingStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()
  const billing = getAllBilling()
  const summary = getBillingSummary()

  const filteredBilling = useMemo(
    () =>
      activeFilter === 'all'
        ? billing
        : billing.filter((record) => record.status === activeFilter),
    [activeFilter, billing],
  )

  return (
    <section className="page-card client-detail-shell">
      <header className="customer-card-header">
        <div>
          <h2 className="customer-card-title">Naplata</h2>
          <p className="customer-card-subtitle">Pregled naloga za fakturisanje i placanja.</p>
        </div>
        <div className="customer-project-badges">
          <span className="customer-status-badge is-info">Ukupno: {summary.total}</span>
        </div>
      </header>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Filteri</h3>
        </div>
        <div className="customer-project-actions">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className="customer-project-toggle"
              onClick={() => setActiveFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="customer-card-section">
        <div className="customer-card-section-head">
          <h3>Nalozi</h3>
        </div>

        {filteredBilling.length ? (
          <div className="customer-card-stack">
            {filteredBilling.map((record) => {
              const client = getClientById(record.clientId)
              const project = getProjectById(record.projectId)

              return (
                <BillingCard
                  key={record.id}
                  record={record}
                  clientName={client?.name}
                  projectTitle={project?.title}
                  onMarkInvoiced={record.status === 'draft' ? () => markBillingInvoiced(record.id) : undefined}
                  onMarkOverdue={record.status === 'invoiced' ? () => markBillingOverdue(record.id) : undefined}
                  onMarkPaid={record.status === 'invoiced' || record.status === 'overdue' ? () => markBillingPaid(record.id) : undefined}
                />
              )
            })}
          </div>
        ) : (
          <div className="customer-card-empty">Nema billing naloga za izabrani filter.</div>
        )}
      </section>
    </section>
  )
}

export default BillingPage
