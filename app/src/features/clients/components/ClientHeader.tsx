export interface ClientHeaderProps {
  name: string
  city: string
}

function ClientHeader({ name, city }: ClientHeaderProps) {
  return (
    <header className="customer-card-header">
      <div>
        <h2 className="customer-card-title">{name}</h2>
        <p className="customer-card-subtitle">{city || 'Grad nije unet'}</p>
      </div>
    </header>
  )
}

export default ClientHeader
