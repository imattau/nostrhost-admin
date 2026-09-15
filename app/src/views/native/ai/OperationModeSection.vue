<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { getAgentMode, setAgentMode, type AgentModeLevel } from '@/api/nativeAgentModels'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

const { publicKey, sync } = useSigner()
const { success, danger } = useNotifications()

const MODE_LEVELS: { level: AgentModeLevel; label: string; dangerous: boolean }[] = [
  { level: 'observe', label: 'Observe (read-only)', dangerous: false },
  { level: 'assist', label: 'Assist (proposals only, never executes)', dangerous: false },
  { level: 'maintain', label: 'Maintain (can act on low-risk approved operations)', dangerous: true },
  { level: 'autonomous', label: 'Autonomous (highest self-directed level)', dangerous: true },
]

const currentMode = ref<AgentModeLevel>('observe')
const pendingMode = ref<AgentModeLevel>('observe')
const modeLoading = ref(false)
const modeApplying = ref(false)
const modeConfirmChecked = ref(false)

const pendingModeIsDangerous = computed(
  () => MODE_LEVELS.find((m) => m.level === pendingMode.value)?.dangerous ?? false,
)

async function loadMode() {
  modeLoading.value = true
  try {
    await sync()
    const mode = await getAgentMode()
    currentMode.value = mode.level
    pendingMode.value = mode.level
    modeConfirmChecked.value = false
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load the operation mode.'))
  } finally {
    modeLoading.value = false
  }
}

async function applyMode() {
  if (pendingModeIsDangerous.value && !modeConfirmChecked.value) return
  modeApplying.value = true
  try {
    await sync()
    await setAgentMode(pendingMode.value, modeConfirmChecked.value)
    success('Operation mode updated.')
    await loadMode()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to change the operation mode.'))
  } finally {
    modeApplying.value = false
  }
}

onMounted(() => {
  if (publicKey.value) loadMode()
})
watch(publicKey, (key) => {
  if (key) loadMode()
})

// Selecting a new local model can change which modes are safe to run, so
// LocalModelSection asks the shell to call this after a successful switch.
defineExpose({ reload: loadMode })
</script>

<template>
  <Card v-if="publicKey">
    <CardHeader>
      <CardTitle>Operation mode</CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-4">
      <p class="tw:text-sm tw:text-muted-foreground">
        Controls what the agent is allowed to attempt. Every level still
        passes through the daemon's own typed operation and approval
        boundary —
        <strong>Assist</strong> can only propose actions and never executes
        them, regardless of granted capabilities.
      </p>

      <div class="tw:flex tw:items-center tw:gap-2">
        <span class="tw:text-sm tw:text-muted-foreground">Current:</span>
        <Badge variant="brand">{{ currentMode }}</Badge>
      </div>

      <div class="tw:grid tw:gap-2">
        <Label for="mode-select">Change to</Label>
        <Select id="mode-select" v-model="pendingMode">
          <option v-for="mode in MODE_LEVELS" :key="mode.level" :value="mode.level">
            {{ mode.label }}
          </option>
        </Select>
      </div>

      <Alert v-if="pendingModeIsDangerous" variant="danger">
        <p class="tw:m-0">
          {{ pendingMode === 'maintain' ? 'Maintain' : 'Autonomous' }} lets
          the agent act on approval-gated or (autonomous only) pre-approved
          low-risk operations without a human proposing them first. No
          catalogued model has passed the release safety gate yet — only
          enable this if you understand and accept that.
        </p>
        <label
          class="tw:mt-2 tw:flex tw:items-start tw:gap-2 tw:text-xs tw:text-foreground"
        >
          <input
            v-model="modeConfirmChecked"
            type="checkbox"
            class="tw:mt-0.5 tw:size-4 tw:rounded tw:border-border-subtle"
          />
          <span>I understand the risk and want to proceed.</span>
        </label>
      </Alert>

      <div class="tw:flex tw:justify-end">
        <Button
          variant="primary"
          size="sm"
          :disabled="
            modeApplying ||
            pendingMode === currentMode ||
            (pendingModeIsDangerous && !modeConfirmChecked)
          "
          @click="applyMode"
          >{{ modeApplying ? 'Applying…' : 'Apply' }}</Button
        >
      </div>
    </CardContent>
  </Card>
</template>
