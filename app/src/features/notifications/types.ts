export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'invoice_overdue'

export interface AppNotification {
  id: string
  workspaceId?: string | null
  recipientUserId: string
  type: NotificationType
  title: string
  body: string
  entityType: 'task' | 'billing'
  entityId: string
  readAt?: string | null
  createdAt: string
}

export interface CreateNotificationInput {
  recipientUserId: string
  type: NotificationType
  title: string
  body: string
  entityType: 'task' | 'billing'
  entityId: string
}

export interface NotificationToast {
  id: string
  notificationId: string
  title: string
  body: string
}
