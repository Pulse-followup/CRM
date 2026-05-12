export interface ClientInfoSectionProps {
  name: string
  city: string
  address: string
}

function ClientInfoSection({ name, city, address }: ClientInfoSectionProps) {
  return (
    <details className="customer-card-section customer-card-collapsible">
      <summary className="customer-card-section-head">
        <h3>Osnovni podaci</h3>
        <span className="customer-collapse-icon" aria-hidden="true">▾</span>
      </summary>

      <div className="customer-card-section-body">
        <div className="customer-card-group">
          <dl className="customer-card-detail-list">
            <div>
              <dt>Naziv</dt>
              <dd>{name || '-'}</dd>
            </div>
            <div>
              <dt>Grad</dt>
              <dd>{city || '-'}</dd>
            </div>
            <div>
              <dt>Adresa</dt>
              <dd>{address || '-'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </details>
  )
}

export default ClientInfoSection
