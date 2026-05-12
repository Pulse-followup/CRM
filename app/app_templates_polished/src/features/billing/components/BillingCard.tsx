import { useState } from 'react'
import { BILLING_STATUS_LABELS, BILLING_STATUS_TONES } from '../billingLabels'
import { getBillingStatus } from '../billingLifecycle'
import type { BillingRecord } from '../types'

export interface BillingCardProps {
  record: BillingRecord
  clientName?: string
  projectTitle?: string
  onMarkInvoiced?: () => void
  onMarkOverdue?: () => void
  onMarkPaid?: () => void
}

function formatMoney(value?: number | null, currency = 'RSD') {
  if (!value) return '-'
  return `${Math.round(value).toLocaleString('sr-RS')} ${currency}`
}

function getMargin(record: BillingRecord) {
  if (!record.amount || !record.totalCost) return null
  return record.amount - record.totalCost
}

function BillingCard({
  record,
  clientName,
  projectTitle,
  onMarkInvoiced,
  onMarkOverdue,
  onMarkPaid,
}: BillingCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const margin = getMargin(record)
  const billingStatus = getBillingStatus(record)

  return (
    <article className="billing-clean-card">
      <button type="button" className="billing-clean-summary" onClick={() => setIsOpen((value) => !value)}>
        <div className="billing-clean-main">
          <strong>{projectTitle || 'Projekat'}</strong>
          <span>{clientName || 'Klijent'} · rok {record.dueDate || '-'}</span>
        </div>

        <div className="billing-clean-side">
          <strong>{formatMoney(record.amount, record.currency)}</strong>
          <span className={`customer-status-badge is-${BILLING_STATUS_TONES[record.status]}`}>
            {BILLING_STATUS_LABELS[record.status]}
          </span>
        </div>
      </button>

      <div className="billing-clean-costs">
        <span>Rad: {formatMoney(record.totalLaborCost)}</span>
        <span>Materijal: {formatMoney(record.totalMaterialCost)}</span>
        <span>Trosak: {formatMoney(record.totalCost)}</span>
        {margin !== null ? <span>Marza: {formatMoney(margin)}</span> : null}
      </div>

      <div className="billing-clean-actions">
        <button type="button" className="customer-project-toggle" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? 'Sakrij detalje' : 'Otvori detalje'}
        </button>
        {billingStatus === 'issued' && (record.status === 'draft' || record.status === 'ready') && onMarkInvoiced ? (
          <button type="button" className="customer-project-toggle" onClick={onMarkInvoiced}>
            Oznaci kao fakturisano
          </button>
        ) : null}
        {billingStatus === 'issued' && record.status === 'invoiced' && onMarkOverdue ? (
          <button type="button" className="customer-project-toggle" onClick={onMarkOverdue}>
            Oznaci kao kasni
          </button>
        ) : null}
        {(billingStatus === 'issued' || billingStatus === 'overdue') && onMarkPaid ? (
          <button type="button" className="customer-project-toggle" onClick={onMarkPaid}>
            Oznaci kao placeno
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <dl className="billing-clean-details">
          <div>
            <dt>Opis</dt>
            <dd>{record.description || '-'}</dd>
          </div>
          <div>
            <dt>Broj fakture</dt>
            <dd>{record.invoiceNumber || '-'}</dd>
          </div>
          <div>
            <dt>Rok placanja</dt>
            <dd>{record.dueDate || '-'}</dd>
          </div>
          <div>
            <dt>Iznos</dt>
            <dd>{formatMoney(record.amount, record.currency)}</dd>
          </div>
          <div>
            <dt>Trosak rada</dt>
            <dd>{formatMoney(record.totalLaborCost)}</dd>
          </div>
          <div>
            <dt>Trosak materijala</dt>
            <dd>{formatMoney(record.totalMaterialCost)}</dd>
          </div>
          <div>
            <dt>Ukupan trosak</dt>
            <dd>{formatMoney(record.totalCost)}</dd>
          </div>
          <div>
            <dt>Marza</dt>
            <dd>{margin !== null ? formatMoney(margin) : '-'}</dd>
          </div>
        </dl>
      ) : null}
    </article>
  )
}

export default BillingCard
