import type { ProjectStage, ProjectStageRole, ProjectTemplateId, ProjectType } from './types'

export interface ProjectTemplateDefinition {
  id: ProjectTemplateId
  label: string
  stages: Array<{
    name: string
    defaultRole?: ProjectStageRole
  }>
}

export const PROJECT_STAGE_ROLE_LABELS: Record<ProjectStageRole, string> = {
  admin: 'admin',
  user: 'user',
  finance: 'finance',
  designer: 'designer',
  production: 'production',
  logistics: 'logistics',
  account: 'account',
}

export const PROJECT_TEMPLATES: Record<ProjectTemplateId, ProjectTemplateDefinition> = {
  kampanja: {
    id: 'kampanja',
    label: 'Kampanja',
    stages: [
      { name: 'Planiranje', defaultRole: 'account' },
      { name: 'Kreiranje sadrzaja', defaultRole: 'designer' },
      { name: 'Distribucija / postavka', defaultRole: 'logistics' },
      { name: 'Pracenje / optimizacija', defaultRole: 'account' },
      { name: 'Naplata', defaultRole: 'finance' },
    ],
  },
  produkcija: {
    id: 'produkcija',
    label: 'Produkcija',
    stages: [
      { name: 'Scope', defaultRole: 'account' },
      { name: 'Dizajn', defaultRole: 'designer' },
      { name: 'Priprema za stampu', defaultRole: 'designer' },
      { name: 'Stampa', defaultRole: 'production' },
      { name: 'Logistika / isporuka', defaultRole: 'logistics' },
      { name: 'Naplata', defaultRole: 'finance' },
    ],
  },
  jednokratni: {
    id: 'jednokratni',
    label: 'Jednokratni',
    stages: [
      { name: 'Dogovor / scope', defaultRole: 'account' },
      { name: 'Realizacija', defaultRole: 'user' },
      { name: 'Zavrsetak / potvrda', defaultRole: 'account' },
      { name: 'Naplata', defaultRole: 'finance' },
    ],
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    stages: [
      { name: 'Lead', defaultRole: 'account' },
      { name: 'Sastanak', defaultRole: 'account' },
      { name: 'Ponuda', defaultRole: 'account' },
      { name: 'Pregovori', defaultRole: 'account' },
      { name: 'Dobijen / Izgubljen', defaultRole: 'account' },
    ],
  },
  odrzavanje: {
    id: 'odrzavanje',
    label: 'Odrzavanje',
    stages: [
      { name: 'Prijava problema', defaultRole: 'account' },
      { name: 'Dijagnostika', defaultRole: 'user' },
      { name: 'Resenje', defaultRole: 'user' },
      { name: 'Zatvaranje', defaultRole: 'account' },
      { name: 'Naplata opciono', defaultRole: 'finance' },
    ],
  },
}

const PROJECT_TYPE_TEMPLATE_MAP: Partial<Record<ProjectType, ProjectTemplateId>> = {
  kampanja: 'kampanja',
  postavka: 'produkcija',
  usluga: 'jednokratni',
  odrzavanje: 'odrzavanje',
  drugo: 'jednokratni',
}

export function getTemplateIdForProjectType(type?: ProjectType | '') {
  if (!type) {
    return undefined
  }

  return PROJECT_TYPE_TEMPLATE_MAP[type]
}

export function buildStagesFromTemplate(templateId?: ProjectTemplateId) {
  if (!templateId) {
    return undefined
  }

  const template = PROJECT_TEMPLATES[templateId]

  if (!template) {
    return undefined
  }

  const stages: ProjectStage[] = template.stages.map((stage, index) => ({
    id: `${templateId}-stage-${index + 1}`,
    name: stage.name,
    order: index + 1,
    status: index === 0 ? 'active' : 'locked',
    defaultRole: stage.defaultRole,
  }))

  return stages
}