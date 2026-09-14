<script setup lang="ts">
import { computed, onMounted, ref, watch as watchRef } from 'vue'

import {
  configureNsiteGateway,
  disableNsiteGateway,
  enableNsiteGateway,
  getNsiteGatewayStatus,
  getNsiteList,
  publishNsite,
  unregisterNsite,
  type GatewayInput,
  type GatewayStatus,
  type NsiteSite,
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
import { Globe2, PackageOpen } from '@lucide/vue'
import { inventoryFromFiles, type InventoryItem } from '@/lib/nsite/inventory'
import {
  buildUnsignedManifest,
  planDigest,
  KIND_ROOT,
  KIND_NAMED,
} from '@/lib/nsite/manifest'
import { uploadToBlossom, type BlossomResult } from '@/lib/nsite/blossom'
import { signAndSubmit } from '@/lib/nsite/publish'

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
    await loadSites()
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

// -- sites table + publish wizard (Phase 3a) --------------------------------

const sites = ref<NsiteSite[]>([])
const sitesLoading = ref(false)
const sitesError = ref('')
const unregistering = ref('')

async function loadSites() {
  sitesLoading.value = true
  sitesError.value = ''
  try {
    const result = await getNsiteList()
    sites.value = result.sites
  } catch (cause) {
    sitesError.value =
      cause instanceof Error ? cause.message : 'Failed to load sites.'
  } finally {
    sitesLoading.value = false
  }
}

async function confirmUnregister(site: NsiteSite) {
  unregistering.value = `${site.pubkey}:${site.d}`
  sitesError.value = ''
  notice.value = ''
  try {
    await sync()
    await unregisterNsite({ pubkey: site.pubkey, d: site.d })
    notice.value = 'Site unregister submitted.'
    await loadSites()
  } catch (cause) {
    sitesError.value =
      cause instanceof Error ? cause.message : 'Failed to unregister the site.'
  } finally {
    unregistering.value = ''
  }
}

// wizard
const wizardVisible = ref(false)
const wizardStep = ref(0) // 0 identity · 1 directory · 2 targets · 3 upload · 4 review · 5 sign/submit · 6 done
const wizardError = ref('')
const wizardNotice = ref('')
const signerAvailable = ref(Boolean(window.nostr))
const signerPubkey = ref<string | null>(null)
const publishBusy = ref('')

const wKind = ref(String(KIND_ROOT))
const wD = ref('')
const wTitle = ref('')
const selectedFiles = ref<File[]>([])
const filesByPath = new Map<string, File>()
const inventory = ref<InventoryItem[]>([])
const wServers = ref('')
const wRelays = ref('')
const wBlossomResults = ref<BlossomResult[]>([])
const uploadProgress = ref({ done: 0, total: 0, path: '' })
const reviewDigest = ref('')
const reviewEvent = ref<unknown>(null)
const publishResult = ref<unknown>(null)

const publishEventId = computed(() => {
  const value = publishResult.value as { event_id?: string } | null
  return value?.event_id?.slice(0, 16) ?? ''
})

const publishSiteUrl = computed(() => {
  const value = publishResult.value as { site_url?: string } | null
  return value?.site_url
})

function openPublish() {
  wizardError.value = ''
  wizardNotice.value = ''
  publishResult.value = null
  wizardVisible.value = true
  wizardStep.value = 0
  selectedFiles.value = []
  filesByPath.clear()
  inventory.value = []
  wBlossomResults.value = []
  uploadProgress.value = { done: 0, total: 0, path: '' }
  reviewDigest.value = ''
  reviewEvent.value = null
  signerAvailable.value = Boolean(window.nostr)
  signerPubkey.value = window.nostr ? publicKey.value : null
  wServers.value = (status.value?.config?.blossom?.fallback_servers ?? []).join(
    ', ',
  )
  wRelays.value = 'wss://purplepag.es, wss://nos.lol, wss://relay.damus.io'
}

function closePublish() {
  wizardVisible.value = false
  wizardStep.value = 0
}

async function stepIdentity() {
  if (!wTitle.value.trim()) {
    wizardError.value = 'Give the site a title.'
    return
  }
  if (
    Number(wKind.value) === KIND_NAMED &&
    !/^[a-z0-9-]{1,13}$/.test(wD.value)
  ) {
    wizardError.value =
      'A named-site d tag is 1–13 lowercase letters, digits or hyphens.'
    return
  }
  if (!signerAvailable.value) {
    wizardError.value =
      'Publishing needs a NIP-07 signer (window.nostr). Sign in with one, or wait for NIP-46.'
    return
  }
  wizardError.value = ''
  wizardStep.value = 1
}

async function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  wizardError.value = ''
  wizardNotice.value = ''
  inventory.value = []
  if (!files.length) return
  selectedFiles.value = files
  filesByPath.clear()
  for (const file of files) filesByPath.set(file.webkitRelativePath, file)
  try {
    const items = await inventoryFromFiles(files)
    inventory.value = items
    if (!items.length) return
    wizardNotice.value = `${items.length} file(s), ${formatBytes(
      items.reduce((sum, item) => sum + item.size, 0),
    )}.`
  } catch (cause) {
    wizardError.value =
      cause instanceof Error ? cause.message : 'Inventory failed.'
  }
}

