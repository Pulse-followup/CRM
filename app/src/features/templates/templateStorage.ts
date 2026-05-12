import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { ProcessTemplate, ProcessTemplateStep } from './types'

export const PROCESS_TEMPLATE_STORAGE_KEY = 'pulse.processTemplates.v1'

export const demoProcessTemplates: ProcessTemplate[] = [
  {
    id: 'tpl-demo-social-launch',
    title: 'Social launch flow',
    description: 'Kratak produkcijski tok za lansiranje nove lokacije kroz social i community paket.',
    projectType: 'Digital launch',
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    steps: [
      { id: 'step-demo-brief', title: 'Brief i prioriteti', role: 'ACCOUNT', estimatedMinutes: 45, order: 1 },
      { id: 'step-demo-copy', title: 'Copy i objave', role: 'OPERATIVA', estimatedMinutes: 80, order: 2 },
      { id: 'step-demo-design', title: 'Vizuali i story set', role: 'DIZAJNER', estimatedMinutes: 180, order: 3 },
      { id: 'step-demo-video', title: 'Kratki video edit', role: 'PRODUKCIJA', estimatedMinutes: 120, order: 4 },
      { id: 'step-demo-approval', title: 'Finalna provera', role: 'ACCOUNT', estimatedMinutes: 30, order: 5 },
    ],
  },
  {
    id: 'tpl-demo-opening-kit',
    title: 'Opening promo kit flow',
    description: 'Operativni tok za otvaranje lokacije sa promo videom, POS setom i aktivacijom na terenu.',
    projectType: 'Opening activation',
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    steps: [
      { id: 'step-open-brief', title: 'Kickoff i scope', role: 'ACCOUNT', estimatedMinutes: 40, order: 1 },
      { id: 'step-open-design', title: 'Key visual i adaptacije', role: 'DIZAJNER', estimatedMinutes: 210, order: 2 },
      { id: 'step-open-video', title: 'Promo video finalizacija', role: 'PRODUKCIJA', estimatedMinutes: 160, order: 3 },
      { id: 'step-open-pos', title: 'POS priprema i logistika', role: 'OPERATIVA', estimatedMinutes: 110, order: 4 },
      { id: 'step-open-finance', title: 'Zakljucak i naplata', role: 'FINANCE', estimatedMinutes: 45, order: 5 },
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
  return readStoredArray<ProcessTemplate>(PROCESS_TEMPLATE_STORAGE_KEY, demoProcessTemplates)
}

export function readDemoProcessTemplates() {
  return demoProcessTemplates
}

export function saveProcessTemplates(templates: ProcessTemplate[]) {
  writeStoredValue(PROCESS_TEMPLATE_STORAGE_KEY, templates)
}

export function getProcessTemplateLabel(templateId: string | undefined, templates: ProcessTemplate[]) {
  if (!templateId) return 'Nije povezan sablon'
  return templates.find((template) => template.id === templateId)?.title ?? 'Nepoznat sablon'
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

function templateFromSupabaseRow(row: Record<string, unknown>, fallback?: ProcessTemplate): ProcessTemplate {
  return {
    id: asString(row.id) || fallback?.id || crypto.randomUUID?.() || `tpl-${Date.now()}`,
    title: asString(row.title) || fallback?.title || '',
    projectType: asString(row.type) || fallback?.projectType || '',
    description: asString(row.description) || fallback?.description || '',
    status: row.is_active === false ? 'archived' : fallback?.status || 'active',
    createdAt: asString(row.created_at) || fallback?.createdAt || new Date().toISOString(),
    steps: fallback?.steps || [],
  }
}

async function syncTemplateStepsInSupabase(templateId: string, steps: ProcessTemplateStep[]) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { error: deleteStepsError } = await supabase.from('process_template_steps').delete().eq('template_id', templateId)
  if (deleteStepsError) throw deleteStepsError

  const mappedSteps = steps.map((step, index) => ({
    id: step.id,
    template_id: templateId,
    title: step.title,
    required_role: step.role,
    estimated_minutes: step.estimatedMinutes,
    sort_order: index + 1,
  }))

  if (mappedSteps.length) {
    const { error: stepsError } = await supabase.from('process_template_steps').insert(mappedSteps)
    if (stepsError) throw stepsError
  }
}

export async function upsertProcessTemplateToSupabase(workspaceId: string, template: ProcessTemplate) {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId) return template

  const cloudTemplate = ensureCloudTemplate(template)
  const payload = templateToSupabaseRow(cloudTemplate, workspaceId)

  if (isTemplateUuid(template.id)) {
    const { id: _templateId, ...updatePayload } = payload
    const { data, error } = await supabase
      .from('process_templates')
      .update(updatePayload)
      .eq('id', cloudTemplate.id)
      .eq('workspace_id', workspaceId)
      .select()
      .maybeSingle()

    if (error) throw error

    if (data) {
      await syncTemplateStepsInSupabase(cloudTemplate.id, cloudTemplate.steps)
      return {
        ...templateFromSupabaseRow(data, cloudTemplate),
        steps: cloudTemplate.steps,
      }
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('process_templates')
      .insert(payload)
      .select()
      .single()

    if (insertError) throw insertError

    const insertedTemplate = templateFromSupabaseRow(insertedData, cloudTemplate)
    await syncTemplateStepsInSupabase(insertedTemplate.id, cloudTemplate.steps)
    return {
      ...insertedTemplate,
      steps: cloudTemplate.steps,
    }
  }

  const { id: _localId, ...insertPayload } = payload
  const { data, error } = await supabase
    .from('process_templates')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  const savedTemplate = templateFromSupabaseRow(data, cloudTemplate)
  await syncTemplateStepsInSupabase(savedTemplate.id, cloudTemplate.steps)
  return {
    ...savedTemplate,
    steps: cloudTemplate.steps,
  }
}

export async function deleteProcessTemplateFromSupabase(workspaceId: string, templateId: string) {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId || !templateId) return { deleted: false, skipped: true }

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
