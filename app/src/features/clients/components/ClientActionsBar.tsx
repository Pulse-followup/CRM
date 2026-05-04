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
  return (
    <div className="customer-actions-bar" data-client-id={clientId}>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={onNewActivity}
      >
        Nova aktivnost
      </button>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={onNewJob}
      >
        Novi posao
      </button>
    </div>
  )
}

export default ClientActionsBar
