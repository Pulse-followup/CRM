import {
  BUSINESS_TYPE_LABELS,
  DECISION_LEVEL_LABELS,
  INNOVATION_READY_LABELS,
  RELATIONSHIP_LEVEL_LABELS,
  REVENUE_BAND_LABELS,
} from '../clientCommercialOptions'
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
  const businessTypeLabel = BUSINESS_TYPE_LABELS[businessType as keyof typeof BUSINESS_TYPE_LABELS] ?? businessType
  const revenueBandLabel = REVENUE_BAND_LABELS[revenueBand as keyof typeof REVENUE_BAND_LABELS] ?? revenueBand
  const decisionLevelLabel = DECISION_LEVEL_LABELS[decisionLevel as keyof typeof DECISION_LEVEL_LABELS] ?? decisionLevel
  const relationshipLevelLabel =
    RELATIONSHIP_LEVEL_LABELS[relationshipLevel as keyof typeof RELATIONSHIP_LEVEL_LABELS] ?? relationshipLevel
  const innovationReadyLabel =
    INNOVATION_READY_LABELS[innovationReady as keyof typeof INNOVATION_READY_LABELS] ?? innovationReady

  return (
    <section className="customer-card-section">
      <div className="customer-card-section-head">
        <h3>Komercijalni inputi</h3>
      </div>

      <div className="customer-card-group">
        <dl className="customer-card-detail-list">
          <div>
            <dt>Tip delatnosti</dt>
            <dd>{businessTypeLabel || '-'}</dd>
          </div>
          <div>
            <dt>Promet</dt>
            <dd>{revenueBandLabel || '-'}</dd>
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
            <dt>Nivo odlucivanja</dt>
            <dd>{decisionLevelLabel || '-'}</dd>
          </div>
          <div>
            <dt>Odnos</dt>
            <dd>{relationshipLevelLabel || '-'}</dd>
          </div>
          <div>
            <dt>Spremnost za inovacije</dt>
            <dd>{innovationReadyLabel || '-'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

export default ClientCommercialSection