function stepTargets() {
  if (!inventory.value.length) {
    wizardError.value = 'Choose a directory with files first.'
    return
  }
  if (!wServers.value.trim()) {
    wizardError.value =
      'At least one Blossom server is required to host the blobs.'
    return
  }
  wizardError.value = ''
  wizardStep.value = 2
}

async function doUpload() {
  publishBusy.value = 'upload'
  wizardError.value = ''
  wBlossomResults.value = []
  const servers = wServers.value
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const items = inventory.value.map((item) => ({
    path: item.path,
    sha256: item.sha256,
  }))
  try {
    for (const server of servers) {
      const result = await uploadToBlossom(
        server,
        items,
        async (path) => {
          const file = filesByPath.get(path)
          return file ? new Uint8Array(await file.arrayBuffer()) : null
        },
        {
          pubkey: publicKey.value ?? '',
          signEvent: (event) => window.nostr!.signEvent(event),
          onProgress: (done, total, path) => {
            uploadProgress.value = { done, total, path }
          },
        },
      )
      wBlossomResults.value.push(result)
    }
    const allOk = wBlossomResults.value.every((result) => result.ok)
    if (!allOk) {
      wizardError.value =
        'Some blobs failed to upload. Review the per-server results below.'
      return
    }
    wizardStep.value = 3
  } catch (cause) {
    wizardError.value =
      cause instanceof Error ? cause.message : 'Upload failed.'
  } finally {
    publishBusy.value = ''
  }
}

async function doReview() {
  wizardError.value = ''
  publishBusy.value = 'review'
  try {
    const items = inventory.value.map((item) => ({
      path: item.path,
      sha256: item.sha256,
    }))
    const servers = wServers.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const relays = wRelays.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const digest = await planDigest({
      kind: Number(wKind.value),
      d: Number(wKind.value) === KIND_NAMED ? wD.value : '',
      paths: items,
      servers,
    })
    const { event } = await buildUnsignedManifest({
      pubkey: publicKey.value ?? '',
      kind: Number(wKind.value),
      d: Number(wKind.value) === KIND_NAMED ? wD.value : '',
      items,
      servers,
    })
    reviewDigest.value = digest
    reviewEvent.value = event
    wRelays.value = relays.join(', ')
    wizardStep.value = 4
  } catch (cause) {
    wizardError.value =
      cause instanceof Error ? cause.message : 'Review failed.'
  } finally {
    publishBusy.value = ''
  }
}

