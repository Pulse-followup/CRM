import type { CommercialInputs } from '../types'

export interface ClientCommercialSectionProps extends CommercialInputs {}

function ClientCommercialSection({
  businessType,
  revenueBand,
  employeeCount,
  locationCount,
  decisionLevel,
  relationshipLevel,
  innovationReady,
}: ClientCommercialSectionProps) {
  return (
    <section className="customer-card-section">
      <div className="customer-card-section-head">
        <h3>Komercijalni inputi</h3>
      </div>

      <div className="customer-card-group">
        <dl className="customer-card-detail-list">
          <div>
            <dt>Tip delatnosti</dt>
            <dd>{businessType || '-'}</dd>
          </div>
          <div>
            <dt>Promet</dt>
            <dd>{revenueBand || '-'}</dd>
          </div>
          <div>
            <dt>Broj zaposlenih</dt>
            <dd>{employeeCount ?? '-'}</dd>
          </div>
          <div>
            <dt>Broj objekata</dt>
            <dd>{locationCount ?? '-'}</dd>
          </div>
          <div>
            <dt>Nivo odlučivanja</dt>
            <dd>{decisionLevel || '-'}</dd>
          </div>
          <div>
            <dt>Odnos</dt>
            <dd>{relationshipLevel || '-'}</dd>
          </div>
          <div>
            <dt>Spremnost za inovacije</dt>
            <dd>{innovationReady || '-'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

export default ClientCommercialSection
