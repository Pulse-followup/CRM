import { useNavigate } from 'react-router-dom'

export interface ClientActionsBarProps {
  clientId?: string
  onNewActivity?: () => void
  onNewJob?: () => void
}

function ClientActionsBar({
  clientId,
  onNewActivity,
  onNewJob,
}: ClientActionsBarProps) {
  const navigate = useNavigate()

  const openNewActivity = () => {
    if (clientId) {
      navigate(`/clients/${clientId}/new-activity`)
      return
    }
    onNewActivity?.()
  }

  const openNewJob = () => {
    if (clientId) {
      navigate(`/clients/${clientId}/new-job`)
      return
    }
    onNewJob?.()
  }

  return (
    <div className="customer-actions-bar" data-client-id={clientId}>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={openNewActivity}
      >
        Nova aktivnost
      </button>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={openNewJob}
      >
        Novi posao
      </button>
    </div>
  )
}

export default ClientActionsBar
