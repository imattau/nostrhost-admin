import { reactive } from 'vue'

export type NotificationVariant = 'success' | 'info' | 'warning' | 'danger'

export type Notification = {
  id: number
  variant: NotificationVariant
  message: string
  // Danger/warning notices stay until dismissed; success/info auto-dismiss.
  timeout: number | null
}

let nextId = 1
const notifications = reactive<Notification[]>([])

const DEFAULT_TIMEOUT: Record<NotificationVariant, number | null> = {
  success: 5000,
  info: 6000,
  warning: null,
  danger: null,
}

function dismiss(id: number) {
  const index = notifications.findIndex((n) => n.id === id)
  if (index !== -1) notifications.splice(index, 1)
}

function notify(
  variant: NotificationVariant,
  message: string,
  options: { timeout?: number | null } = {},
) {
  const id = nextId++
  const timeout = options.timeout !== undefined ? options.timeout : DEFAULT_TIMEOUT[variant]
  notifications.push({ id, variant, message, timeout })
  if (timeout !== null) {
    setTimeout(() => dismiss(id), timeout)
  }
  return id
}

// Shared, app-wide notification queue: replaces the per-page `notice`/`error`
// refs (one message at a time, silently overwritten, no aria-live) with a
// stack every action can push onto without knowing about any other screen.
export function useNotifications() {
  return {
    notifications,
    dismiss,
    success: (message: string, options?: { timeout?: number | null }) =>
      notify('success', message, options),
    info: (message: string, options?: { timeout?: number | null }) =>
      notify('info', message, options),
    warning: (message: string, options?: { timeout?: number | null }) =>
      notify('warning', message, options),
    danger: (message: string, options?: { timeout?: number | null }) =>
      notify('danger', message, options),
    // For an OperationError: pending-approval reads as info, everything else
    // (rejected/failed) reads as an error that needs acknowledging.
    fromOperationError: (cause: unknown, fallback: string) => {
      const message = cause instanceof Error ? cause.message : fallback
      const pending =
        typeof cause === 'object' && cause !== null && 'pending_approval' in cause
          ? Boolean((cause as { pending_approval?: boolean }).pending_approval)
          : false
      return pending ? notify('info', message) : notify('danger', message)
    },
  }
}
