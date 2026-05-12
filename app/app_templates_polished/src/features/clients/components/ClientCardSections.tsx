import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BillingRecord } from '../../billing/types'
import ClientCommercialSection from './ClientCommercialSection'
import ClientContactsSection from './ClientContactsSection'
import ClientInfoSection from './ClientInfoSection'
import ClientProjectsSection from './ClientProjectsSection'
import { isProductVisibleForClient, readProducts } from '../../products/productStorage'
import type { ProductItem } from '../../products/types'
import { getProjectLifecycle } from '../../projects/projectLifecycle'
import type { Project } from '../../projects/types'
import { isTaskCompleted, isTaskOpen } from '../../tasks/taskLifecycle'
import type { Task } from '../../tasks/types'
import type { ClientContact, CommercialInputs } from '../types'

export interface ClientCardSectionsProps {
  clientId?: string
  clientName: string
  clientCity?: string
  clientAddress?: string
  contacts: ClientContact[]
  commercial: CommercialInputs
  projects: Project[]
  tasks: Task[]
  billing: BillingRecord[]
  onEditClient: () => void
  onAddFromCatalog?: (productId?: string) => void
  catalogNotice?: boolean
}

function formatAmount(value: number | null | undefined, currency = 'RSD') {
  return typeof value === 'number' ? `${value.toLocaleString('sr-RS')} ${currency}` : '-'
}

