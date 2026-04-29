export type ProjectStatus = 'aktivan' | 'arhiviran' | 'zavrsen'

export type ProjectType = 'kampanja' | 'usluga' | 'postavka' | 'odrzavanje' | 'drugo'

export type ProjectFrequency =
  | 'jednokratno'
  | 'mesecno'
  | 'kvartalno'
  | 'godisnje'
  | 'po_potrebi'

export interface Project {
  id: string
  clientId: string
  title: string
  status: ProjectStatus
  type?: ProjectType
  frequency?: ProjectFrequency
  value?: number
  billingStatus?: string
}
