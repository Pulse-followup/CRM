import { useMemo, useState } from 'react'
import { BILLING_STATUS_LABELS } from '../features/billing/billingLabels'
import { useBillingStore } from '../features/billing/billingStore'
import type { BillingRecord, BillingStatus } from '../features/billing/types'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'

type BillingItem = { record: BillingRecord; client: string; project: string }

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatAmount(record: BillingRecord) {
  return typeof record.amount === 'number' ? `${record.amount.toLocaleString('sr-RS')} ${record.currency}` : '-'
}

function tone(status: BillingStatus) {
  if (status === 'overdue') return 'red'
  if (status === 'paid') return 'green'
  if (status === 'invoiced') return 'blue'
  return 'white'
}

function Section({ title, empty, items, toneClass, onOpen }: { title: string; empty: string; items: BillingItem[]; toneClass: 'red' | 'white' | 'blue' | 'green'; onOpen: (item: BillingItem) => void }) {
  return (
    <section className={`pulse-panel pulse-panel-${toneClass}`}>
      <h3>{title}</h3>
      {items.length === 0 ? <p className="pulse-empty">{empty}</p> : <div className="pulse-list">{items.map((item) => (
        <article key={item.record.id} className="pulse-item pulse-billing-card" onClick={() => onOpen(item)}>
          <div className="pulse-item-title-row"><h4>{formatAmount(item.record)}</h4><span className={`pulse-pill pulse-pill-${tone(item.record.status)}`}>{BILLING_STATUS_LABELS[item.record.status]}</span></div>
          <dl className="pulse-mini-dl">
            <div><dt>Klijent:</dt><dd>{item.client}</dd></div>
            <div><dt>Projekat:</dt><dd>{item.project}</dd></div>
            <div><dt>Rok za plaćanje:</dt><dd>{formatDate(item.record.dueDate)}</dd></div>
          </dl>
        </article>
      ))}</div>}
    </section>
  )
}

function BillingModal({ item, onClose, onPaid, onInvoiced, onOverdue }: { item: BillingItem; onClose: () => void; onPaid: () => void; onInvoiced: () => void; onOverdue: () => void }) {
  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div className="pulse-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="pulse-modal-x" type="button" onClick={onClose}>x</button>
        <h3>Detalji naplatnog naloga</h3>
        <p><strong>Klijent</strong> - {item.client}</p>
        <p><strong>Projekat</strong> - {item.project}</p>
        <p><strong>Opis</strong> - {item.record.description || '-'}</p>
        <p><strong>Iznos</strong> - {formatAmount(item.record)}</p>
        <p><strong>Rok</strong> - {formatDate(item.record.dueDate)}</p>
        <p><strong>Status</strong> - {BILLING_STATUS_LABELS[item.record.status]}</p>
        <p><strong>Broj fakture</strong> - {item.record.invoiceNumber || '-'}</p>
        <div className="pulse-modal-actions">
          <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onInvoiced}>FAKTURISANO</button>
          <button className="pulse-modal-btn pulse-modal-btn-red" type="button" onClick={onOverdue}>KASNI</button>
          <button className="pulse-modal-btn pulse-modal-btn-green" type="button" onClick={onPaid}>PLAĆENO</button>
        </div>
      </div>
    </div>
  )
}

function FinanceHome() {
  const { getAllBilling, markBillingInvoiced, markBillingOverdue, markBillingPaid } = useBillingStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()
  const [opened, setOpened] = useState<BillingItem | null>(null)

  const items = useMemo(() => getAllBilling().map((record) => ({ record, client: getClientById(record.clientId)?.name ?? 'Nepoznat klijent', project: getProjectById(record.projectId)?.title ?? 'Nepoznat projekat' })), [getAllBilling, getClientById, getProjectById])
  const by = (status: BillingStatus) => items.filter((i) => i.record.status === status)

  return (
    <section className="pulse-phone-screen">
      <h2>Pregled faktura</h2>
      <Section title="Za fakturisanje" empty="Nema naloga spremnih za fakturisanje." items={by('draft')} toneClass="white" onOpen={setOpened} />
      <Section title="FAKTURISANO" empty="Nema otvorenih faktura koje čekaju uplatu." items={by('invoiced')} toneClass="blue" onOpen={setOpened} />
      <Section title="PLAĆENO" empty="Još nema zatvorenih uplata." items={by('paid')} toneClass="green" onOpen={setOpened} />
      <Section title="KASNI" empty="Nema dospelih kašnjenja." items={by('overdue')} toneClass="red" onOpen={setOpened} />
      {opened ? <BillingModal item={opened} onClose={() => setOpened(null)} onInvoiced={() => { markBillingInvoiced(opened.record.id); setOpened(null) }} onOverdue={() => { markBillingOverdue(opened.record.id); setOpened(null) }} onPaid={() => { markBillingPaid(opened.record.id); setOpened(null) }} /> : null}
    </section>
  )
}

export default FinanceHome
