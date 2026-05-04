export type ProcessTemplateStatus = 'active' | 'archived'

export type ProcessTemplateStep = {
  id: string
  title: string
  role: string
  estimatedMinutes: number
  order: number
}

export type ProcessTemplate = {
  id: string
  title: string
  description: string
  projectType: string
  status: ProcessTemplateStatus
  steps: ProcessTemplateStep[]
  createdAt: string
}

export type ProcessTemplateFormValues = {
  title: string
  description: string
  projectType: string
}

export type ProcessTemplateStepFormValues = {
  title: string
  role: string
  estimatedMinutes: string
}
