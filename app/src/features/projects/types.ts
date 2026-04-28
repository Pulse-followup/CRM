export interface Project {
  id: string
  clientId: string
  title: string
  status: 'aktivan' | 'arhiviran' | 'zavrsen'
  type?: string
  frequency?: string
  value?: number
  billingStatus?: string
}
