<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import {
  configureNsiteBlossom,
  disableNsiteBlossom,
  enableNsiteBlossom,
  getNsiteBlossomStatus,
  type NsiteBlossomInput,
  type NsiteBlossomStatus,
} from '@/api/nativeNsites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { parseList } from '@/lib/utils'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import { HardDrive } from '@lucide/vue'
import { NSITE_STATE_KEY } from './useNsiteState'

const { sync } = useSigner()
const { success, danger } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!

const busy = ref('')
const { run } = useActionRunner(busy, '')

const blossom = ref<NsiteBlossomStatus | null>(null)
const blossomLoading = ref(false)
const { run: runBlossom } = useActionRunner(blossomLoading, false)

// The gateway must be enabled for the local Blossom listener to run (it is
// part of the same nostrhost-nsite unit).
const gatewayEnabled = computed(() => Boolean(nsite.status.value?.enabled))

async function loadBlossom() {
  await runBlossom(
    true,
    async () => {
      const result = await getNsiteBlossomStatus()
      blossom.value = result.blossom
    },
    'Failed to load local Blossom status.',
  )
}

// Refresh whenever the gateway state changes so the component tracks enable/
// disable.
watch(() => nsite.status.value?.enabled, (enabled) => {
  if (enabled) loadBlossom()
})

const healthBadge = computed(() => {
  if (!blossom.value?.enabled)
    return { variant: 'neutral' as const, label: 'Off' }
  if (blossom.value.health === 'ok')
    return { variant: 'success' as const, label: 'Healthy' }
  return { variant: 'warning' as const, label: 'Degraded' }
})

const summary = computed(() => {
  const b = blossom.value
  if (!b) return ''
  const parts: string[] = []
  parts.push(b.listen)
  if (b.quota_bytes) parts.push(`${Math.round(b.quota_bytes / 1073741824)} GiB quota`)
  if (b.retention_days) parts.push(`${b.retention_days}d retention`)
  if (b.max_blob_bytes) parts.push(`${Math.round(b.max_blob_bytes / 1048576)} MiB/blob`)
  if (b.allow_pubkeys?.length) parts.push(`${b.allow_pubkeys.length} admitted key(s)`)
  return parts.join(' · ')
})

// -- shared form ------------------------------------------------------------

const formListen = ref('127.0.0.1:8197')
const formDataDir = ref('/var/lib/nostrhost-nsite/blossom')
const formQuota = ref('1073741824')
const formMaxBlob = ref('33554432')
const formRetention = ref('30')
const formAllowPubkeys = ref('')

