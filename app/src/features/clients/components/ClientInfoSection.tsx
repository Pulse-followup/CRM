export interface ClientInfoSectionProps {
  name: string
  city: string
  address: string
}

function ClientInfoSection({ name, city, address }: ClientInfoSectionProps) {
  return (
    <section className="customer-card-section">
      <div className="customer-card-section-head">
        <h3>Osnovni podaci</h3>
      </div>

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
    </section>
  )
}

export default ClientInfoSection
