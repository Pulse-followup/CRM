export interface ClientActionsBarProps {
  clientId?: string
  onEditClient?: () => void
  onNewActivity?: () => void
  onNewProject?: () => void
}

function ClientActionsBar({
  clientId,
  onEditClient,
  onNewActivity,
  onNewProject,
}: ClientActionsBarProps) {
  return (
    <div className="customer-actions-bar" data-client-id={clientId}>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={onEditClient}
      >
        Izmeni podatke
      </button>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={onNewProject}
      >
        Novi projekat
      </button>
      <button
        type="button"
        className="customer-btn customer-btn-secondary"
        onClick={onNewActivity}
      >
        Nova aktivnost
      </button>
    </div>
  )
}

export default ClientActionsBar
