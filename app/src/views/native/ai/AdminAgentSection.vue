<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import {
  disableAgent,
  enableAgent,
  getAgentStatus,
  initAgent,
  type AgentStatus,
} from '@/api/nativeAgent'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

const { publicKey, sync } = useSigner()
const { danger } = useNotifications()

const agentStatus = ref<AgentStatus | null>(null)
const agentLoading = ref(false)
const agentActing = ref(false)

async function loadAgentStatus() {
  agentLoading.value = true
  try {
    await sync()
    agentStatus.value = await getAgentStatus()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load agent status.'))
  } finally {
    agentLoading.value = false
  }
}

async function runInit() {
  agentActing.value = true
  try {
    await sync()
    await initAgent()
    await loadAgentStatus()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to initialise the agent.'))
  } finally {
    agentActing.value = false
  }
}

async function toggleAgent() {
  agentActing.value = true
  try {
    await sync()
    if (agentStatus.value?.service_enabled) {
      await disableAgent()
    } else {
      await enableAgent()
    }
    await loadAgentStatus()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to update the agent.'))
  } finally {
    agentActing.value = false
  }
}

onMounted(() => {
  if (publicKey.value) loadAgentStatus()
})
watch(publicKey, (key) => {
  if (key) loadAgentStatus()
})
</script>

<template>
  <Card v-if="publicKey">
    <CardHeader>
      <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span>Admin agent</span>
        <Button
          variant="outline"
          size="sm"
          :disabled="agentLoading"
          @click="loadAgentStatus"
          >{{ agentLoading ? 'Refreshing…' : 'Refresh' }}</Button
        >
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-4">
      <p class="tw:text-sm tw:text-muted-foreground">
        The optional <code class="tw:font-mono">nostrhost-agent</code> runs
        scheduled, read-only observation queries (e.g.
        <code class="tw:font-mono">service.status</code>) against this node's
        control plane and reports back over the relay. It ships in an
        "observe" policy — it cannot take write actions.
      </p>

      <template v-if="agentStatus">
        <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Badge :variant="agentStatus.installed ? 'success' : 'neutral'">
            {{ agentStatus.installed ? 'Installed' : 'Not installed' }}
          </Badge>
          <Badge :variant="agentStatus.configured ? 'success' : 'neutral'">
            {{ agentStatus.configured ? 'Configured' : 'Unconfigured' }}
          </Badge>
          <Badge :variant="agentStatus.service_enabled ? 'brand' : 'neutral'">
            {{ agentStatus.service_enabled ? 'Enabled' : 'Disabled' }}
          </Badge>
          <Badge
            :variant="agentStatus.service_active ? 'success' : 'neutral'"
          >
            {{ agentStatus.service_active ? 'Running' : 'Not running' }}
          </Badge>
        </div>

        <Alert v-if="!agentStatus.installed" variant="info">
          <code class="tw:font-mono">nostrhost-agent</code> is not installed
          on this node. Install the optional package first, then reload this
          page.
        </Alert>
        <div v-else class="tw:flex tw:justify-end tw:gap-2">
          <Button
            v-if="!agentStatus.configured"
            variant="primary"
            size="sm"
            :disabled="agentActing"
            @click="runInit"
            >{{ agentActing ? 'Initialising…' : 'Initialise agent' }}</Button
          >
          <Button
            v-else
            :variant="agentStatus.service_enabled ? 'danger' : 'primary'"
            size="sm"
            :disabled="agentActing"
            @click="toggleAgent"
            >{{
              agentActing
                ? 'Working…'
                : agentStatus.service_enabled
                  ? 'Turn off'
                  : 'Turn on'
            }}</Button
          >
        </div>
      </template>
      <p v-else class="tw:text-sm tw:text-muted-foreground">
        {{ agentLoading ? 'Loading…' : 'Status unavailable.' }}
      </p>
    </CardContent>
  </Card>
</template>
