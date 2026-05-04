import { useEffect, useMemo, useState } from 'react'

const PULSE_WELCOME_KEY = 'pulse.welcomeGuide.seen.v1'

type PulseWelcomeGuideProps = {
  isOpen: boolean
  onClose: () => void
}

const slides = [
  {
    kicker: 'WELCOME TO PULSE',
    title: 'Imaš firmu, agenciju ili tim koji stalno nešto juri?',
    body:
      'Projekti kasne, zadaci se gube po porukama, naplata čeka, a klijenti nemaju isti prioritet svaki dan. PULSE je napravljen da taj haos spusti na jedan jasan ekran.',
    visualTitle: 'PULSE MODE',
    visualLines: ['Klijenti', 'Projekti', 'Tim', 'Naplata'],
  },
  {
    kicker: 'WORKSPACE',
    title: 'Prvo napravi svoj virtuelni Workspace.',
    body:
      'Workspace je tvoja firma u PULSE-u. Unesi članove tima, njihove uloge i vrednost radnog sata. Tako dobijaš osnovu za zadatke, odgovornosti i realan trošak rada.',
    visualTitle: '1 FIRMA',
    visualLines: ['Admin', 'Operativa', 'Finance', 'Tim'],
  },
  {
    kicker: 'KLIJENTI I PROJEKTI',
    title: 'Zatim dodaj klijente, projekte, proizvode ili procese.',
    body:
      'Ako vodiš kampanje — unesi kampanje. Ako radiš produkciju — unesi proizvode i korake proizvodnje. Svaki posao dobija vlasnika, rok i status.',
    visualTitle: 'FLOW',
    visualLines: ['Klijent', 'Projekat', 'Zadatak', 'Status'],
  },
  {
    kicker: 'DNEVNI RITAM',
    title: 'Otvori PULSE uz jutarnju kafu i na kraju dana.',
    body:
      'Ujutru vidi šta je hitno i bitno. Tokom dana tim završava zadatke. Uveče vidi šta je urađeno, šta kasni i šta može da ide na naplatu.',
    visualTitle: 'TODAY',
    visualLines: ['Hitno', 'Ko radi šta', 'Završeno', 'Za naplatu'],
  },
  {
    kicker: 'MVP START',
    title: 'Najbolji test: kreni sa jednim klijentom.',
    body:
      'Dodaj jednog klijenta, jedan projekat i dva zadatka. Za deset minuta videćeš da li PULSE rešava realan problem u tvom poslu. Bez filozofije — samo radni pregled.',
    visualTitle: 'START',
    visualLines: ['1 klijent', '1 projekat', '2 zadatka', '10 min'],
  },
]

function PulseWelcomeGuide({ isOpen, onClose }: PulseWelcomeGuideProps) {
  const [step, setStep] = useState(0)
  const [typedText, setTypedText] = useState('')
  const current = slides[step]

  const progress = useMemo(() => `${step + 1}/${slides.length}`, [step])

  useEffect(() => {
    if (!isOpen) return

    setTypedText('')
    let index = 0
    const text = current.body
    const timer = window.setInterval(() => {
      index += 1
      setTypedText(text.slice(0, index))
      if (index >= text.length) window.clearInterval(timer)
    }, 16)

    return () => window.clearInterval(timer)
  }, [current.body, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') setStep((value) => Math.min(value + 1, slides.length - 1))
      if (event.key === 'ArrowLeft') setStep((value) => Math.max(value - 1, 0))
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const finish = () => {
    window.localStorage.setItem(PULSE_WELCOME_KEY, 'seen')
    onClose()
  }

  const next = () => {
    if (step >= slides.length - 1) finish()
    else setStep((value) => value + 1)
  }

  const back = () => setStep((value) => Math.max(value - 1, 0))

  return (
    <div className="pulse-guide" role="dialog" aria-modal="true" aria-labelledby="pulse-guide-title">
      <div className="pulse-guide-bg pulse-guide-bg-one" />
      <div className="pulse-guide-bg pulse-guide-bg-two" />

      <section className="pulse-guide-shell">
        <button className="pulse-guide-close" type="button" onClick={finish} aria-label="Zatvori vodič">
          ×
        </button>

        <div className="pulse-guide-hero" aria-hidden="true">
          <div className="pulse-guide-orbit" />
          <div className="pulse-guide-device">
            <div className="pulse-guide-device-top">
              <span />
              <strong>{current.visualTitle}</strong>
            </div>
            <div className="pulse-guide-signal-grid">
              {current.visualLines.map((line, index) => (
                <div className="pulse-guide-signal" key={line} style={{ animationDelay: `${index * 120}ms` }}>
                  <span className="pulse-guide-dot" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <div className="pulse-guide-ai-chip">AI helper online</div>
          </div>
        </div>

        <div className="pulse-guide-copy">
          <div className="pulse-guide-kicker">{current.kicker}</div>
          <h2 id="pulse-guide-title">{current.title}</h2>
          <p className="pulse-guide-typed">
            {typedText}
            <span className="pulse-guide-cursor">|</span>
          </p>

          <div className="pulse-guide-dots" aria-label={`Korak ${progress}`}>
            {slides.map((slide, index) => (
              <button
                key={slide.kicker}
                className={index === step ? 'is-active' : ''}
                type="button"
                onClick={() => setStep(index)}
                aria-label={`Idi na korak ${index + 1}`}
              />
            ))}
          </div>

          <div className="pulse-guide-actions">
            <button className="pulse-guide-secondary" type="button" onClick={finish}>
              Preskoči
            </button>
            {step > 0 ? (
              <button className="pulse-guide-secondary" type="button" onClick={back}>
                Nazad
              </button>
            ) : null}
            <button className="pulse-guide-primary" type="button" onClick={next}>
              {step >= slides.length - 1 ? 'Kreni odmah' : 'Dalje'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

export { PULSE_WELCOME_KEY }
export default PulseWelcomeGuide
