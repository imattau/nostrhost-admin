<script setup lang="ts">
import { computed, onMounted, ref, watch as watchRef } from 'vue'

import {
  configureNsiteGateway,
  disableNsiteGateway,
  enableNsiteGateway,
  getNsiteGatewayStatus,
  type GatewayInput,
  type GatewayStatus,
} from '@/api/nativeNsites'
import { getDomains } from '@/api/nativeDomains'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSigner } from '@/composables/useSigner'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import { Globe2 } from '@lucide/vue'

const { publicKey, sync } = useSigner()

const status = ref<GatewayStatus | null>(null)
const domains = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

const healthBadge = computed(() => {
  if (!status.value?.enabled)
    return { variant: 'neutral' as const, label: 'Off' }
  if (status.value.health === 'ok')
    return { variant: 'success' as const, label: 'Healthy' }
  return { variant: 'warning' as const, label: 'Degraded' }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [statusResult, domainResult] = await Promise.all([
      getNsiteGatewayStatus(),
      getDomains(),
    ])
    status.value = statusResult.gateway
    domains.value = domainResult.domains
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load gateway status.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watchRef(publicKey, (key) => {
  if (key) load()
})

// -- shared form state -----------------------------------------------------

const formDomain = ref('')
const formLookupRelays = ref('')
const formExtraRelays = ref('')
const formFallbackServers = ref('')
const formAllowHttp = ref(false)
const formMaxBlobBytes = ref('')
const formCacheQuota = ref('')

function toList(text: string): string[] | undefined {
  const values = text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return values.length ? values : undefined
}

function toNumber(text: string): number | undefined {
  const value = Number(text)
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function buildInput(): GatewayInput {
  return {
    domain: formDomain.value.trim(),
    lookup_relays: toList(formLookupRelays.value),
    extra_relays: toList(formExtraRelays.value),
    fallback_servers: toList(formFallbackServers.value),
    allow_http: formAllowHttp.value,
    max_blob_bytes: toNumber(formMaxBlobBytes.value),
    cache_quota_bytes: toNumber(formCacheQuota.value),
  }
}

function resetForm() {
  formDomain.value = ''
  formLookupRelays.value = ''
  formExtraRelays.value = ''
  formFallbackServers.value = ''
  formAllowHttp.value = false
  formMaxBlobBytes.value = ''
  formCacheQuota.value = ''
}

// -- enable ----------------------------------------------------------------

const showEnableForm = ref(false)
const enableError = ref('')
const confirmingEnable = ref(false)

function openEnableForm() {
  enableError.value = ''
  confirmingEnable.value = false
  resetForm()
  if (domains.value.length === 1) formDomain.value = domains.value[0]
  showEnableForm.value = true
}

function requestEnable() {
  if (!formDomain.value.trim()) {
    enableError.value = 'Choose the dedicated gateway domain.'
    return
  }
  enableError.value = ''
  confirmingEnable.value = true
}

async function confirmEnable() {
  confirmingEnable.value = false
  busy.value = 'enable'
  enableError.value = ''
  notice.value = ''
  try {
    await sync()
    await enableNsiteGateway(buildInput())
    notice.value = 'Gateway enable submitted.'
    showEnableForm.value = false
    await load()
  } catch (cause) {
    enableError.value =
      cause instanceof Error ? cause.message : 'Failed to enable the gateway.'
  } finally {
    busy.value = ''
  }
}

// -- disable ---------------------------------------------------------------

const confirmingDisable = ref(false)

async function confirmDisable() {
  confirmingDisable.value = false
  busy.value = 'disable'
  error.value = ''
  notice.value = ''
  try {
    await sync()
    await disableNsiteGateway()
    notice.value = 'Gateway disable submitted.'
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to disable the gateway.'
  } finally {
    busy.value = ''
  }
}

// -- configure -------------------------------------------------------------

const showConfigureForm = ref(false)
const configureError = ref('')
const confirmingConfigure = ref(false)

function openConfigureForm() {
  configureError.value = ''
  confirmingConfigure.value = false
  const config = status.value?.config ?? {}
  formDomain.value = status.value?.domain ?? ''
  formLookupRelays.value = (config.relays?.lookup ?? []).join(', ')
  formExtraRelays.value = (config.relays?.extra ?? []).join(', ')
  formFallbackServers.value = (config.blossom?.fallback_servers ?? []).join(
    ', ',
  )
  formAllowHttp.value = Boolean(config.blossom?.allow_http)
  formMaxBlobBytes.value = String(config.limits?.max_blob_bytes ?? '')
  formCacheQuota.value = String(config.limits?.cache_quota_bytes ?? '')
  showConfigureForm.value = true
}

function requestConfigure() {
  if (!formDomain.value.trim()) {
    configureError.value = 'Choose the gateway domain.'
    return
  }
  configureError.value = ''
  confirmingConfigure.value = true
}

async function confirmConfigure() {
  confirmingConfigure.value = false
  busy.value = 'configure'
  configureError.value = ''
  notice.value = ''
  try {
    await sync()
    await configureNsiteGateway(buildInput())
    notice.value = 'Gateway configure submitted.'
    showConfigureForm.value = false
    await load()
  } catch (cause) {
    configureError.value =
      cause instanceof Error
        ? cause.message
        : 'Failed to reconfigure the gateway.'
  } finally {
    busy.value = ''
  }
}

const configSummary = computed(() => {
  const config = status.value?.config ?? {}
  const parts: string[] = []
  if (config.relays?.lookup?.length)
    parts.push(`${config.relays.lookup.length} lookup relay(s)`)
  if (config.blossom?.allow_http) parts.push('HTTP allowed')
  if (config.limits?.max_blob_bytes)
    parts.push(`${Math.round(config.limits.max_blob_bytes / 1048576)} MiB/blob`)
  if (config.limits?.cache_quota_bytes)
    parts.push(
      `${Math.round(config.limits.cache_quota_bytes / 1073741824)} GiB cache`,
    )
  return parts.length ? parts.join(' · ') : 'defaults'
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Network"
      title="Sites"
      description="NIP-5A static sites served by the nsite gateway on a dedicated domain. Enabling, disabling or reconfiguring the gateway asks for confirmation first."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
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
              </p>
              <p class="tw:m-0">
                Service
                <Badge
                  :variant="status.service_active ? 'success' : 'danger'"
                  >{{ status.service_active ? 'active' : 'inactive' }}</Badge
                >
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
              <template v-if="confirmingDisable">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Disable the gateway and remove its route?</span
                >
                <Button
                  variant="outline"
                  size="sm"
                  @click="confirmingDisable = false"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmDisable"
                  >Confirm</Button
                >
              </template>
              <Button
                v-else
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
            <Switch
              v-model="formAllowHttp"
              aria-label="Allow HTTP blob fetch"
            />
            Allow fetching blobs over plain HTTP
          </label>
          <Alert v-if="enableError" variant="danger">{{ enableError }}</Alert>
          <div
            v-if="confirmingEnable"
            class="tw:flex tw:items-center tw:justify-end tw:gap-2"
          >
            <span class="tw:text-xs tw:text-muted-foreground"
              >Enable the gateway on {{ formDomain }}?</span
            >
            <Button
              variant="outline"
              size="sm"
              @click="confirmingEnable = false"
              >Cancel</Button
            >
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmEnable"
              >Confirm</Button
            >
          </div>
          <div v-else class="tw:flex tw:justify-end">
            <Button size="sm" :disabled="busy !== ''" @click="requestEnable">{{
              busy === 'enable' ? 'Enabling…' : 'Enable gateway'
            }}</Button>
          </div>
        </CardContent>
      </Card>

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
          <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="configure-lookup"
                >Lookup relays (comma-separated)</Label
              >
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
            <Switch
              v-model="formAllowHttp"
              aria-label="Allow HTTP blob fetch"
            />
            Allow fetching blobs over plain HTTP
          </label>
          <Alert v-if="configureError" variant="danger">{{
            configureError
          }}</Alert>
          <div
            v-if="confirmingConfigure"
            class="tw:flex tw:items-center tw:justify-end tw:gap-2"
          >
            <span class="tw:text-xs tw:text-muted-foreground"
              >Apply these settings and reload the gateway?</span
            >
            <Button
              variant="outline"
              size="sm"
              @click="confirmingConfigure = false"
              >Cancel</Button
            >
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmConfigure"
              >Confirm</Button
            >
          </div>
          <div v-else class="tw:flex tw:justify-end">
            <Button
              size="sm"
              :disabled="busy !== ''"
              @click="requestConfigure"
              >{{
                busy === 'configure' ? 'Applying…' : 'Apply configuration'
              }}</Button
            >
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How sites are served</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-1 tw:text-sm">
          <p class="tw:m-0">
            Each site is a NIP-5A manifest (kinds 15128/35128) that lists a
            public-key hash, files and an aggregate digest. The gateway resolves
            manifests over relays and serves their files over HTTPS from Blossom
            servers, verifying hashes on the way.
          </p>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            Publishing a site from this console is not wired up yet — it arrives
            with the Phase 3 publish flow.
          </p>
        </CardContent>
      </Card>
    </template>
  </PageLayout>
</template>
