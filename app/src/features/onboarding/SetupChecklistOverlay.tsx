import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../auth/authStore'
import { useBillingStore } from '../billing/billingStore'
import { useClientStore } from '../clients/clientStore'
import { useCloudStore } from '../cloud/cloudStore'
import { useDemoStore } from '../demo/demoStore'
import { useProjectStore } from '../projects/projectStore'
import { readProducts } from '../products/productStorage'
import { isTaskCompleted } from '../tasks/taskLifecycle'
import { useTaskStore } from '../tasks/taskStore'
import { readProcessTemplates } from '../templates/templateStorage'

const CHECKLIST_MINIMIZED_KEY = 'pulse.setupChecklist.minimized.v1'
const CHECKLIST_TIPS_KEY = 'pulse.setupChecklist.tips.v1'
const CHECKLIST_DISMISSED_KEY = 'pulse.onboarding.dismissed'

type ChecklistStep = {
  key: string
  title: string
  blurb: string
  cta: string
  complete: boolean
  navigateTo: () => void
}

type RouteTip = {
  key: string
  title: string
  body: string
}

function readBooleanFlag(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return fallback
  }
}

function writeBooleanFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // localStorage is optional.
  }
}

function readSeenTips() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(CHECKLIST_TIPS_KEY) || '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function writeSeenTips(next: Record<string, boolean>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHECKLIST_TIPS_KEY, JSON.stringify(next))
  } catch {
    // localStorage is optional.
  }
}

