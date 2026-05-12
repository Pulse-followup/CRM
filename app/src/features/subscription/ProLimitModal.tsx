import { useState } from 'react'
import { useCloudStore } from '../cloud/cloudStore'

interface ProLimitModalProps {
  isOpen: boolean
  onClose: () => void
}

function ProLimitModal({ isOpen, onClose }: ProLimitModalProps) {
  const cloud = useCloudStore()
  const [proCode, setProCode] = useState('')
  const [message, setMessage] = useState('')

  if (!isOpen) return null

  const handleActivate = async () => {
    setMessage('')
    try {
      await cloud.activateProCode(proCode)
      setProCode('')
      setMessage('PRO workspace je aktiviran.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'PRO kod nije prihvaćen.')
    }
  }

  return (
    <div className="pulse-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pulse-modal pulse-pro-limit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-limit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="pulse-modal-x" onClick={onClose} aria-label="Zatvori">
          ×
        </button>
        <h3 id="pro-limit-modal-title">FREE limit dostignut</h3>
        <p>Vaš FREE workspace podržava:</p>
        <ul className="pulse-pro-limit-list">
          <li>do 3 klijenta</li>
          <li>do 5 članova tima</li>
        </ul>
        <p>Za nastavak rada aktivirajte PRO workspace kodom koji izdaje PULSE.</p>
        <div className="pulse-pro-code-field">
          <span>PRO kod</span>
          <input value={proCode} onChange={(event) => setProCode(event.target.value)} placeholder="Unesite dodeljeni PRO kod" />
        </div>
        {message ? <p className={message.includes('aktiviran') ? 'settings-success-text' : 'settings-error-text'}>{message}</p> : null}
        <div className="pulse-modal-actions">
          <button type="button" className="pulse-modal-btn pulse-modal-btn-blue" onClick={() => void handleActivate()}>
            Unesi PRO kod
          </button>
          <a className="pulse-modal-btn pulse-modal-btn-green pulse-pro-contact-link" href="mailto:hello@pulse.rs?subject=PULSE%20PRO%20workspace">
            Kontaktiraj nas
          </a>
        </div>
      </div>
    </div>
  )
}

export default ProLimitModal
