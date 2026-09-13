<script setup lang="ts">
import { ref } from 'vue'

import { reboot, shutdown } from '@/api/nativePower'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const error = ref('')
const notice = ref('')
const busy = ref('')

// -- reboot -------------------------------------------------------------------

const confirmingReboot = ref(false)

function requestReboot() {
  notice.value = ''
  error.value = ''
  confirmingReboot.value = true
}

async function confirmReboot() {
  confirmingReboot.value = false
  busy.value = 'reboot'
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await reboot()
    notice.value = `Reboot submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to reboot.'
  } finally {
    busy.value = ''
  }
}

// -- shutdown -------------------------------------------------------------------

const confirmingShutdown = ref(false)

function requestShutdown() {
  notice.value = ''
  error.value = ''
  confirmingShutdown.value = true
}

async function confirmShutdown() {
  confirmingShutdown.value = false
  busy.value = 'shutdown'
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await shutdown()
    notice.value = `Shutdown submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to shut down.'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        System
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">Power</h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Reboot or power off this server. Both interrupt every app and service
        running on it — a shutdown requires out-of-band access (console or
        remote power management) to bring the server back up.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

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
          <div
            v-if="confirmingReboot"
            class="tw:flex tw:items-center tw:justify-end tw:gap-2"
          >
            <span class="tw:text-xs tw:text-muted-foreground"
              >Reboot this server now?</span
            >
            <Button
              variant="outline"
              size="sm"
              @click="confirmingReboot = false"
              >Cancel</Button
            >
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmReboot"
              >Confirm</Button
            >
          </div>
          <div v-else class="tw:flex tw:justify-end">
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="requestReboot"
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
          <div
            v-if="confirmingShutdown"
            class="tw:flex tw:items-center tw:justify-end tw:gap-2"
          >
            <span class="tw:text-xs tw:text-muted-foreground"
              >Shut down this server now?</span
            >
            <Button
              variant="outline"
              size="sm"
              @click="confirmingShutdown = false"
              >Cancel</Button
            >
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmShutdown"
              >Confirm</Button
            >
          </div>
          <div v-else class="tw:flex tw:justify-end">
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="requestShutdown"
              >{{
                busy === 'shutdown' ? 'Shutting down…' : 'Shut down'
              }}</Button
            >
          </div>
        </CardContent>
      </Card>
    </template>
  </section>
</template>
