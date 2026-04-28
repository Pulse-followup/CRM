type HeaderProps = {
  title: string
  subtitle?: string
}

function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="app-header">
      <div>
        <p className="app-eyebrow">PULSE</p>
        <h1>{title}</h1>
        {subtitle ? <p className="app-subtitle">{subtitle}</p> : null}
      </div>
    </header>
  )
}

export default Header
