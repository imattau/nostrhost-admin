<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  controlService,
  getServiceStatus,
  type ServiceAction,
  type ServiceStatusMap,
} from '@/api/nativeService'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const services = ref<ServiceStatusMap | null>(null)
const error = ref('')
const loading = ref(false)

const pendingAction = ref<{ name: string; action: ServiceAction } | null>(null)
const confirming = ref<{ name: string; action: ServiceAction } | null>(null)
const actionError = ref('')

const serviceNames = computed(() =>
  services.value ? Object.keys(services.value).sort() : [],
)

const CONFIRM_ACTIONS: ServiceAction[] = ['stop', 'restart']

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    services.value = await getServiceStatus()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load service status.'
  } finally {
    loading.value = false
  }
}

function requestAction(name: string, action: ServiceAction) {
  actionError.value = ''
  if (CONFIRM_ACTIONS.includes(action)) {
    confirming.value = { name, action }
  } else {
    runAction(name, action)
  }
}

function cancelAction() {
  confirming.value = null
}

async function runAction(name: string, action: ServiceAction) {
  pendingAction.value = { name, action }
  confirming.value = null
  actionError.value = ''
  try {
    await sync()
    await controlService(name, action)
    await load()
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : `Failed to ${action} ${name}.`
  } finally {
    pendingAction.value = null
  }
}

function isPending(name: string, action: ServiceAction) {
  return (
    pendingAction.value?.name === name && pendingAction.value?.action === action
  )
}

function statusVariant(status: string) {
  if (status === 'running') return 'success'
  if (status === 'dead' || status === 'failed') return 'danger'
  if (status === 'unknown') return 'neutral'
  return 'warning'
}

function bootVariant(startOnBoot: string) {
  return startOnBoot === 'enabled' ? 'brand' : 'neutral'
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        System services
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Service control
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Start, stop, or restart a managed system service. Stopping or restarting
        a service is disruptive and asks for confirmation first — it can
        interrupt the service you're using right now.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="actionError" variant="danger" role="alert">{{
      actionError
    }}</Alert>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>{{ serviceNames.length }} managed service(s)</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="load"
            >{{ loading ? 'Refreshing…' : 'Refresh' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul v-if="serviceNames.length" class="tw:grid tw:gap-2">
          <li
            v-for="name in serviceNames"
            :key="name"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <code class="tw:font-mono tw:text-sm tw:text-foreground">{{
                name
              }}</code>
              <div class="tw:flex tw:gap-2">
                <Badge :variant="statusVariant(services![name].status)">{{
                  services![name].status
                }}</Badge>
                <Badge :variant="bootVariant(services![name].start_on_boot)"
                  >boot: {{ services![name].start_on_boot }}</Badge
                >
              </div>
            </div>
            <p
              v-if="services![name].description"
              class="tw:text-xs tw:text-muted-foreground"
            >
              {{ services![name].description }}
            </p>

            <template v-if="confirming?.name === name">
              <div class="tw:flex tw:items-center tw:justify-end tw:gap-2">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >{{ confirming.action === 'stop' ? 'Stop' : 'Restart' }}
                  {{ name }}?</span
                >
                <Button variant="outline" size="sm" @click="cancelAction"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="isPending(name, confirming.action)"
                  @click="runAction(name, confirming.action)"
                  >{{
                    isPending(name, confirming.action)
                      ? 'Working…'
                      : `Confirm ${confirming.action}`
                  }}</Button
                >
              </div>
            </template>
            <div v-else class="tw:flex tw:justify-end tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="!!pendingAction"
                @click="requestAction(name, 'start')"
                >{{ isPending(name, 'start') ? 'Starting…' : 'Start' }}</Button
              >
              <Button
                variant="outline"
                size="sm"
                :disabled="!!pendingAction"
                @click="requestAction(name, 'restart')"
                >Restart</Button
              >
              <Button
                variant="danger"
                size="sm"
                :disabled="!!pendingAction"
                @click="requestAction(name, 'stop')"
                >Stop</Button
              >
            </div>
          </li>
        </ul>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Loading…' : 'No services reported.' }}
        </p>
      </CardContent>
    </Card>
  </section>
</template>
