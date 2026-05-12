import type { ReactNode } from 'react'

interface SharedModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'default' | 'wide'
}

function SharedModal({ title, children, onClose, size = 'default' }: SharedModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`shared-modal is-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shared-modal-head">
          <h3>{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Zatvori">
            ×
          </button>
        </header>
        <div className="shared-modal-body">{children}</div>
      </section>
    </div>
  )
}

export default SharedModal
