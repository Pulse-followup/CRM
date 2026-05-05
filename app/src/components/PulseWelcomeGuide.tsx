import { useEffect, useMemo, useRef, useState } from 'react'
import { useCloudStore } from '../features/cloud/cloudStore'

const PULSE_WELCOME_KEY = 'pulse.welcomeGuide.seen.v1'
const PULSE_ONBOARDING_KEY = 'pulse.onboarding.completed.v1'

type PulseWelcomeGuideProps = {
  isOpen: boolean
  onClose: () => void
}

type PendingOnboarding = {
  name: string
  workspaceName: string
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

const onboardingVisual = {
  visualTitle: 'SETUP',
  visualLines: ['Ime', 'Login', 'Workspace', 'Start'],
}

const inviteVisual = {
  visualTitle: 'INVITE',
  visualLines: ['Poziv', 'Login', 'Rola', 'Start'],
}

function hasOnboardingCompleted() {
  if (typeof window === 'undefined') return true

  try {
    return window.localStorage.getItem(PULSE_ONBOARDING_KEY) === 'done'
  } catch {
    return true
  }
}

function markOnboardingCompleted() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(PULSE_ONBOARDING_KEY, 'done')
    window.localStorage.setItem(PULSE_WELCOME_KEY, 'seen')
  } catch {
    // localStorage is optional.
  }
}

