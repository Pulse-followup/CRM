import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ClientActionsBar from '../components/ClientActionsBar'
import ClientCommercialSection from '../components/ClientCommercialSection'
import ClientContactsSection from '../components/ClientContactsSection'
import ClientHeader from '../components/ClientHeader'
import ClientInfoSection from '../components/ClientInfoSection'
import ClientProjectsSection from '../components/ClientProjectsSection'
import { getClientById } from '../selectors'
import { getProjectsByClientId } from '../../projects/selectors'
import './client-detail.css'

function ClientDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const clientId = id ?? ''
  const client = useMemo(() => getClientById(clientId), [clientId])
  const projects = useMemo(() => getProjectsByClientId(clientId), [clientId])

  if (!client) {
    return (
      <section className="page-card client-detail-shell">
        <button
          type="button"
          className="secondary-link-button"
          onClick={() => navigate('/clients')}
        >
          Nazad na klijente
        </button>

        <div className="clients-empty-state">
          <h2>Klijent nije pronađen</h2>
          <p>Vrati se na listu klijenata i izaberi postojeći zapis.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-card client-detail-shell">
      <button
        type="button"
        className="secondary-link-button"
        onClick={() => navigate('/clients')}
      >
        Nazad na klijente
      </button>

      <ClientHeader name={client.name} city={client.city} />
      <ClientActionsBar clientId={clientId} />
      <ClientInfoSection name={client.name} city={client.city} address={client.address} />
      <ClientContactsSection contacts={client.contacts} />
      <ClientCommercialSection {...client.commercial} />
      <ClientProjectsSection projects={projects} />
    </section>
  )
}

export default ClientDetail
