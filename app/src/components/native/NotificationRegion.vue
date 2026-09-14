<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from '@lucide/vue'

import { useNotifications, type NotificationVariant } from '@/composables/useNotifications'

const { notifications, dismiss } = useNotifications()

const icons: Record<NotificationVariant, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
}

const styles: Record<NotificationVariant, string> = {
  success: 'tw:border-emerald-500/30 tw:bg-emerald-500/10 tw:text-emerald-500',
  info: 'tw:border-brand-500/30 tw:bg-brand-500/10 tw:text-brand-500',
  warning: 'tw:border-amber-500/30 tw:bg-amber-500/10 tw:text-amber-500',
  danger: 'tw:border-red-500/30 tw:bg-red-500/10 tw:text-red-500',
}
</script>

<template>
  <div
    class="tw:pointer-events-none tw:fixed tw:inset-x-0 tw:top-4 tw:z-[100] tw:flex tw:flex-col tw:items-center tw:gap-2 tw:px-4 tw:sm:items-end tw:sm:px-6"
    aria-live="polite"
    role="status"
  >
    <div
      v-for="notification in notifications"
      :key="notification.id"
      class="tw:pointer-events-auto tw:flex tw:w-full tw:max-w-sm tw:items-start tw:gap-2 tw:rounded-xl tw:border tw:bg-surface tw:p-3 tw:shadow-lg"
      :class="styles[notification.variant]"
    >
      <component :is="icons[notification.variant]" class="tw:mt-0.5 tw:size-4 tw:shrink-0" aria-hidden="true" />
      <p class="tw:flex-1 tw:text-sm tw:text-foreground">{{ notification.message }}</p>
      <button
        type="button"
        class="tw:shrink-0 tw:rounded tw:p-0.5 tw:text-muted-foreground tw:hover:text-foreground"
        :aria-label="`Dismiss: ${notification.message}`"
        @click="dismiss(notification.id)"
      >
        <X class="tw:size-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
