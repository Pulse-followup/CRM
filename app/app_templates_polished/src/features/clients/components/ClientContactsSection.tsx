import type { ClientContact } from '../types'

export interface ClientContactsSectionProps {
  contacts: ClientContact[]
}

function ClientContactsSection({ contacts }: ClientContactsSectionProps) {
  return (
    <details className="customer-card-section customer-card-collapsible">
      <summary className="customer-card-section-head">
        <h3>Kontakti</h3>
        <span className="customer-collapse-icon" aria-hidden="true">▾</span>
      </summary>

      <div className="customer-card-section-body">
        {contacts.length ? (
          <div className="customer-card-stack">
            {contacts.map((contact, index) => (
              <article key={`${contact.email}-${index}`} className="customer-card-group">
                <dl className="customer-card-detail-list">
                  <div>
                    <dt>Ime</dt>
                    <dd>{contact.name || '-'}</dd>
                  </div>
                  <div>
                    <dt>Funkcija</dt>
                    <dd>{contact.role || '-'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{contact.email || '-'}</dd>
                  </div>
                  <div>
                    <dt>Telefon</dt>
                    <dd>{contact.phone || '-'}</dd>
                  </div>
                  {contact.note ? (
                    <div>
                      <dt>Napomena</dt>
                      <dd>{contact.note}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <div className="customer-card-empty">Nema unetih kontakata</div>
        )}
      </div>
    </details>
  )
}

export default ClientContactsSection
