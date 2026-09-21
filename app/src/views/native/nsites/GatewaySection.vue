<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import {
  configureNsiteGateway,
  disableNsiteGateway,
  enableNsiteGateway,
  type GatewayInput,
} from '@/api/nativeNsites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { parseList } from '@/lib/utils'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import { Globe2 } from '@lucide/vue'
import { NSITE_STATE_KEY } from './useNsiteState'

const { sync } = useSigner()
const { success, danger } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!
const { status, domains, loading } = nsite

const busy = ref('')
const { run } = useActionRunner(busy, '')

const healthBadge = computed(() => {
  if (!status.value?.enabled)
    return { variant: 'neutral' as const, label: 'Off' }
  if (status.value.health === 'ok')
    return { variant: 'success' as const, label: 'Healthy' }
  return { variant: 'warning' as const, label: 'Degraded' }
})

const configSummary = computed(() => {
  const config = status.value?.config ?? {}
  const parts: string[] = []
  if (config.relays?.lookup?.length)
    parts.push(`${config.relays.lookup.length} lookup relay(s)`)
  if (config.blossom?.allow_http) parts.push('HTTP allowed')
  if (config.npk?.enabled) parts.push('npk bundles')
  if (config.limits?.max_blob_bytes)
    parts.push(`${Math.round(config.limits.max_blob_bytes / 1048576)} MiB/blob`)
  if (config.limits?.cache_quota_bytes)
    parts.push(
      `${Math.round(config.limits.cache_quota_bytes / 1073741824)} GiB cache`,
    )
  return parts.length ? parts.join(' · ') : 'defaults'
})

// -- shared form state -----------------------------------------------------

const formDomain = ref('')
const formMode = ref<'hosted' | 'open'>('hosted')
const formLookupRelays = ref('')
const formExtraRelays = ref('')
const formFallbackServers = ref('')
const formAllowHttp = ref(false)
const formNpkEnabled = ref(false)
const formMaxBlobBytes = ref('')
const formCacheQuota = ref('')

function toList(text: string): string[] | undefined {
  const values = parseList(text)
  return values.length ? values : undefined
}

function toNumber(text: string): number | undefined {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function buildInput(): GatewayInput {
  return {
    domain: formDomain.value.trim(),
    mode: formMode.value,
    lookup_relays: toList(formLookupRelays.value),
    extra_relays: toList(formExtraRelays.value),
    fallback_servers: toList(formFallbackServers.value),
    allow_http: formAllowHttp.value,
    npk_enabled: formNpkEnabled.value,
    max_blob_bytes: toNumber(formMaxBlobBytes.value),
    cache_quota_bytes: toNumber(formCacheQuota.value),
  }
}

function resetForm() {
  formDomain.value = ''
  formMode.value = 'hosted'
  formLookupRelays.value = ''
  formExtraRelays.value = ''
  formFallbackServers.value = ''
  formAllowHttp.value = false
  formNpkEnabled.value = false
  formMaxBlobBytes.value = ''
  formCacheQuota.value = ''
}

// -- enable ----------------------------------------------------------------

const showEnableForm = ref(false)
const { pending: confirmingEnable, request: requestEnableConfirm } =
  useConfirm(false)

function openEnableForm() {
  confirmingEnable.value = false
  resetForm()
  if (domains.value.length === 1) formDomain.value = domains.value[0]
  showEnableForm.value = true
}

function requestEnable() {
  if (!formDomain.value.trim()) {
    danger('Choose the dedicated gateway domain.')
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
      await enableNsiteGateway(buildInput())
      success('Gateway enable submitted.')
      showEnableForm.value = false
      await nsite.load()
    },
    'Failed to enable the gateway.',
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
      await disableNsiteGateway()
      success('Gateway disable submitted.')
      await nsite.load()
    },
    'Failed to disable the gateway.',
  )
}

// -- configure -------------------------------------------------------------

const showConfigureForm = ref(false)
const { pending: confirmingConfigure, request: requestConfigureConfirm } =
  useConfirm(false)