function ClientCardSections({
  clientId,
  clientName,
  clientCity,
  clientAddress,
  contacts,
  commercial,
  projects,
  tasks,
  billing,
  onEditClient,
  onAddFromCatalog,
  catalogNotice,
}: ClientCardSectionsProps) {
  const navigate = useNavigate()
  const archivedProjects = projects.filter((project) => project.status === 'arhiviran')
  const lifecycleByProjectId = new Map(
    projects.map((project) => [project.id, getProjectLifecycle(project, tasks, billing)]),
  )
  const activeProjects = projects.filter((project) => project.status !== 'arhiviran' && lifecycleByProjectId.get(project.id)?.status === 'active')
  const activeProjectIds = new Set(activeProjects.map((project) => project.id))
  const allProjectIds = new Set(projects.map((project) => project.id))
  const normalizedClientId = clientId ? String(clientId) : ''
  const clientTasks = tasks.filter((task) => {
    const belongsToClient = normalizedClientId ? String(task.clientId ?? '') === normalizedClientId : false
    const belongsToClientProject = task.projectId ? allProjectIds.has(task.projectId) : false

    return belongsToClient || belongsToClientProject
  })
  const activeTasks = clientTasks.filter((task) => isTaskOpen(task) && (!task.projectId || activeProjectIds.has(task.projectId)))
  const completedClientTasks = clientTasks
    .filter(isTaskCompleted)
    .slice()
    .sort((first, second) => new Date(second.completedAt || second.updatedAt || second.createdAt).getTime() - new Date(first.completedAt || first.updatedAt || first.createdAt).getTime())
    .slice(0, 8)
  const clientBilling = billing.filter((record) => allProjectIds.has(record.projectId))
  const openBilling = clientBilling.filter((record) => record.status !== 'paid' && record.status !== 'cancelled')
  const paidBilling = billing.filter((record) =>
    projects.some((project) => project.id === record.projectId) && record.status === 'paid',
  )
  const catalogProducts = useMemo(() => {
    if (!clientId) return []
    return readProducts().filter((product) => product.status === 'active' && isProductVisibleForClient(product, clientId))
  }, [clientId])
  const lastProduct = activeProjects[0]?.title || archivedProjects[0]?.title

  return (
    <div className="customer-sections-stack">
      <details className="customer-card-section customer-card-collapsible" open>
        <summary className="customer-card-section-head">
          <h3>Aktivno</h3>
          <span className="customer-collapse-icon" aria-hidden="true">▾</span>
        </summary>
        <div className="customer-card-section-body">
          <div className="customer-overview-grid">
            <button
              type="button"
              className="customer-overview-item customer-overview-link"
              onClick={() => navigate(clientId ? `/projects?clientId=${clientId}` : '/projects')}
            >
              <span>Aktivni projekti</span>
              <strong>{activeProjects.length}</strong>
              <em>Otvori listu projekata →</em>
            </button>
            <div className="customer-overview-item">
              <span>Otvoreni taskovi</span>
              <strong>{activeTasks.length}</strong>
            </div>
            <div className="customer-overview-item">
              <span>Status naplate</span>
              <strong>{openBilling.length ? `${openBilling.length} otvoreno` : 'u roku'}</strong>
            </div>
          </div>
          <button
            type="button"
            className="customer-active-projects-entry"
            onClick={() => navigate(clientId ? `/projects?clientId=${clientId}` : '/projects')}
          >
            <span>Aktivni projekti</span>
            <strong>Otvori aktivne projekte →</strong>
          </button>
        </div>
      </details>

      <details className="customer-card-section customer-card-collapsible">
        <summary className="customer-card-section-head">
          <h3>Podaci</h3>
          <span className="customer-collapse-icon" aria-hidden="true">▾</span>
        </summary>
        <div className="customer-card-section-body">
          <div className="customer-inline-actions">
            <button type="button" className="customer-mini-action" onClick={onEditClient}>
              Izmeni podatke
            </button>
          </div>
          <ClientInfoSection name={clientName} city={clientCity || ''} address={clientAddress || ''} />
          <ClientContactsSection contacts={contacts} />
          <ClientCommercialSection {...commercial} />
        </div>
      </details>

      <details className="customer-card-section customer-card-collapsible">
        <summary className="customer-card-section-head">
          <h3>Proizvodi / katalog</h3>
          <span className="customer-collapse-icon" aria-hidden="true">▾</span>
        </summary>
        <div className="customer-card-section-body">
          <div className="customer-card-group">
            <dl className="customer-card-detail-list">
              <div>
                <dt>Šta je klijent kupovao</dt>
                <dd>{lastProduct || 'Još nema povezanih proizvoda'}</dd>
              </div>
              <div>
                <dt>Dostupni proizvodi</dt>
                <dd>{catalogProducts.length ? `${catalogProducts.length} relevantno` : 'Nema proizvoda za ovog klijenta'}</dd>
              </div>
            </dl>
          </div>

          {catalogProducts.length ? (
            <div className="customer-catalog-products">
              {catalogProducts.slice(0, 4).map((product: ProductItem) => (
                <button type="button" className="customer-catalog-product-pill" key={product.id} onClick={() => onAddFromCatalog?.(product.id)}>
                  {product.imageDataUrl ? <img src={product.imageDataUrl} alt="" /> : <span>{product.title.slice(0, 2).toUpperCase()}</span>}
                  <strong>{product.title}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="customer-card-empty">
              Dodaj univerzalni proizvod ili proizvod vezan za ovog klijenta u katalogu.
            </div>
          )}


          {catalogNotice ? (
            <div className="customer-card-empty">
              Sledeća faza: izbor proizvoda iz kataloga kreira posao/projekat i automatske taskove.
            </div>
          ) : null}
          <button type="button" className="customer-project-action-button" onClick={() => onAddFromCatalog?.()}>
            Dodaj iz kataloga
          </button>
        </div>
      </details>

      <details className="customer-card-section customer-card-collapsible">
        <summary className="customer-card-section-head">
          <h3>Istorija</h3>
          <span className="customer-collapse-icon" aria-hidden="true">▾</span>
        </summary>
        <div className="customer-card-section-body">
          <div className="customer-overview-grid">
            <div className="customer-overview-item">
              <span>Završeni/arhivirani projekti</span>
              <strong>{archivedProjects.length}</strong>
            </div>
            <div className="customer-overview-item">
              <span>Plaćene fakture</span>
              <strong>{paidBilling.length}</strong>
            </div>
            <div className="customer-overview-item">
              <span>Ukupno plaćeno</span>
              <strong>{formatAmount(paidBilling.reduce((sum, record) => sum + (record.amount ?? 0), 0))}</strong>
            </div>
          </div>
          <div className="customer-card-group">
            <h4>Završene aktivnosti</h4>
            {completedClientTasks.length ? (
              <div className="customer-activity-history-list">
                {completedClientTasks.map((task) => (
                  <div className="customer-activity-history-item" key={task.id}>
                    <strong>{task.title}</strong>
                    <span>{task.projectId ? 'Projektni task' : 'Ad hoc aktivnost'} · {task.completedAt ? new Intl.DateTimeFormat('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(task.completedAt)) : 'završeno'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="customer-card-empty">Nema završenih aktivnosti.</div>
            )}
          </div>
          <ClientProjectsSection projects={archivedProjects} title="Arhiva projekata" emptyText="Nema arhiviranih projekata" hideArchived />
        </div>
      </details>
    </div>
  )
}

export default ClientCardSections
