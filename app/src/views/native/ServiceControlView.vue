<script setup lang="ts">
import { computed, ref } from 'vue'

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
import { useNotifications } from '@/composables/useNotifications'
import { toErrorMessage } from '@/utils/errors'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { danger } = useNotifications()

const services = ref<ServiceStatusMap | null>(null)

const pendingAction = ref<{ name: string; action: ServiceAction } | null>(null)
const confirming = ref<{ name: string; action: ServiceAction } | null>(null)
const expanded = ref<string | null>(null)

function toggleExpanded(name: string) {
  expanded.value = expanded.value === name ? null : name
}

const serviceNames = computed(() =>
  services.value ? Object.keys(services.value).sort() : [],
)

const CONFIRM_ACTIONS: ServiceAction[] = ['stop', 'restart']

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  services.value = await getServiceStatus()
}, 'Failed to load service status.')

function requestAction(name: string, action: ServiceAction) {
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
  try {
    await sync()
    await controlService(name, action)
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to ${action} ${name}.`))
  } finally {
    pendingAction.value = null
  }
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
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
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
      :title="confirming ? `${confirming.action === 'stop' ? 'Stop' : 'Restart'} ${confirming.name}?` : ''"
      description="This can interrupt the service you're using right now."
      :confirm-label="confirming?.action === 'stop' ? 'Stop' : 'Restart'"
      :busy="confirming !== null && isPending(confirming.name, confirming.action)"
      @confirm="runAction(confirming!.name, confirming!.action)"
      @cancel="cancelAction"
    />
  </PageLayout>
</template>
