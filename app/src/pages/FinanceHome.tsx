import { useMemo } from 'react'
import { BILLING_STATUS_LABELS, BILLING_STATUS_TONES } from '../features/billing/billingLabels'
import { useBillingStore } from '../features/billing/billingStore'
import type { BillingRecord, BillingStatus } from '../features/billing/types'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'

interface FinanceBillingItem {
  record: BillingRecord
  clientName: string
  projectTitle: string
}

function formatAmount(amount: number | null, currency: string) {
  if (typeof amount !== 'number') {
    return '-'
  }

  return `${amount} ${currency}`
}

function formatDueDate(dueDate: string | null) {
  if (!dueDate) {
    return 'Rok nije unet'
  }

  const date = new Date(dueDate)

  if (Number.isNaN(date.getTime())) {
    return dueDate
  }

  return new Intl.DateTimeFormat('sr-RS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function FinanceBillingCard({
  item,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  item: FinanceBillingItem
  primaryActionLabel?: string
  onPrimaryAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
}) {
  const { record, clientName, projectTitle } = item

  return (
    <article className="role-home-task-item finance-home-item">
      <div className="role-home-task-copy">
        <div className="role-home-task-head">
          <h4>{projectTitle}</h4>
          <span className={`role-home-task-badge is-${BILLING_STATUS_TONES[record.status]}`}>
            {BILLING_STATUS_LABELS[record.status]}
          </span>
        </div>

        <dl>
          <div>
            <dt>Klijent</dt>
            <dd>{clientName}</dd>
          </div>
          <div>
            <dt>Iznos</dt>
            <dd>{formatAmount(record.amount, record.currency)}</dd>
          </div>
          <div>
            <dt>Rok</dt>
            <dd>{formatDueDate(record.dueDate)}</dd>
          </div>
          <div>
            <dt>Broj fakture</dt>
            <dd>{record.invoiceNumber || '-'}</dd>
          </div>
        </dl>

        {primaryActionLabel || secondaryActionLabel ? (
          <div className="role-home-task-actions">
            {primaryActionLabel && onPrimaryAction ? (
              <button className="settings-secondary-button" type="button" onClick={onPrimaryAction}>
                {primaryActionLabel}
              </button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <button className="settings-secondary-button" type="button" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function FinanceSection({
  title,
  emptyText,
  items,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
}: {
  title: string
  emptyText: string
  items: FinanceBillingItem[]
  primaryActionLabel?: (record: BillingRecord) => string
  onPrimaryAction?: (record: BillingRecord) => void
  secondaryActionLabel?: (record: BillingRecord) => string
  onSecondaryAction?: (record: BillingRecord) => void
}) {
  return (
    <article className="role-home-card role-home-focus-card">
      <div className="role-home-focus-head">
        <div className="role-home-focus-title">
          <h3>{title}</h3>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="role-home-empty">{emptyText}</p>
      ) : (
        <div className="role-home-task-list">
          {items.map((item) => (
            <FinanceBillingCard
              key={item.record.id}
              item={item}
              primaryActionLabel={primaryActionLabel?.(item.record)}
              onPrimaryAction={onPrimaryAction ? () => onPrimaryAction(item.record) : undefined}
              secondaryActionLabel={secondaryActionLabel?.(item.record)}
              onSecondaryAction={onSecondaryAction ? () => onSecondaryAction(item.record) : undefined}
            />
          ))}
        </div>
      )}
    </article>
  )
}

function FinanceHome() {
  const { getAllBilling, markBillingInvoiced, markBillingOverdue, markBillingPaid } =
    useBillingStore()
  const { getClientById } = useClientStore()
  const { getProjectById } = useProjectStore()

  const billing = getAllBilling()

  const billingItems = useMemo(
    () =>
      billing.map((record) => ({
        record,
        clientName: getClientById(record.clientId)?.name ?? 'Nepoznat klijent',
        projectTitle: getProjectById(record.projectId)?.title ?? 'Nepoznat projekat',
      })),
    [billing, getClientById, getProjectById],
  )

  const byStatus = (status: BillingStatus) =>
    billingItems.filter((item) => item.record.status === status)

  const handleReminder = (record: BillingRecord) => {
    window.alert(
      `Podsetnik za ${getProjectById(record.projectId)?.title ?? 'projekat'} ide u sledećoj fazi. Za sada nalog ostaje u statusu Kasni.`,
    )
  }

  return (
    <section className="role-home-shell">
      <header className="role-home-header">
        <h2>Naplata</h2>
        <p>Pregled faktura i otvorenih obaveza.</p>
      </header>

      <div className="role-home-grid role-home-grid-focus">
        <FinanceSection
          title="Za fakturisanje"
          emptyText="Nema naloga spremnih za fakturisanje."
          items={byStatus('draft')}
          primaryActionLabel={() => 'Kreiraj fakturu'}
          onPrimaryAction={(record) => markBillingInvoiced(record.id)}
        />
        <FinanceSection
          title="Fakturisano"
          emptyText="Nema otvorenih faktura koje čekaju uplatu."
          items={byStatus('invoiced')}
          primaryActionLabel={() => 'Označi kao plaćeno'}
          onPrimaryAction={(record) => markBillingPaid(record.id)}
          secondaryActionLabel={() => 'Označi kao kasni'}
          onSecondaryAction={(record) => markBillingOverdue(record.id)}
        />
        <FinanceSection
          title="Plaćeno"
          emptyText="Još nema zatvorenih uplata."
          items={byStatus('paid')}
        />
        <FinanceSection
          title="Kasni"
          emptyText="Nema dospelih kašnjenja."
          items={byStatus('overdue')}
          primaryActionLabel={() => 'Pošalji podsetnik'}
          onPrimaryAction={handleReminder}
          secondaryActionLabel={() => 'Označi kao plaćeno'}
          onSecondaryAction={(record) => markBillingPaid(record.id)}
        />
      </div>
    </section>
  )
}

export default FinanceHome
