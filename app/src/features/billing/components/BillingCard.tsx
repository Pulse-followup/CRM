import { BILLING_STATUS_LABELS, BILLING_STATUS_TONES } from '../billingLabels'
import type { BillingRecord } from '../types'

export interface BillingCardProps {
  record: BillingRecord
  clientName?: string
  projectTitle?: string
  onMarkInvoiced?: () => void
  onMarkOverdue?: () => void
  onMarkPaid?: () => void
}

function BillingCard({
  record,
  clientName,
  projectTitle,
  onMarkInvoiced,
  onMarkOverdue,
  onMarkPaid,
}: BillingCardProps) {
  return (
    <article className="customer-card-group billing-card">
      <div className="customer-project-head">
        <div>
          <strong>{projectTitle || 'Projekat'}</strong>
          <p className="customer-project-meta">{clientName || 'Klijent'}</p>
        </div>
        <div className="customer-project-badges">
          <span className={`customer-status-badge is-${BILLING_STATUS_TONES[record.status]}`}>
            {BILLING_STATUS_LABELS[record.status]}
          </span>
        </div>
      </div>

      <dl className="customer-card-detail-list">
        <div>
          <dt>Opis</dt>
          <dd>{record.description}</dd>
        </div>
        <div>
          <dt>Iznos</dt>
          <dd>{record.amount ? `${record.amount} ${record.currency}` : '-'}</dd>
        </div>
        <div>
          <dt>Rok plaćanja</dt>
          <dd>{record.dueDate || '-'}</dd>
        </div>
        <div>
          <dt>Broj fakture</dt>
          <dd>{record.invoiceNumber || '-'}</dd>
        </div>
        <div>
          <dt>Trošak rada</dt>
          <dd>{record.totalLaborCost ? `${record.totalLaborCost} RSD` : '-'}</dd>
        </div>
        <div>
          <dt>Trošak materijala</dt>
          <dd>{record.totalMaterialCost ? `${record.totalMaterialCost} RSD` : '-'}</dd>
        </div>
        <div>
          <dt>Ukupan trošak</dt>
          <dd>{record.totalCost ? `${record.totalCost} RSD` : '-'}</dd>
        </div>
      </dl>

      {record.status === 'draft' && onMarkInvoiced ? (
        <div className="customer-project-actions">
          <button type="button" className="customer-project-toggle" onClick={onMarkInvoiced}>
            Označi kao fakturisano
          </button>
        </div>
      ) : null}

      {record.status === 'invoiced' ? (
        <div className="customer-project-actions">
          {onMarkOverdue ? (
            <button type="button" className="customer-project-toggle" onClick={onMarkOverdue}>
              Označi kao kasni
            </button>
          ) : null}
          {onMarkPaid ? (
            <button type="button" className="customer-project-toggle" onClick={onMarkPaid}>
              Označi kao plaćeno
            </button>
          ) : null}
        </div>
      ) : null}

      {record.status === 'overdue' && onMarkPaid ? (
        <div className="customer-project-actions">
          <button type="button" className="customer-project-toggle" onClick={onMarkPaid}>
            Označi kao plaćeno
          </button>
        </div>
      ) : null}
    </article>
  )
}

export default BillingCard