function toNumber(text: string): number | undefined {
  const value = Number(text)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

function buildInput(): NsiteBlossomInput {
  return {
    listen: formListen.value.trim(),
    data_dir: formDataDir.value.trim(),
    quota_bytes: toNumber(formQuota.value),
    max_blob_bytes: toNumber(formMaxBlob.value),
    retention_days: toNumber(formRetention.value),
    allow_pubkeys: parseList(formAllowPubkeys.value),
  }
}

function resetForm() {
  formListen.value = '127.0.0.1:8197'
  formDataDir.value = '/var/lib/nostrhost-nsite/blossom'
  formQuota.value = '1073741824'
  formMaxBlob.value = '33554432'
  formRetention.value = '30'
  formAllowPubkeys.value = ''
}

function populateFromStatus() {
  const b = blossom.value
  if (!b) return
  formListen.value = b.listen
  formDataDir.value = b.data_dir
  formQuota.value = String(b.quota_bytes ?? '')
  formMaxBlob.value = String(b.max_blob_bytes ?? '')
  formRetention.value = String(b.retention_days ?? '')
  formAllowPubkeys.value = (b.allow_pubkeys ?? []).join(', ')
}

// -- enable ----------------------------------------------------------------

const showEnableForm = ref(false)
const { pending: confirmingEnable, request: requestEnableConfirm } =
  useConfirm(false)

function openEnableForm() {
  confirmingEnable.value = false
  resetForm()
  if (blossom.value?.enabled) populateFromStatus()
  showEnableForm.value = true
}

function requestEnable() {
  if (!formListen.value.trim()) {
    danger('The listener address is required.')
    return
  }
  requestEnableConfirm(true)
}

async function confirmEnable() {
  confirmingEnable.value = false
  await run(
    'enable',
    async () => {
      await sync()
      await enableNsiteBlossom(buildInput())
      success('Local Blossom enable submitted.')
      showEnableForm.value = false
      await loadBlossom()
      await nsite.load()
    },
    'Failed to enable the local Blossom server.',
  )
}

// -- disable ---------------------------------------------------------------

const { pending: confirmingDisable } = useConfirm(false)

async function confirmDisable() {
  confirmingDisable.value = false
  await run(
    'disable',
    async () => {
      await sync()
      await disableNsiteBlossom()
      success('Local Blossom disable submitted.')
      await loadBlossom()
      await nsite.load()
    },
    'Failed to disable the local Blossom server.',
  )
}

// -- configure -------------------------------------------------------------

const showConfigureForm = ref(false)
const { pending: confirmingConfigure, request: requestConfigureConfirm } =
  useConfirm(false)

function openConfigureForm() {
  confirmingConfigure.value = false
  populateFromStatus()
  showConfigureForm.value = true
}

function requestConfigure() {
  requestConfigureConfirm(true)
}

async function confirmConfigure() {
  confirmingConfigure.value = false
  await run(
    'configure',
    async () => {
      await sync()
      await configureNsiteBlossom(buildInput())
      success('Local Blossom configure submitted.')
      showConfigureForm.value = false
      await loadBlossom()
      await nsite.load()
    },
    'Failed to reconfigure the local Blossom server.',
  )
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span>Local Blossom server</span>
        <Badge v-if="blossom" :variant="healthBadge.variant">{{
          healthBadge.label
        }}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-4">
      <p v-if="blossomLoading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
        Loading…
      </p>

      <EmptyState
        v-else-if="!gatewayEnabled"
        :icon="HardDrive"
        title="Enable the gateway first"
        description="The local Blossom server runs inside the nostrhost-nsite unit, so it can only be enabled once the gateway is running."
      />

      <EmptyState
        v-else-if="blossom && !blossom.enabled"
        :icon="HardDrive"
        title="Local Blossom server is off"
        description="It is an optional content-addressed blob store with its own quota, per-blob cap and retention contract. Enable it to host site blobs on this node instead of (or alongside) external servers."
      >
        <template #action>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== ''"
            @click="
              showEnableForm ? (showEnableForm = false) : openEnableForm()
            "
            >{{ showEnableForm ? 'Cancel' : 'Enable local Blossom' }}</Button
          >
        </template>
      </EmptyState>

      <template v-else-if="blossom && blossom.enabled">
        <div class="tw:grid tw:gap-1 tw:text-sm">
          <p class="tw:m-0">
            Listener <code class="tw:font-mono">{{ blossom.listen }}</code>
            <template v-if="blossom.health_detail">
              · <span class="tw:text-muted-foreground">{{ blossom.health_detail }}</span>
            </template>
          </p>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">{{ summary }}</p>
        </div>

        <div
          class="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== ''"
            @click="
              showConfigureForm
                ? (showConfigureForm = false)
                : openConfigureForm()
            "
            >{{ showConfigureForm ? 'Cancel' : 'Configure' }}</Button
          >
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== ''"
            @click="confirmingDisable = true"
            >{{ busy === 'disable' ? 'Disabling…' : 'Disable' }}</Button
          >
        </div>
      </template>
    </CardContent>
  </Card>

  <ConfirmDialog
    :open="confirmingDisable"
    tier="disruptive"
    title="Disable the local Blossom server?"
    description="Its listener stops and sites that depend on it for blob resolution will fall back to other servers."
    confirm-label="Disable"
    :busy="busy === 'disable'"
    @confirm="confirmDisable"
    @cancel="confirmingDisable = false"
  />

  <Card v-if="showEnableForm && gatewayEnabled && blossom && !blossom.enabled">
    <CardHeader>
      <CardTitle>Enable the local Blossom server</CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="blossom-listen">Listener (loopback only)</Label>
          <Input
            id="blossom-listen"
            v-model="formListen"
            placeholder="127.0.0.1:8197"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="blossom-dir">Data directory</Label>
          <Input
            id="blossom-dir"
            v-model="formDataDir"
            placeholder="/var/lib/nostrhost-nsite/blossom"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-3">
        <div class="tw:grid tw:gap-1.5">
          <Label for="blossom-quota">Quota (bytes)</Label>
          <Input
            id="blossom-quota"
            v-model="formQuota"
            type="text"
            inputmode="numeric"
            placeholder="1073741824"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="blossom-maxblob">Max blob (bytes)</Label>
          <Input
            id="blossom-maxblob"
            v-model="formMaxBlob"
            type="text"
            inputmode="numeric"
            placeholder="33554432"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="blossom-retention">Retention (days)</Label>
          <Input
            id="blossom-retention"
            v-model="formRetention"
            type="text"
            inputmode="numeric"
            placeholder="30"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-1.5">
        <Label for="blossom-pubkeys">Admitted upload pubkeys (comma-separated)</Label>
        <Input
          id="blossom-pubkeys"
          v-model="formAllowPubkeys"
          placeholder="Leave empty to admit any valid kind-24242 auth"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <div class="tw:flex tw:justify-end">
        <Button size="sm" :disabled="busy !== ''" @click="requestEnable">{{
          busy === 'enable' ? 'Enabling…' : 'Enable local Blossom'
        }}</Button>
      </div>
    </CardContent>
  </Card>

  <ConfirmDialog
    :open="confirmingEnable"
    tier="soft"
    title="Enable the local Blossom server?"
    description="A BUD-01/BUD-02 content-addressed blob store starts on the loopback listener with the configured quota and retention."
    confirm-label="Enable"
    :busy="busy === 'enable'"
    @confirm="confirmEnable"
    @cancel="confirmingEnable = false"
  />

  <Card v-if="showConfigureForm && blossom && blossom.enabled">
    <CardHeader>
      <CardTitle>Configure the local Blossom server</CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-blossom-listen">Listener (loopback only)</Label>
          <Input
            id="configure-blossom-listen"
            v-model="formListen"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-blossom-dir">Data directory</Label>
          <Input
            id="configure-blossom-dir"
            v-model="formDataDir"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-3">
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-blossom-quota">Quota (bytes)</Label>
          <Input
            id="configure-blossom-quota"
            v-model="formQuota"
            type="text"
            inputmode="numeric"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-blossom-maxblob">Max blob (bytes)</Label>
          <Input
            id="configure-blossom-maxblob"
            v-model="formMaxBlob"
            type="text"
            inputmode="numeric"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-blossom-retention">Retention (days)</Label>
          <Input
            id="configure-blossom-retention"
            v-model="formRetention"
            type="text"
            inputmode="numeric"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-1.5">
        <Label for="configure-blossom-pubkeys">Admitted upload pubkeys</Label>
        <Input
          id="configure-blossom-pubkeys"
          v-model="formAllowPubkeys"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <div class="tw:flex tw:justify-end">
        <Button size="sm" :disabled="busy !== ''" @click="requestConfigure">{{
          busy === 'configure' ? 'Applying…' : 'Apply configuration'
        }}</Button>
      </div>
    </CardContent>
  </Card>

  <ConfirmDialog
    :open="confirmingConfigure"
    tier="disruptive"
    title="Apply this Blossom configuration?"
    description="The gateway reloads with these settings; the local blob store is not restarted, only the contract updates."
    confirm-label="Apply"
    :busy="busy === 'configure'"
    @confirm="confirmConfigure"
    @cancel="confirmingConfigure = false"
  />
</template>