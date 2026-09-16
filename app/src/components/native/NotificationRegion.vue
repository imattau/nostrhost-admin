<script setup lang="ts">
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from '@lucide/vue'

import {
  useNotifications,
  type NotificationVariant,
} from '@/composables/useNotifications'

const { notifications, dismiss } = useNotifications()

const icons: Record<NotificationVariant, typeof Info> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
}

const styles: Record<NotificationVariant, string> = {
  success: 'tw:border-healthy tw:text-healthy',
  info: 'tw:border-signature tw:text-signature',
  warning: 'tw:border-caution tw:text-caution',
  danger: 'tw:border-destructive tw:text-destructive',
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
      class="tw:pointer-events-auto tw:flex tw:w-full tw:max-w-sm tw:items-start tw:gap-2 tw:rounded-[3px] tw:border-l-4 tw:bg-workbench tw:p-3 tw:shadow-lg"
      :class="styles[notification.variant]"
    >
      <component
        :is="icons[notification.variant]"
        class="tw:mt-0.5 tw:size-4 tw:shrink-0"
        aria-hidden="true"
      />
      <p class="tw:flex-1 tw:text-sm tw:text-foreground">
        {{ notification.message }}
      </p>
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