function PulseWelcomeGuide({ isOpen, onClose }: PulseWelcomeGuideProps) {
  const cloud = useCloudStore()
  const [step, setStep] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingOnboarding, setPendingOnboarding] = useState<PendingOnboarding | null>(null)
  const [pendingInviteAccept, setPendingInviteAccept] = useState(false)
  const createdWorkspaceRef = useRef(false)
  const acceptedInviteRef = useRef(false)
  const current = slides[step]

  const shouldUseInviteOnboarding =
    isOpen &&
    cloud.isConfigured &&
    Boolean(cloud.rememberedInviteId) &&
    !cloud.activeWorkspace

  const shouldUseOnboarding =
    isOpen &&
    cloud.isConfigured &&
    !cloud.activeWorkspace &&
    !cloud.rememberedInviteId &&
    !hasOnboardingCompleted()

  const progress = useMemo(() => `${step + 1}/${slides.length}`, [step])

  useEffect(() => {
    if (!isOpen || shouldUseOnboarding || shouldUseInviteOnboarding) return

    setTypedText('')
    let index = 0
    const text = current.body
    const timer = window.setInterval(() => {
      index += 1
      setTypedText(text.slice(0, index))
      if (index >= text.length) window.clearInterval(timer)
    }, 16)

    return () => window.clearInterval(timer)
  }, [current.body, isOpen, shouldUseInviteOnboarding, shouldUseOnboarding])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (shouldUseOnboarding || shouldUseInviteOnboarding) return
      if (event.key === 'ArrowRight') setStep((value) => Math.min(value + 1, slides.length - 1))
      if (event.key === 'ArrowLeft') setStep((value) => Math.max(value - 1, 0))
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose, shouldUseInviteOnboarding, shouldUseOnboarding])

  useEffect(() => {
    if (!pendingOnboarding || !cloud.user || createdWorkspaceRef.current) return

    createdWorkspaceRef.current = true
    setIsSubmitting(true)
    setMessage('Kreiram tvoj workspace...')

    const setup = pendingOnboarding

    async function finishWorkspaceSetup() {
      try {
        await cloud.updateProfileName(setup.name)
        await cloud.createWorkspace({ name: setup.workspaceName })
        markOnboardingCompleted()
        setMessage('Workspace je spreman. Ulazimo u aplikaciju.')
        window.setTimeout(() => onClose(), 700)
      } catch (error) {
        createdWorkspaceRef.current = false
        setMessage(error instanceof Error ? error.message : 'Workspace nije kreiran.')
      } finally {
        setIsSubmitting(false)
      }
    }

    void finishWorkspaceSetup()
  }, [cloud, cloud.user, onClose, pendingOnboarding])

  useEffect(() => {
    if (!pendingInviteAccept || !cloud.user || acceptedInviteRef.current) return

    acceptedInviteRef.current = true
    setIsSubmitting(true)
    setMessage('Prihvatam poziv u workspace...')

    async function finishInviteAccept() {
      try {
        if (name.trim()) await cloud.updateProfileName(name.trim())
        await cloud.acceptInvite()
        markOnboardingCompleted()
        setMessage('Poziv je prihvaćen. Otvaram tvoj početni ekran.')
        window.setTimeout(() => onClose(), 700)
      } catch (error) {
        acceptedInviteRef.current = false
        setPendingInviteAccept(false)
        setMessage(error instanceof Error ? error.message : 'Poziv nije prihvaćen.')
      } finally {
        setIsSubmitting(false)
      }
    }

    void finishInviteAccept()
  }, [cloud, cloud.user, name, onClose, pendingInviteAccept])

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

  const submitOnboarding = async () => {
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()
    const cleanWorkspaceName = workspaceName.trim()

    setMessage('')

    if (!cleanName || !cleanEmail || !cleanPassword || !cleanWorkspaceName) {
      setMessage('Popuni ime, email, lozinku i naziv workspace-a.')
      return
    }

    if (cleanPassword.length < 6) {
      setMessage('Lozinka mora imati najmanje 6 karaktera.')
      return
    }

    setIsSubmitting(true)
    setPendingOnboarding({ name: cleanName, workspaceName: cleanWorkspaceName })

    try {
      if (!cloud.user) {
        setMessage('Kreiram nalog...')
        await cloud.signUp({ email: cleanEmail, password: cleanPassword })

        try {
          await cloud.signIn({ email: cleanEmail, password: cleanPassword })
        } catch {
          setMessage('Nalog je kreiran. Ako Supabase traži potvrdu emaila, potvrdi email pa se uloguj istim podacima.')
          return
        }
      } else {
        await cloud.updateProfileName(cleanName)
        await cloud.createWorkspace({ name: cleanWorkspaceName })
        markOnboardingCompleted()
        setMessage('Workspace je spreman. Ulazimo u aplikaciju.')
        window.setTimeout(() => onClose(), 700)
      }
    } catch (error) {
      setPendingOnboarding(null)
      setMessage(error instanceof Error ? error.message : 'Onboarding nije uspeo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitInvite = async () => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()

    setMessage('')

    if (!cloud.user && (!cleanEmail || !cleanPassword)) {
      setMessage('Unesi email i lozinku sa kojima prihvataš poziv.')
      return
    }

    if (!cloud.user && cleanPassword.length < 6) {
      setMessage('Lozinka mora imati najmanje 6 karaktera.')
      return
    }

    setIsSubmitting(true)
    setPendingInviteAccept(true)

    try {
      if (!cloud.user) {
        setMessage('Prijavljujem korisnika...')
        try {
          await cloud.signIn({ email: cleanEmail, password: cleanPassword })
        } catch {
          setMessage('Kreiram nalog iz poziva...')
          await cloud.signUp({ email: cleanEmail, password: cleanPassword })
          await cloud.signIn({ email: cleanEmail, password: cleanPassword })
        }
      } else {
        if (name.trim()) await cloud.updateProfileName(name.trim())
        await cloud.acceptInvite()
        markOnboardingCompleted()
        setMessage('Poziv je prihvaćen. Otvaram tvoj početni ekran.')
        window.setTimeout(() => onClose(), 700)
      }
    } catch (error) {
      setPendingInviteAccept(false)
      setMessage(error instanceof Error ? error.message : 'Poziv nije prihvaćen.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const visualTitle = shouldUseInviteOnboarding
    ? inviteVisual.visualTitle
    : shouldUseOnboarding
      ? onboardingVisual.visualTitle
      : current.visualTitle
  const visualLines = shouldUseInviteOnboarding
    ? inviteVisual.visualLines
    : shouldUseOnboarding
      ? onboardingVisual.visualLines
      : current.visualLines

  return (
    <div className="pulse-guide" role="dialog" aria-modal="true" aria-labelledby="pulse-guide-title">
      <div className="pulse-guide-bg pulse-guide-bg-one" />
      <div className="pulse-guide-bg pulse-guide-bg-two" />

      <section className="pulse-guide-shell">
        <button className="pulse-guide-close" type="button" onClick={shouldUseOnboarding || shouldUseInviteOnboarding ? onClose : finish} aria-label="Zatvori vodič">
          ×
        </button>

        <div className="pulse-guide-hero" aria-hidden="true">
          <div className="pulse-guide-orbit" />
          <div className="pulse-guide-device">
            <div className="pulse-guide-device-top">
              <span />
              <strong>{visualTitle}</strong>
            </div>
            <div className="pulse-guide-signal-grid">
              {visualLines.map((line, index) => (
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
          {shouldUseInviteOnboarding ? (
            <>
              <div className="pulse-guide-kicker">WORKSPACE INVITE</div>
              <h2 id="pulse-guide-title">Prihvati poziv u PULSE</h2>
              <p className="pulse-guide-typed pulse-guide-onboarding-lead">
                Ovaj link te povezuje sa postojećim workspace-om. Ne kreira se nova firma i ne dobijaš automatski admin rolu.
              </p>

              {!cloud.user ? (
                <div className="pulse-onboarding-form">
                  <label>
                    <span>Ime</span>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="npr. Jelena" />
                  </label>
                  <label>
                    <span>Email iz poziva</span>
                    <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ime@firma.rs" />
                  </label>
                  <label>
                    <span>Lozinka</span>
                    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="minimum 6 karaktera" />
                  </label>
                </div>
              ) : (
                <div className="pulse-onboarding-hints">
                  <span>Ulogovan</span>
                  <span>Poziv pronađen</span>
                  <span>Rola iz workspace-a</span>
                </div>
              )}

              {message ? <p className="pulse-onboarding-message">{message}</p> : null}

              <div className="pulse-guide-actions">
                <button className="pulse-guide-secondary" type="button" onClick={onClose} disabled={isSubmitting}>
                  Kasnije
                </button>
                <button className="pulse-guide-primary" type="button" onClick={() => void submitInvite()} disabled={isSubmitting}>
                  {isSubmitting ? 'Povezujem...' : cloud.user ? 'Prihvati poziv' : 'Uđi i prihvati poziv'}
                </button>
              </div>
            </>
          ) : shouldUseOnboarding ? (
            <>
              <div className="pulse-guide-kicker">SMART ONBOARDING</div>
              <h2 id="pulse-guide-title">Dobrodošao u PULSE</h2>
              <p className="pulse-guide-typed pulse-guide-onboarding-lead">
                Postavi svoj nalog i workspace. Posle toga PULSE otvara pravi početni ekran za tvoju ulogu.
              </p>

              <div className="pulse-onboarding-form">
                <label>
                  <span>Ime</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="npr. Dragan" />
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ime@firma.rs" />
                </label>
                <label>
                  <span>Lozinka</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="minimum 6 karaktera" />
                </label>
                <label>
                  <span>Naziv workspace-a</span>
                  <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="npr. Retail Media Center" />
                </label>
              </div>

              <div className="pulse-onboarding-hints">
                <span>Klijenti</span>
                <span>Projekti</span>
                <span>Tim</span>
                <span>Naplata</span>
              </div>

              {message ? <p className="pulse-onboarding-message">{message}</p> : null}

              <div className="pulse-guide-actions">
                <button className="pulse-guide-secondary" type="button" onClick={onClose} disabled={isSubmitting}>
                  Kasnije
                </button>
                <button className="pulse-guide-primary" type="button" onClick={() => void submitOnboarding()} disabled={isSubmitting}>
                  {isSubmitting ? 'Kreiram...' : 'Kreiraj workspace'}
                </button>
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export { PULSE_WELCOME_KEY, PULSE_ONBOARDING_KEY }
export default PulseWelcomeGuide
