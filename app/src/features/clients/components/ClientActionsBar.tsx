export interface ClientActionsBarProps {
  clientId?: string
}

function ClientActionsBar({ clientId }: ClientActionsBarProps) {
  return (
    <div className="customer-actions-bar" data-client-id={clientId}>
      <button type="button" className="customer-btn customer-btn-secondary">
        Izmeni podatke
      </button>
      <button type="button" className="customer-btn customer-btn-secondary">
        Novi projekat
      </button>
    </div>
  )
}

export default ClientActionsBar
