<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ChevronDown } from '@lucide/vue'

import {
  controlService,
  getServiceStatus,
  type ServiceAction,
  type ServiceStatusMap,
} from '@/api/nativeService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const services = ref<ServiceStatusMap | null>(null)
const route = useRoute()
const router = useRouter()

const pendingAction = ref<{ name: string; action: ServiceAction } | null>(null)
const { run } = useActionRunner(pendingAction, null)
const {
  pending: confirming,
  request: requestConfirming,
  cancel: cancelAction,
} = useConfirm<{ name: string; action: ServiceAction } | null>(null)
const expanded = ref<string | null>(null)

async function toggleExpanded(name: string) {
  expanded.value = expanded.value === name ? null : name
  await router.replace({
    query: { ...route.query, service: expanded.value || undefined },
  })
}

watch(
  () => route.query.service,
  (service) => {
    if (typeof service === 'string' && service !== expanded.value)
      expanded.value = service
  },
  { immediate: true },
)

const serviceNames = computed(() =>
  services.value ? Object.keys(services.value).sort() : [],
)

const CONFIRM_ACTIONS: ServiceAction[] = ['stop', 'restart']

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  services.value = await getServiceStatus()
}, 'Failed to load service status.')

function requestAction(name: string, action: ServiceAction) {
  if (CONFIRM_ACTIONS.includes(action)) {
    requestConfirming({ name, action })
  } else {
    runAction(name, action)
  }
}

async function runAction(name: string, action: ServiceAction) {
  await run(
    { name, action },
    async () => {
      confirming.value = null
      await sync()
      await controlService(name, action)
      await load()
    },
    `Failed to ${action} ${name}.`,
  )
}

function isPending(name: string, action: ServiceAction) {
  return (
    pendingAction.value?.name === name && pendingAction.value?.action === action
  )
}

function isRunning(status: string) {
  return status === 'running'
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
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System services"
      title="Service control"
      description="Start, stop, or restart a managed system service. Stopping or restarting a service is disruptive and asks for confirmation first — it can interrupt the service you're using right now."
    />

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
            class="tw:grid tw:gap-2 tw:border-b tw:border-border-subtle tw:py-3 last:tw:border-b-0"
          >
            <button
              type="button"
              class="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:[font:inherit]"
              :aria-expanded="expanded === name"
              @click="toggleExpanded(name)"
            >
              <span class="tw:flex tw:items-center tw:gap-2">
                <ChevronDown
                  class="tw:size-4 tw:shrink-0 tw:text-muted-foreground tw:transition-transform"
                  :class="{ 'tw:-rotate-90': expanded !== name }"
                />
                <code class="tw:font-mono tw:text-sm tw:text-foreground">{{
                  name
                }}</code>
              </span>
              <span class="tw:flex tw:gap-2">
                <Badge :variant="statusVariant(services![name].status)">{{
                  services![name].status
                }}</Badge>
                <Badge :variant="bootVariant(services![name].start_on_boot)"
                  >boot: {{ services![name].start_on_boot }}</Badge
                >
              </span>
            </button>
            <p
              v-if="services![name].description"
              class="tw:pl-6 tw:text-xs tw:text-muted-foreground"
            >
              {{ services![name].description }}
            </p>

            <dl
              v-if="expanded === name"
              class="tw:grid tw:gap-x-4 tw:gap-y-1 tw:rounded-md tw:bg-surface-muted tw:p-3 tw:text-xs tw:sm:grid-cols-[auto_1fr]"
            >
              <dt class="tw:font-semibold tw:text-muted-foreground">Status</dt>
              <dd class="tw:text-foreground">{{ services![name].status }}</dd>
              <dt class="tw:font-semibold tw:text-muted-foreground">
                Start on boot
              </dt>
              <dd class="tw:text-foreground">
                {{ services![name].start_on_boot }}
              </dd>
              <dt class="tw:font-semibold tw:text-muted-foreground">
                Last state change
              </dt>
              <dd class="tw:text-foreground">
                {{ services![name].last_state_change || 'unknown' }}
              </dd>
              <dt class="tw:font-semibold tw:text-muted-foreground">
                Configuration
              </dt>
              <dd class="tw:break-all tw:font-mono tw:text-foreground">
                {{ services![name].configuration || '—' }}
              </dd>
              <dd
                class="tw:col-span-full tw:mt-1 tw:text-muted-foreground tw:italic"
              >
                Log viewing isn't available in this console yet.
              </dd>
            </dl>

            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button
                v-if="!isRunning(services![name].status)"
                variant="outline"
                size="sm"
                :disabled="pendingAction?.name === name"
                @click="requestAction(name, 'start')"
                >{{ isPending(name, 'start') ? 'Starting…' : 'Start' }}</Button
              >
              <template v-else>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="pendingAction?.name === name"
                  @click="requestAction(name, 'restart')"
                  >Restart</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="pendingAction?.name === name"
                  @click="requestAction(name, 'stop')"
                  >Stop</Button
                >
              </template>
            </div>
          </li>
        </ul>
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <EmptyState v-else title="No services reported" />
      </CardContent>
    </Card>

    <ConfirmDialog
      :open="confirming !== null"
      tier="disruptive"
      :title="
        confirming
          ? `${confirming.action === 'stop' ? 'Stop' : 'Restart'} ${confirming.name}?`
          : ''
      "
      description="This can interrupt the service you're using right now."
      :confirm-label="confirming?.action === 'stop' ? 'Stop' : 'Restart'"
      :busy="
        confirming !== null && isPending(confirming.name, confirming.action)
      "
      @confirm="runAction(confirming!.name, confirming!.action)"
      @cancel="cancelAction"
    />
  </PageLayout>
</template>
