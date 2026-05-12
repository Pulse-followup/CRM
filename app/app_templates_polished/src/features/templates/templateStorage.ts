import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { ProcessTemplate, ProcessTemplateStep } from './types'

export const PROCESS_TEMPLATE_STORAGE_KEY = 'pulse.processTemplates.v1'

const defaultTemplates: ProcessTemplate[] = [
  {
    id: 'tpl-digitalna-stampa-standard',
    title: 'Digitalna štampa — standard',
    description: 'Osnovni proces za manje poslove digitalne štampe i pripreme.',
    projectType: 'Digitalna štampa',
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    steps: [
      { id: 'step-brief', title: 'Prijem briefa', role: 'Admin', estimatedMinutes: 15, order: 1 },
      { id: 'step-prepress', title: 'Priprema fajla / prepress', role: 'Dizajner', estimatedMinutes: 45, order: 2 },
      { id: 'step-print', title: 'Štampa', role: 'Produkcija', estimatedMinutes: 60, order: 3 },
      { id: 'step-pack', title: 'Pakovanje', role: 'Produkcija', estimatedMinutes: 30, order: 4 },
      { id: 'step-delivery', title: 'Dostava / preuzimanje', role: 'Logistika', estimatedMinutes: 30, order: 5 },
    ],
  },
  {
    id: 'tpl-posm-standard',
    title: 'POSM izrada — standard',
    description: 'Proces za POSM elemente, brendiranje i postavku na prodajnom mestu.',
    projectType: 'POSM / Branding',
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    steps: [
      { id: 'step-posm-brief', title: 'Prijem zahteva i specifikacije', role: 'Admin', estimatedMinutes: 20, order: 1 },
      { id: 'step-posm-design', title: 'Dizajn / adaptacija', role: 'Dizajner', estimatedMinutes: 90, order: 2 },
      { id: 'step-posm-approval', title: 'Interna provera i odobrenje', role: 'Admin', estimatedMinutes: 20, order: 3 },
      { id: 'step-posm-production', title: 'Izrada / produkcija', role: 'Produkcija', estimatedMinutes: 120, order: 4 },
      { id: 'step-posm-install', title: 'Isporuka / montaža', role: 'Logistika', estimatedMinutes: 60, order: 5 },
    ],
  },
]

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asNumber(value: unknown) {
  const next = Number(value ?? 0)
  return Number.isFinite(next) ? next : 0
}

export function isTemplateUuid(value: string | undefined) {
  const cleanValue = value || ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanValue)
}

function createCloudUuid() {
  return crypto.randomUUID?.() || `tpl-${Date.now()}`
}

function ensureCloudTemplate(template: ProcessTemplate): ProcessTemplate {
  if (isTemplateUuid(template.id)) {
    return {
      ...template,
      steps: template.steps.map((step) => ({
        ...step,
        id: isTemplateUuid(step.id) ? step.id : createCloudUuid(),
      })),
    }
  }

  return {
    ...template,
    id: createCloudUuid(),
    createdAt: new Date().toISOString(),
    steps: template.steps.map((step, index) => ({
      ...step,
      id: isTemplateUuid(step.id) ? step.id : createCloudUuid(),
      order: index + 1,
    })),
  }
}

export function readProcessTemplates() {
  return readStoredArray<ProcessTemplate>(PROCESS_TEMPLATE_STORAGE_KEY, defaultTemplates)
}

export function saveProcessTemplates(templates: ProcessTemplate[]) {
  writeStoredValue(PROCESS_TEMPLATE_STORAGE_KEY, templates)
}

export function getProcessTemplateLabel(templateId: string | undefined, templates: ProcessTemplate[]) {
  if (!templateId) return 'Nije povezan šablon'
  return templates.find((template) => template.id === templateId)?.title ?? 'Nepoznat šablon'
}

export async function readProcessTemplatesFromSupabase(workspaceId: string): Promise<ProcessTemplate[]> {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId) return []

  const { data: templateRows, error: templateError } = await supabase
    .from('process_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (templateError) throw templateError

  const templates = Array.isArray(templateRows) ? templateRows : []
  const templateIds = templates.map((row) => asString(row.id)).filter(Boolean)
  let stepsByTemplateId = new Map<string, ProcessTemplateStep[]>()

  if (templateIds.length) {
    const { data: stepRows, error: stepError } = await supabase
      .from('process_template_steps')
      .select('*')
      .in('template_id', templateIds)
      .order('sort_order', { ascending: true })

    if (stepError) throw stepError

    stepsByTemplateId = (stepRows || []).reduce((map, row) => {
      const templateId = asString(row.template_id)
      if (!templateId) return map
      const current = map.get(templateId) || []
      map.set(templateId, [
        ...current,
        {
          id: asString(row.id),
          title: asString(row.title),
          role: asString(row.required_role),
          estimatedMinutes: asNumber(row.estimated_minutes),
          order: asNumber(row.sort_order),
        },
      ])
      return map
    }, new Map<string, ProcessTemplateStep[]>())
  }

  return templates.map((row) => {
    const id = asString(row.id)
    const steps = stepsByTemplateId.get(id) || []

    return {
      id,
      title: asString(row.title),
      projectType: asString(row.type),
      description: asString(row.description),
      status: row.is_active === false ? 'archived' : 'active',
      createdAt: asString(row.created_at) || new Date().toISOString(),
      steps: steps.sort((a, b) => a.order - b.order),
    }
  })
}

function templateToSupabaseRow(template: ProcessTemplate, workspaceId: string) {
  return {
    id: template.id,
    workspace_id: workspaceId,
    title: template.title,
    type: template.projectType || null,
    description: template.description || null,
    is_active: template.status !== 'archived',
    updated_at: new Date().toISOString(),
  }
}

export async function upsertProcessTemplateToSupabase(workspaceId: string, template: ProcessTemplate) {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId) return template

  const cloudTemplate = ensureCloudTemplate(template)

  const { error } = await supabase
    .from('process_templates')
    .upsert(templateToSupabaseRow(cloudTemplate, workspaceId), { onConflict: 'id' })

  if (error) throw error

  const { error: deleteStepsError } = await supabase.from('process_template_steps').delete().eq('template_id', cloudTemplate.id)
  if (deleteStepsError) throw deleteStepsError

  const steps = cloudTemplate.steps.map((step, index) => ({
    id: step.id,
    template_id: cloudTemplate.id,
    title: step.title,
    required_role: step.role,
    estimated_minutes: step.estimatedMinutes,
    sort_order: index + 1,
  }))

  if (steps.length) {
    const { error: stepsError } = await supabase.from('process_template_steps').insert(steps)
    if (stepsError) throw stepsError
  }

  return cloudTemplate
}

export async function deleteProcessTemplateFromSupabase(workspaceId: string, templateId: string) {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId || !templateId) return { deleted: false, skipped: true }

  // Process template table uses UUID primary keys. Local/dev fallback templates can
  // still have legacy slug ids such as "tpl-posm-standard". Do not send those
  // to Supabase because PostgREST returns 400 for invalid uuid filters.
  if (!isTemplateUuid(templateId)) {
    return { deleted: false, skipped: true }
  }

  const { error: stepsError } = await supabase
    .from('process_template_steps')
    .delete()
    .eq('template_id', templateId)

  if (stepsError) throw stepsError

  const { data, error } = await supabase
    .from('process_templates')
    .delete()
    .eq('id', templateId)
    .eq('workspace_id', workspaceId)
    .select('id')

  if (error) throw error

  return { deleted: Array.isArray(data) && data.length > 0, skipped: false }
}