function SetupChecklistOverlay() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAuthStore()
  const cloud = useCloudStore()
  const demo = useDemoStore()
  const { clients } = useClientStore()
  const { projects } = useProjectStore()
  const { tasks } = useTaskStore()
  const { billing } = useBillingStore()
  const [isMinimized, setIsMinimized] = useState(() =>
    readBooleanFlag(CHECKLIST_MINIMIZED_KEY, false),
  )
  const [isDismissed, setIsDismissed] = useState(() =>
    readBooleanFlag(CHECKLIST_DISMISSED_KEY, false),
  )
  const [seenTips, setSeenTips] = useState<Record<string, boolean>>(() => readSeenTips())
  const [catalogSnapshot, setCatalogSnapshot] = useState(() => ({
    products: readProducts().length,
    templates: readProcessTemplates().length,
  }))

  useEffect(() => {
    writeBooleanFlag(CHECKLIST_MINIMIZED_KEY, isMinimized)
  }, [isMinimized])

  useEffect(() => {
    writeBooleanFlag(CHECKLIST_DISMISSED_KEY, isDismissed)
  }, [isDismissed])

  useEffect(() => {
    writeSeenTips(seenTips)
  }, [seenTips])

  useEffect(() => {
    const syncCatalog = () => {
      setCatalogSnapshot({
        products: readProducts().length,
        templates: readProcessTemplates().length,
      })
    }

    syncCatalog()
    const timer = window.setInterval(syncCatalog, 1200)
    return () => window.clearInterval(timer)
  }, [])

  const isAdmin = currentUser.role === 'admin'
  const activeMembers = useMemo(
    () => cloud.members.filter((member) => member.status !== 'invited'),
    [cloud.members],
  )
  const firstClient = clients[0] || null
  const firstProject = projects.find((project) => project.status !== 'arhiviran') || null
  const firstTask = tasks[0] || null
  const completedTaskWithWorklog = tasks.find(
    (task) =>
      isTaskCompleted(task) &&
      (task.timeSpentMinutes ?? 0) > 0 &&
      ((task.laborCost ?? 0) > 0 ||
        (task.materialCost ?? 0) > 0 ||
        Boolean(task.materialDescription?.trim())),
  )
  const hasBilling = billing.some((record) => record.status !== 'cancelled')

  const shouldShow = Boolean(isAdmin && cloud.user && cloud.activeWorkspace && !demo.isDemoMode)

  const steps = useMemo<ChecklistStep[]>(
    () => [
      {
        key: 'workspace',
        title: 'Kreiraj workspace',
        blurb: 'Workspace je firma u PULSE-u. Tu tim, klijenti i naplata dobijaju isti kontekst.',
        cta: 'Otvori workspace',
        complete: Boolean(cloud.activeWorkspace),
        navigateTo: () => navigate('/workspace?setup=members'),
      },
      {
        key: 'members',
        title: 'Dodaj clanove tima',
        blurb: 'Svaki clan nosi rolu i satnicu, pa PULSE zna ko radi i koliko posao realno kosta.',
        cta: 'Pozovi tim',
        complete: activeMembers.length > 1,
        navigateTo: () => navigate('/workspace?setup=invite'),
      },
      {
        key: 'client',
        title: 'Dodaj prvog klijenta',
        blurb: 'Sve krece iz kartice klijenta. Tamo kasnije nastaju projekti, aktivnosti i naplata.',
        cta: firstClient ? 'Otvori klijenta' : 'Novi klijent',
        complete: clients.length > 0,
        navigateTo: () =>
          navigate(firstClient ? `/clients/${firstClient.id}` : '/clients?setup=create'),
      },
      {
        key: 'process',
        title: 'Kreiraj prvi proces',
        blurb: 'Proces definise standardne korake rada koje PULSE kasnije pretvara u taskove.',
        cta: 'Otvori procese',
        complete: catalogSnapshot.templates > 0,
        navigateTo: () => navigate('/templates?setup=create'),
      },
      {
        key: 'product',
        title: 'Dodaj prvi proizvod/uslugu',
        blurb: 'Proizvod moze automatski da napravi projekat sa svim potrebnim koracima rada.',
        cta: 'Otvori proizvode',
        complete: catalogSnapshot.products > 0,
        navigateTo: () => navigate('/products?setup=create'),
      },
      {
        key: 'project',
        title: 'Kreiraj prvi projekat kroz klijenta',
        blurb: 'Projekat ne nastaje izolovano. Uvek ga otvaraj iz kartice klijenta da komercijala i operativa ostanu povezane.',
        cta: firstClient ? 'Otvori karticu klijenta' : 'Dodaj klijenta',
        complete: projects.length > 0,
        navigateTo: () =>
          navigate(
            firstClient
              ? `/clients/${firstClient.id}?setup=create-project`
              : '/clients?setup=create',
          ),
      },
      {
        key: 'task',
        title: 'Kreiraj task',
        blurb: 'Task moze nastati iz procesa ili kao ad hoc aktivnost. To je razlika izmedju standardnog flow-a i hitnog zahteva.',
        cta: firstProject ? 'Otvori projekat' : 'Otvori klijenta',
        complete: tasks.length > 0,
        navigateTo: () =>
          navigate(
            firstProject
              ? `/projects/${firstProject.id}?setup=create-task`
              : firstClient
                ? `/clients/${firstClient.id}?setup=create-activity`
                : '/clients?setup=create',
          ),
      },
      {
        key: 'finish-task',
        title: 'Zavrsi task sa vremenom i troskom',
        blurb: 'Tek zavrsen task sa unetim vremenom, troskom i materijalom daje realan obracun projekta.',
        cta: firstTask ? 'Otvori task' : 'Kreiraj task',
        complete: Boolean(completedTaskWithWorklog),
        navigateTo: () =>
          navigate(
            firstTask
              ? `/tasks/${firstTask.id}`
              : firstProject
                ? `/projects/${firstProject.id}?setup=create-task`
                : '/projects',
          ),
      },
      {
        key: 'billing',
        title: 'Kreiraj naplatu projekta',
        blurb: 'Zavrseni taskovi ulaze u obracun projekta, a odatle u nalog za naplatu i finansijski pregled.',
        cta: firstProject ? 'Otvori naplatu projekta' : 'Otvori naplatu',
        complete: hasBilling,
        navigateTo: () =>
          navigate(firstProject ? `/projects/${firstProject.id}?setup=create-billing` : '/billing'),
      },
    ],
    [
      activeMembers.length,
      catalogSnapshot.products,
      catalogSnapshot.templates,
      clients.length,
      cloud.activeWorkspace,
      completedTaskWithWorklog,
      firstClient,
      firstProject,
      firstTask,
      hasBilling,
      navigate,
      projects.length,
      tasks.length,
    ],
  )

  const completedCount = steps.filter((step) => step.complete).length
  const currentStep = steps.find((step) => !step.complete) || null
  const allDone = completedCount === steps.length

  const routeTip = useMemo<RouteTip | null>(() => {
    const path = location.pathname
    if (path === '/') {
      return {
        key: 'home-hitno-bitno',
        title: 'HITNO-BITNO',
        body: 'Ovde admin vidi gde tim kasni i gde treba reagovati. Klikni na Potrebna reakcija za pregled po stavkama i follow-up predlog.',
      }
    }
    if (path.startsWith('/workspace')) {
      return {
        key: 'workspace-logic',
        title: 'WORKSPACE I TIM',
        body: 'Ovde postavljas firmu: clanove, role i cenu sata. Bez toga PULSE ne moze da deli odgovornost i racuna realan trosak rada.',
      }
    }
    if (path === '/clients' || path.startsWith('/clients/')) {
      return {
        key: 'clients-logic',
        title: 'KLIJENTI',
        body: 'Klijent je komercijalna ulazna tacka. Iz njegove kartice nastaju projekti, aktivnosti, kataloski poslovi i kasnije naplata.',
      }
    }
    if (path.startsWith('/projects')) {
      return {
        key: 'projects-logic',
        title: 'PROJEKTI',
        body: 'Projekat je operativni kontejner posla. Tu se vidi tok koraka, taskovi, progres i trenutak kada posao postaje spreman za naplatu.',
      }
    }
    if (path.startsWith('/templates')) {
      return {
        key: 'templates-logic',
        title: 'PROCESI',
        body: 'Proces definise standardne korake rada koje PULSE automatski pretvara u taskove kada nastane novi posao.',
      }
    }
    if (path.startsWith('/products')) {
      return {
        key: 'products-logic',
        title: 'PROIZVODI I USLUGE',
        body: 'Proizvod ili usluga mogu automatski da kreiraju projekat sa svim koracima rada, umesto da tim svaki put krece od nule.',
      }
    }
    if (path.startsWith('/billing')) {
      return {
        key: 'billing-logic',
        title: 'NAPLATA',
        body: 'Zavrseni taskovi ulaze u obracun projekta. Ovde se vidi sta je spremno za fakturisanje, sta je poslato i sta kasni sa uplatom.',
      }
    }
    if (path.startsWith('/tasks/')) {
      return {
        key: 'task-logic',
        title: 'TASK',
        body: 'Na tasku se zatvara stvarni rad: vreme, trosak i materijal. Bez toga projekat nema cist operativni i finansijski trag.',
      }
    }
    return null
  }, [location.pathname])

  const shouldShowRouteTip = Boolean(
    routeTip && !seenTips[routeTip.key] && !allDone && !isDismissed && shouldShow,
  )

  if (!shouldShow || allDone || isDismissed || isMinimized) return null

  return (
    <>
      <section className={`pulse-setup-panel ${isMinimized ? 'is-minimized' : ''}`}>
        {isMinimized ? (
          <button
            type="button"
            className="pulse-setup-launcher"
            onClick={() => setIsMinimized(false)}
          >
            <strong>{allDone ? 'PULSE setup gotov' : 'PULSE setup'}</strong>
            <span>
              {completedCount} / {steps.length} zavrseno
            </span>
          </button>
        ) : (
          <>
            <div className="pulse-setup-header">
              <div>
                <span className="pulse-setup-kicker">PULSE setup</span>
                <h3>
                  {completedCount} / {steps.length} zavrseno
                </h3>
                <p>
                  {allDone
                    ? 'Setup je kompletan. Checklist ostaje pri ruci kao podsetnik kako firma radi u PULSE-u.'
                    : 'Kako firma pocinje da radi u PULSE-u.'}
                </p>
              </div>
              <button
                type="button"
                className="pulse-setup-close"
                onClick={() => {
                  setIsDismissed(true)
                  setIsMinimized(false)
                }}
                aria-label="Sakrij setup checklist"
              >
                −
              </button>
            </div>

            <div className="pulse-setup-progress" aria-hidden="true">
              <span style={{ width: `${Math.round((completedCount / steps.length) * 100)}%` }} />
            </div>

            <div className="pulse-setup-list">
              {steps.map((step) => {
                const isCurrent = currentStep?.key === step.key
                return (
                  <article
                    key={step.key}
                    className={`pulse-setup-step${step.complete ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
                  >
                    <div className="pulse-setup-step-copy">
                      <strong>{step.title}</strong>
                      <p>{step.blurb}</p>
                    </div>
                    <div className="pulse-setup-step-actions">
                      <span className={`pulse-setup-status${step.complete ? ' is-done' : ''}`}>
                        {step.complete ? 'Zavrseno' : 'Otvoreno'}
                      </span>
                      {!step.complete ? (
                        <button type="button" onClick={step.navigateTo}>
                          {step.cta}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>

            {currentStep ? (
              <div className="pulse-setup-current-tip">
                <strong>Sledeci korak</strong>
                <p>{currentStep.blurb}</p>
                <button type="button" onClick={currentStep.navigateTo}>
                  {currentStep.cta}
                </button>
              </div>
            ) : (
              <div className="pulse-setup-current-tip">
                <strong>Setup je spreman</strong>
                <p>
                  Firma sada ima osnovni tok rada u PULSE-u: tim, klijente, projekte,
                  taskove i naplatu.
                </p>
                <button type="button" onClick={() => navigate('/')}>
                  Nazad na command center
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {shouldShowRouteTip && routeTip ? (
        <aside className="pulse-setup-tooltip" role="note">
          <div className="pulse-setup-tooltip-head">
            <strong>{routeTip.title}</strong>
            <button
              type="button"
              aria-label="Zatvori objasnjenje"
              onClick={() => setSeenTips((current) => ({ ...current, [routeTip.key]: true }))}
            >
              ×
            </button>
          </div>
          <p>{routeTip.body}</p>
          <button
            type="button"
            className="pulse-setup-tooltip-action"
            onClick={() => setSeenTips((current) => ({ ...current, [routeTip.key]: true }))}
          >
            Razumem
          </button>
        </aside>
      ) : null}
    </>
  )
}

export default SetupChecklistOverlay
