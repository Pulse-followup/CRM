import { useEffect, useMemo, useState } from 'react'
import { BILLING_STATUS_LABELS } from '../features/billing/billingLabels'
import { useBillingStore } from '../features/billing/billingStore'
import type { BillingRecord, BillingStatus } from '../features/billing/types'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'

type FinanceItem = { record: BillingRecord; client: string; project: string }

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatAmountValue(amount: number | null | undefined, currency = 'RSD') {
  return typeof amount === 'number' ? `${amount.toLocaleString('sr-RS')} ${currency}` : '-'
}

function tone(status: BillingStatus) {
  if (status === 'overdue') return 'red'
  if (status === 'paid') return 'green'
  if (status === 'invoiced') return 'blue'
  if (status === 'ready' || status === 'draft') return 'white'
  return 'white'
}

function Section({ title, empty, items, toneClass, onOpen }: { title: string; empty: string; items: FinanceItem[]; toneClass: 'red' | 'white' | 'blue' | 'green'; onOpen: (item: FinanceItem) => void }) {
  return (
    <section className={`pulse-panel pulse-panel-${toneClass}`}>
      <h3>{title}</h3>
      {items.length === 0 ? <p className="pulse-empty">{empty}</p> : <div className="pulse-list">{items.map((item) => (
        <article key={item.record.id} className="pulse-item pulse-billing-card" onClick={() => onOpen(item)}>
          <div className="pulse-item-title-row"><h4>{formatAmountValue(item.record.amount, item.record.currency)}</h4><span className={`pulse-pill pulse-pill-${tone(item.record.status)}`}>{BILLING_STATUS_LABELS[item.record.status]}</span></div>
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

function BillingModal({
  item,
  onClose,
  onSaveInvoice,
  onPaid,
  onOverdue,
}: {
  item: FinanceItem
  onClose: () => void
  onSaveInvoice: (payload: { invoiceNumber: string; amount: number; currency: string; dueDate: string }) => void
  onPaid: () => void
  onOverdue: () => void
}) {
  const defaultDueDate = new Date()
  defaultDueDate.setDate(defaultDueDate.getDate() + 15)
  const [invoiceNumber, setInvoiceNumber] = useState(item.record.invoiceNumber || '')
  const [amount, setAmount] = useState(String(item.record.amount ?? item.record.totalCost ?? 0))
  const [currency, setCurrency] = useState(item.record.currency || 'RSD')
  const [dueDate, setDueDate] = useState(item.record.dueDate || defaultDueDate.toISOString().slice(0, 10))

  const saveInvoice = () => {
    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) return
    onSaveInvoice({ invoiceNumber, amount: parsedAmount, currency, dueDate })
  }

  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div className="pulse-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="pulse-modal-x" type="button" onClick={onClose}>x</button>
        <h3>Detalji naplatnog naloga</h3>
        <p><strong>Klijent</strong> - {item.client}</p>
        <p><strong>Projekat</strong> - {item.project}</p>
        <p><strong>Opis</strong> - {item.record.description || '-'}</p>
        <p><strong>Rad</strong> - {formatAmountValue(item.record.totalLaborCost ?? 0)}</p>
        <p><strong>Materijal</strong> - {formatAmountValue(item.record.totalMaterialCost ?? 0)}</p>
        <p><strong>Ukupni interni trošak</strong> - {formatAmountValue(item.record.totalCost ?? 0)}</p>
        <p><strong>Status</strong> - {BILLING_STATUS_LABELS[item.record.status]}</p>

        {item.record.status === 'draft' || item.record.status === 'ready' ? (
          <div className="pulse-complete-form">
            <label className="pulse-form-field"><span>Broj fakture</span><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="npr. 2026/EC/001" /></label>
            <label className="pulse-form-field"><span>Iznos za naplatu</span><input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
            <label className="pulse-form-field"><span>Valuta</span><input value={currency} onChange={(event) => setCurrency(event.target.value)} /></label>
            <label className="pulse-form-field"><span>Rok plaćanja</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <div className="pulse-modal-actions">
              <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={saveInvoice}>OZNAČI KAO FAKTURISANO</button>
              <button className="pulse-modal-btn pulse-modal-btn-red" type="button" onClick={onClose}>OTKAŽI</button>
            </div>
          </div>
        ) : (
          <div className="pulse-modal-actions">
            {item.record.status === 'invoiced' ? <button className="pulse-modal-btn pulse-modal-btn-red" type="button" onClick={onOverdue}>OZNAČI KAO KASNI</button> : null}
            {(item.record.status === 'invoiced' || item.record.status === 'overdue') ? <button className="pulse-modal-btn pulse-modal-btn-green" type="button" onClick={onPaid}>OZNAČI KAO PLAĆENO</button> : null}
            <button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={onClose}>ZATVORI</button>
          </div>
        )}
      </div>
    </div>
  )
}

function FinanceHome() {
  const { getAllBilling, updateBillingRecord, markBillingOverdue, markBillingPaid, refreshBillingFromCloud, isCloudBillingMode } = useBillingStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()
  const [opened, setOpened] = useState<FinanceItem | null>(null)

  useEffect(() => {
    if (isCloudBillingMode) {
      void refreshBillingFromCloud()
    }
  }, [isCloudBillingMode, refreshBillingFromCloud])

  const billingItems = useMemo<FinanceItem[]>(() => getAllBilling().map((record) => ({
    record,
    client: getClientById(record.clientId)?.name ?? (record as any).clientName ?? 'Nepoznat klijent',
    project: getProjectById(record.projectId)?.title ?? (record as any).projectName ?? record.description ?? 'Nepoznat projekat',
  })), [getAllBilling, getClientById, getProjectById])

  const by = (status: BillingStatus) => billingItems.filter((item) => item.record.status === status)

  return (
    <section className="pulse-phone-screen">
      <h2>Pregled faktura</h2>
      <Section title="Za fakturisanje" empty="Nema naloga spremnih za fakturisanje." items={billingItems.filter((item) => item.record.status === 'ready' || item.record.status === 'draft')} toneClass="white" onOpen={setOpened} />
      <Section title="FAKTURISANO" empty="Nema otvorenih faktura koje čekaju uplatu." items={by('invoiced')} toneClass="blue" onOpen={setOpened} />
      <Section title="PLAĆENO" empty="Još nema zatvorenih uplata." items={by('paid')} toneClass="green" onOpen={setOpened} />
      <Section title="KASNI" empty="Nema dospelih kašnjenja." items={by('overdue')} toneClass="red" onOpen={setOpened} />
      {opened ? <BillingModal item={opened} onClose={() => setOpened(null)} onSaveInvoice={async (payload) => {
        await updateBillingRecord(opened.record.id, {
          invoiceNumber: payload.invoiceNumber,
          amount: payload.amount,
          currency: payload.currency,
          dueDate: payload.dueDate,
          status: 'invoiced',
          invoicedAt: new Date().toISOString(),
        })
        if (isCloudBillingMode) {
          await refreshBillingFromCloud()
        }
        setOpened(null)
      }} onOverdue={async () => { await markBillingOverdue(opened.record.id); if (isCloudBillingMode) await refreshBillingFromCloud(); setOpened(null) }} onPaid={async () => { await markBillingPaid(opened.record.id); if (isCloudBillingMode) await refreshBillingFromCloud(); setOpened(null) }} /> : null}
    </section>
  )
}

export default FinanceHome