function openConfigureForm() {
  confirmingConfigure.value = false
  const config = status.value?.config ?? {}
  formDomain.value = status.value?.domain ?? ''
  formMode.value =
    (status.value?.config?.mode as 'hosted' | 'open' | undefined) ?? 'hosted'
  formLookupRelays.value = (config.relays?.lookup ?? []).join(', ')
  formExtraRelays.value = (config.relays?.extra ?? []).join(', ')
  formFallbackServers.value = (config.blossom?.fallback_servers ?? []).join(
    ', ',
  )
  formAllowHttp.value = Boolean(config.blossom?.allow_http)
  formNpkEnabled.value = Boolean(config.npk?.enabled)
  formMaxBlobBytes.value = String(config.limits?.max_blob_bytes ?? '')
  formCacheQuota.value = String(config.limits?.cache_quota_bytes ?? '')
  showConfigureForm.value = true
}

function requestConfigure() {
  if (!formDomain.value.trim()) {
    danger('Choose the gateway domain.')
    return
  }
  requestConfigureConfirm(true)
}

async function confirmConfigure() {
  confirmingConfigure.value = false
  await run(
    'configure',
    async () => {
      await sync()
      await configureNsiteGateway(buildInput())
      success('Gateway configure submitted.')
      showConfigureForm.value = false
      await nsite.load()
    },
    'Failed to reconfigure the gateway.',
  )
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span>Gateway</span>
        <Badge v-if="status" :variant="healthBadge.variant">{{
          healthBadge.label
        }}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-4">
      <p v-if="loading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
        Loading…
      </p>

      <EmptyState
        v-else-if="status && !status.enabled"
        :icon="Globe2"
        title="The nsite gateway is not enabled"
        description="It will serve static sites on a registered, dedicated domain (no app or other subdomain can share it)."
      >
        <template #action>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== ''"
            @click="
              showEnableForm ? (showEnableForm = false) : openEnableForm()
            "
            >{{ showEnableForm ? 'Cancel' : 'Enable gateway' }}</Button
          >
        </template>
      </EmptyState>

      <template v-else-if="status">
        <div class="tw:grid tw:gap-1 tw:text-sm">
          <p class="tw:m-0">
            Domain
            <code class="tw:font-mono">{{ status.domain || '—' }}</code>
            · mode <code class="tw:font-mono">{{ status.mode }}</code>
            ·
            <RouterLink
              :to="{ name: 'native-domains' }"
              class="tw:text-xs tw:font-medium tw:text-brand-500 tw:no-underline tw:hover:underline"
              >Manage in Domains →</RouterLink
            >
          </p>
          <p class="tw:m-0">
            Service
            <Badge :variant="status.service_active ? 'success' : 'danger'">{{
              status.service_active ? 'active' : 'inactive'
            }}</Badge>
            <template v-if="status.internal">
              · internal probe
              <Badge
                :variant="
                  status.internal.status === 'ok' ? 'success' : 'warning'
                "
                >{{ status.internal.status }}</Badge
              >
            </template>
          </p>
          <p
            v-if="status.health_detail"
            class="tw:m-0 tw:text-xs tw:text-muted-foreground"
          >
            {{ status.health_detail }}
          </p>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            Config: {{ configSummary }} · path
            <code class="tw:font-mono">{{ status.config_path }}</code>
            <template v-if="status.config_exists"> · on disk</template>
          </p>
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
    title="Disable the gateway?"
    description="Every site and custom domain served through it stops resolving until it's re-enabled."
    confirm-label="Disable"
    :busy="busy === 'disable'"
    @confirm="confirmDisable"
    @cancel="confirmingDisable = false"
  />

  <Card v-if="showEnableForm && status && !status.enabled">
    <CardHeader>
      <CardTitle>Enable the gateway</CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <div class="tw:grid tw:gap-1.5">
        <Label for="enable-domain">Gateway domain (dedicated)</Label>
        <Select id="enable-domain" v-model="formDomain">
          <option value="" disabled>Choose a registered domain…</option>
          <option v-for="domain in domains" :key="domain" :value="domain">
            {{ domain }}
          </option>
        </Select>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Must be registered in Domains &amp; DNS and not used by an app or
          another registered subdomain.
        </p>
      </div>
      <div class="tw:grid tw:gap-1.5">
        <Label for="enable-mode">Mode</Label>
        <Select id="enable-mode" v-model="formMode">
          <option value="hosted">Hosted (allowlisted sites only)</option>
          <option value="open">Open (any decodable label; requires ACME DNS-01 token)</option>
        </Select>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Open mode serves any owner-signed site without a registration step;
          the operator's ACME DNS-01 token must be configured in operator.toml.
        </p>
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="enable-lookup">Lookup relays (comma-separated)</Label>
          <Input
            id="enable-lookup"
            v-model="formLookupRelays"
            placeholder="wss://purplepag.es, wss://user.kindpag.es"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="enable-fallback">Fallback Blossom servers</Label>
          <Input
            id="enable-fallback"
            v-model="formFallbackServers"
            placeholder="https://blossom.primal.net, https://blossom.band"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="enable-blob">Max blob size (bytes, optional)</Label>
          <Input
            id="enable-blob"
            v-model="formMaxBlobBytes"
            type="text"
            inputmode="numeric"
            placeholder="33554432"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="enable-cache">Cache quota (bytes, optional)</Label>
          <Input
            id="enable-cache"
            v-model="formCacheQuota"
            type="text"
            inputmode="numeric"
            placeholder="2147483648"
            autocomplete="off"
          />
        </div>
      </div>
      <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
        <Switch v-model="formAllowHttp" aria-label="Allow HTTP blob fetch" />
        Allow fetching blobs over plain HTTP
      </label>
      <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
        <Switch v-model="formNpkEnabled" aria-label="Enable npk bundles" />
        Serve sites from their publisher's npk release bundle when available
      </label>
      <div class="tw:flex tw:justify-end">
        <Button size="sm" :disabled="busy !== ''" @click="requestEnable">{{
          busy === 'enable' ? 'Enabling…' : 'Enable gateway'
        }}</Button>
      </div>
    </CardContent>
  </Card>

  <ConfirmDialog
    :open="confirmingEnable"
    tier="soft"
    title="Enable the gateway?"
    :description="`This registers ${formDomain} as the dedicated nsite gateway domain.`"
    confirm-label="Enable"
    :busy="busy === 'enable'"
    @confirm="confirmEnable"
    @cancel="confirmingEnable = false"
  />

  <Card v-if="showConfigureForm && status && status.enabled">
    <CardHeader>
      <CardTitle>Configure the gateway</CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <div class="tw:grid tw:gap-1.5">
        <Label for="configure-domain">Gateway domain</Label>
        <Input
          id="configure-domain"
          v-model="formDomain"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <div class="tw:grid tw:gap-1.5">
        <Label for="configure-mode">Mode</Label>
        <Select id="configure-mode" v-model="formMode">
          <option value="hosted">Hosted (allowlisted sites only)</option>
          <option value="open">Open (any decodable label; requires ACME DNS-01 token)</option>
        </Select>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Open mode serves any owner-signed site without a registration step;
          the operator's ACME DNS-01 token must be configured in operator.toml.
        </p>
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-lookup">Lookup relays (comma-separated)</Label>
          <Input
            id="configure-lookup"
            v-model="formLookupRelays"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-fallback">Fallback Blossom servers</Label>
          <Input
            id="configure-fallback"
            v-model="formFallbackServers"
            spellcheck="false"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-blob">Max blob size (bytes)</Label>
          <Input
            id="configure-blob"
            v-model="formMaxBlobBytes"
            type="text"
            inputmode="numeric"
            autocomplete="off"
          />
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label for="configure-cache">Cache quota (bytes)</Label>
          <Input
            id="configure-cache"
            v-model="formCacheQuota"
            type="text"
            inputmode="numeric"
            autocomplete="off"
          />
        </div>
      </div>
      <div class="tw:grid tw:gap-1.5">
        <Label for="configure-extra">Extra relays (comma-separated)</Label>
        <Input
          id="configure-extra"
          v-model="formExtraRelays"
          spellcheck="false"
          autocomplete="off"
        />
      </div>
      <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
        <Switch v-model="formAllowHttp" aria-label="Allow HTTP blob fetch" />
        Allow fetching blobs over plain HTTP
      </label>
      <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
        <Switch v-model="formNpkEnabled" aria-label="Enable npk bundles" />
        Serve sites from their publisher's npk release bundle when available
      </label>
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
    title="Apply this configuration?"
    description="The gateway reloads with these settings; in-flight requests may be interrupted briefly."
    confirm-label="Apply"
    :busy="busy === 'configure'"
    @confirm="confirmConfigure"
    @cancel="confirmingConfigure = false"
  />
</template>