async function doPublish() {
  wizardError.value = ''
  publishBusy.value = 'publish'
  try {
    const items = inventory.value.map((item) => ({
      path: item.path,
      sha256: item.sha256,
    }))
    const servers = wServers.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const relays = wRelays.value
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const outcome = await signAndSubmit({
      pubkey: publicKey.value ?? '',
      kind: Number(wKind.value),
      d: Number(wKind.value) === KIND_NAMED ? wD.value : '',
      items,
      servers,
      relays,
      signEvent: (event) => window.nostr!.signEvent(event),
      submit: (args) =>
        publishNsite({
          event: args.event,
          plan_sha256: args.plan_sha256,
          relays: args.relays,
        }),
    })
    publishResult.value = outcome
    wizardStep.value = 5
    await Promise.all([load(), loadSites()])
  } catch (cause) {
    wizardError.value =
      cause instanceof Error ? cause.message : 'Publish failed.'
  } finally {
    publishBusy.value = ''
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1048576).toFixed(1)} MiB`
}

function openSite(url: string | undefined) {
  if (url) window.open(url, '_blank')
}

function siteLabel(site: NsiteSite): string {
  return site.kind === 35128
    ? `${site.pubkey.slice(0, 8)}…/d=${site.d}`
    : `${site.pubkey.slice(0, 16)}…`
}

function siteKindName(site: NsiteSite): string {
  return site.kind === 35128
    ? 'named'
    : site.kind === 15128
      ? 'root'
      : String(site.kind)
}
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
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Registered sites</span>
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== '' || !status?.enabled"
              @click="openPublish"
              >{{ wizardVisible ? 'Close wizard' : 'Publish a site' }}</Button
            >
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p
            v-if="sitesLoading"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            Loading…
          </p>
          <EmptyState
            v-else-if="!sites.length"
            :icon="PackageOpen"
            title="No registered sites"
            description="A registered site is an allowlisted owner pubkey; publishing records its manifest and serves it over HTTPS."
          >
            <template #action>
              <Button
                variant="outline"
                size="sm"
                :disabled="!status?.enabled"
                @click="openPublish"
                >{{
                  wizardVisible ? 'Close wizard' : 'Publish your first site'
                }}</Button
              >
            </template>
          </EmptyState>
          <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:p-0 tw:list-none">
            <li
              v-for="site in sites"
              :key="site.pubkey + ':' + site.d"
              class="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2"
            >
              <code class="tw:font-mono tw:text-sm">{{ siteLabel(site) }}</code>
              <Badge variant="neutral">{{ siteKindName(site) }}</Badge>
              <template v-if="site.title">
                <span class="tw:text-sm">{{ site.title }}</span>
              </template>
              <template v-if="site.last_event_id">
                <span
                  class="tw:text-xs tw:text-muted-foreground tw:font-mono"
                  :title="site.last_event_id"
                  >{{ site.last_event_id.slice(0, 12) }}…</span
                >
              </template>
              <Button
                variant="ghost"
                size="sm"
                class="tw:ml-auto"
                :disabled="unregistering !== ''"
                @click="confirmUnregister(site)"
                >{{
                  unregistering === site.pubkey + ':' + site.d
                    ? 'Removing…'
                    : 'Unregister'
                }}</Button
              >
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- Publish wizard -->
      <Card v-if="wizardVisible">
        <CardHeader>
          <CardTitle>
            Publish a site
            <span class="tw:text-sm tw:font-normal tw:text-muted-foreground">
              step {{ wizardStep + 1 }} of 6
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <Alert v-if="wizardError" variant="danger">{{ wizardError }}</Alert>
          <Alert v-if="wizardNotice" variant="success" role="status">{{
            wizardNotice
          }}</Alert>

          <!-- step 1: identity -->
          <template v-if="wizardStep === 0">
            <div class="tw:grid tw:gap-1.5">
              <Label for="w-title">Site title</Label>
              <Input id="w-title" v-model="wTitle" spellcheck="false" />
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="w-kind">Site type</Label>
              <Select id="w-kind" v-model="wKind">
                <option :value="String(KIND_ROOT)">
                  Root site (npub address)
                </option>
                <option :value="String(KIND_NAMED)">
                  Named site (custom d label)
                </option>
              </Select>
            </div>
            <div v-if="Number(wKind) === KIND_NAMED" class="tw:grid tw:gap-1.5">
              <Label for="w-d">d label</Label>
              <Input
                id="w-d"
                v-model="wD"
                placeholder="blog"
                spellcheck="false"
                autocomplete="off"
              />
            </div>
            <Alert v-if="!signerAvailable" variant="warning">
              No NIP-07 signer detected. Publishing needs a browser signer
              (window.nostr) until NIP-46 support lands.
            </Alert>
            <div v-else class="tw:flex tw:justify-end">
              <Button size="sm" @click="stepIdentity">Next</Button>
            </div>
          </template>

          <!-- step 2: directory -->
          <template v-else-if="wizardStep === 1">
            <div class="tw:grid tw:gap-1.5">
              <Label for="w-dir">Site directory</Label>
              <Input
                id="w-dir"
                type="file"
                webkitdirectory
                directory=""
                multiple
                @change="onFilesSelected"
              />
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Select the folder that becomes the site root. Files are hashed
                in your browser (Web Crypto); paths with &quot;..&quot; and
                files over 32 MiB are rejected.
              </p>
            </div>
            <div v-if="inventory.length" class="tw:grid tw:gap-1">
              <p class="tw:m-0 tw:text-sm">
                {{ inventory.length }} file(s) · total
                {{
                  formatBytes(
                    inventory.reduce((sum, item) => sum + item.size, 0),
                  )
                }}
              </p>
              <ul
                class="tw:m-0 tw:max-h-48 tw:overflow-auto tw:grid tw:gap-1 tw:p-0 tw:list-none tw:text-xs tw:font-mono"
              >
                <li
                  v-for="item in inventory.slice(0, 50)"
                  :key="item.path"
                  class="tw:truncate"
                >
                  {{ item.path }} · {{ formatBytes(item.size) }}
                </li>
                <li
                  v-if="inventory.length > 50"
                  class="tw:text-muted-foreground"
                >
                  …and {{ inventory.length - 50 }} more
                </li>
              </ul>
            </div>
            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button variant="outline" size="sm" @click="wizardStep = 0"
                >Back</Button
              >
              <Button
                size="sm"
                :disabled="!inventory.length"
                @click="stepTargets"
                >Next</Button
              >
            </div>
          </template>

          <!-- step 3: servers + relays -->
          <template v-else-if="wizardStep === 2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="w-servers">Blossom servers (comma-separated)</Label>
              <Input
                id="w-servers"
                v-model="wServers"
                placeholder="https://blossom.primal.net"
                spellcheck="false"
                autocomplete="off"
              />
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Blobs are uploaded from your browser straight to these servers
                (BUD-01). The manifest will list them as server hints.
              </p>
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="w-relays">Publish relays (comma-separated)</Label>
              <Input
                id="w-relays"
                v-model="wRelays"
                spellcheck="false"
                autocomplete="off"
              />
            </div>
            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button variant="outline" size="sm" @click="wizardStep = 1"
                >Back</Button
              >
              <Button
                size="sm"
                :disabled="publishBusy === 'upload'"
                @click="doUpload"
                >{{
                  publishBusy === 'upload' ? 'Uploading…' : 'Upload blobs'
                }}</Button
              >
            </div>
          </template>

          <!-- step 4: upload progress -->
          <template v-else-if="wizardStep === 3">
            <p class="tw:m-0 tw:text-sm">
              Uploading
              <template v-if="uploadProgress.total">
                {{ uploadProgress.done }} / {{ uploadProgress.total }}
              </template>
              <template v-if="uploadProgress.path">
                · <code class="tw:font-mono">{{ uploadProgress.path }}</code>
              </template>
            </p>
            <div
              v-for="result in wBlossomResults"
              :key="result.server"
              class="tw:grid tw:gap-1 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-sm"
            >
              <div class="tw:flex tw:items-center tw:gap-2">
                <code class="tw:font-mono">{{ result.server }}</code>
                <Badge :variant="result.ok ? 'success' : 'danger'">{{
                  result.ok ? 'ok' : 'failed'
                }}</Badge>
              </div>
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                {{ result.uploaded.length }} uploaded ·
                {{ result.skipped.length }} skipped ·
                {{ result.failed.length }} failed
              </p>
            </div>
            <Alert v-if="wizardError" variant="danger">{{ wizardError }}</Alert>
            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="publishBusy !== ''"
                @click="wizardStep = 2"
                >Back</Button
              >
              <Button size="sm" :disabled="publishBusy !== ''" @click="doReview"
                >Review manifest</Button
              >
            </div>
          </template>

          <!-- step 5: review -->
          <template v-else-if="wizardStep === 4">
            <p class="tw:m-0 tw:text-sm">
              Kind <code class="tw:font-mono">{{ wKind }}</code> · d
              <code class="tw:font-mono">{{ wD || '—' }}</code>
            </p>
            <div class="tw:grid tw:gap-1">
              <p class="tw:m-0 tw:text-sm">Tags to be signed:</p>
              <pre
                class="tw:m-0 tw:max-h-48 tw:overflow-auto tw:rounded tw:bg-muted tw:p-2 tw:text-xs tw:font-mono"
                >{{ JSON.stringify(reviewEvent, null, 2) }}</pre
              >
            </div>
            <p class="tw:m-0 tw:text-sm">
              Plan digest
              <code class="tw:font-mono">{{ reviewDigest }}</code>
            </p>
            <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
              Editing anything above (kind, d, files, servers) discards this
              digest — go back and re-review.
            </p>
            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="publishBusy !== ''"
                @click="wizardStep = 2"
                >Back</Button
              >
              <Button
                size="sm"
                :disabled="publishBusy !== ''"
                @click="doPublish"
                >{{
                  publishBusy === 'publish'
                    ? 'Publishing…'
                    : 'Sign &amp; publish'
                }}</Button
              >
            </div>
          </template>

          <!-- step 6: result -->
          <template v-else-if="wizardStep === 5">
            <div class="tw:grid tw:gap-1 tw:text-sm">
              <p class="tw:m-0">
                Published
                <code class="tw:font-mono">{{ publishEventId || '…' }}</code>
              </p>
              <template v-if="publishSiteUrl">
                <p class="tw:m-0">
                  Site URL
                  <code class="tw:font-mono">{{ publishSiteUrl }}</code>
                </p>
                <div class="tw:flex tw:justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    @click="openSite(publishSiteUrl)"
                    >Open site</Button
                  >
                </div>
              </template>
              <p v-else class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                The publish is pending approval or was submitted; check the
                operations list for the chain result.
              </p>
            </div>
            <div class="tw:flex tw:justify-end">
              <Button size="sm" @click="closePublish">Done</Button>
            </div>
          </template>
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
            Publishing signs a manifest in your browser with NIP-07 (the server
            never sees your key) and submits it for approval.
          </p>
        </CardContent>
      </Card>
    </template>
  </PageLayout>
</template>
