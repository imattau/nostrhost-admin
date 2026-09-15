<script setup lang="ts">
import { ref } from 'vue'

import { reboot, shutdown } from '@/api/nativePower'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'
import { useNotifications } from '@/composables/useNotifications'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()
const notifications = useNotifications()

const busy = ref('')
const { run } = useActionRunner(busy, '')

// -- reboot: disruptive but reversible — the server comes back on its own. --

const { pending: confirmingReboot } = useConfirm(false)

async function confirmReboot() {
  confirmingReboot.value = false
  await run(
    'reboot',
    async () => {
      await sync()
      const result = await reboot()
      notifications.success(
        `Reboot submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
    },
    (cause) => notifications.fromOperationError(cause, 'Failed to reboot.'),
  )
}

// -- shutdown: destructive — needs out-of-band access to bring back up. ----

const { pending: confirmingShutdown } = useConfirm(false)

async function confirmShutdown() {
  confirmingShutdown.value = false
  await run(
    'shutdown',
    async () => {
      await sync()
      const result = await shutdown()
      notifications.success(
        `Shutdown submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
    },
    (cause) => notifications.fromOperationError(cause, 'Failed to shut down.'),
  )
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System"
      title="Power"
      description="Reboot or power off this server. Both interrupt every app and service running on it — a shutdown requires out-of-band access (console or remote power management) to bring the server back up."
    />

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle>Reboot</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
            Restarts the server. It comes back up on its own once the boot
            sequence completes.
          </p>
          <div class="tw:flex tw:justify-end">
            <Button
              variant="warning"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmingReboot = true"
              >{{ busy === 'reboot' ? 'Rebooting…' : 'Reboot' }}</Button
            >
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shut down</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
            Powers off the server. It will not come back up until it is manually
            powered on again.
          </p>
          <div class="tw:flex tw:justify-end">
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmingShutdown = true"
              >{{
                busy === 'shutdown' ? 'Shutting down…' : 'Shut down'
              }}</Button
            >
          </div>
        </CardContent>
      </Card>
    </template>

    <ConfirmDialog
      :open="confirmingReboot"
      tier="disruptive"
      title="Reboot this server?"
      description="Every app and service is interrupted until the boot sequence completes."
      confirm-label="Reboot"
      :busy="busy === 'reboot'"
      @confirm="confirmReboot"
      @cancel="confirmingReboot = false"
    />
    <ConfirmDialog
      :open="confirmingShutdown"
      tier="destructive"
      title="Shut down this server?"
      description="It will not come back up until it is manually powered on again — out-of-band access (console or remote power management) is required."
      confirm-label="Shut down"
      confirm-phrase="shutdown"
      :busy="busy === 'shutdown'"
      @confirm="confirmShutdown"
      @cancel="confirmingShutdown = false"
    />
  </PageLayout>
</template>
