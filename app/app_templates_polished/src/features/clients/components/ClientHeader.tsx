export interface ClientHeaderProps {
  name: string
  city: string
  pulseScore?: number
  priorityLabel?: string
  priorityTone?: 'muted' | 'warning' | 'success'
  risks?: string[]
}

function ClientHeader({
  name,
  city,
  pulseScore,
  priorityLabel,
  priorityTone = 'muted',
  risks = [],
}: ClientHeaderProps) {
  return (
    <header className="customer-card-header">
      <div>
        <h2 className="customer-card-title">{name}</h2>
        <p className="customer-card-subtitle">{city || 'Grad nije unet'}</p>
      </div>
      {typeof pulseScore === 'number' ? (
        <div className="customer-score-panel">
          <div className="customer-score-head">
            <span className="customer-score-value">PULSE {pulseScore}</span>
            {priorityLabel ? (
              <span className={`customer-status-badge is-${priorityTone}`}>
                {priorityLabel}
              </span>
            ) : null}
          </div>
          {risks.length ? (
            <ul className="customer-score-risks">
              {risks.slice(0, 2).map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          ) : (
            <p className="customer-score-meta">Bez vecih rizika trenutno.</p>
          )}
        </div>
      ) : null}
    </header>
  )
}

export default ClientHeader
