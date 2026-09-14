<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  disableAgent,
  enableAgent,
  getAgentStatus,
  initAgent,
  type AgentStatus,
} from '@/api/nativeAgent'
import {
  downloadModel,
  getAgentMode,
  getContributionSettings,
  getExportCandidate,
  getModelProfile,
  getModelRecommendations,
  getModelStatus,
  listExportableCycles,
  runExport,
  selectModel,
  setAgentMode,
  setContributionSettings,
  submitContribution,
  type AgentModeLevel,
  type ContributionSettings,
  type ExportCandidate,
  type ExportCycleSummary,
  type HostCapabilities,
  type ModelRecommendation,
  type ModelStatus,
} from '@/api/nativeAgentModels'
import {
  grantCapability,
  listCapabilities,
  revokeCapability,
  type CapabilityGrant,
} from '@/api/nativeCapability'
import {
  getMcpCaBundle,
  getMcpEndpoint,
  type McpCaBundle,
  type McpEndpoint,
} from '@/api/nativeMcp'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSigner } from '@/composables/useSigner'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`
}

// Curated subset of the scopes defined in nostrhost-yunohost's
// nostr_operations.py (SCOPE_*), each mapped to the tool(s) it governs —
// the scope string alone doesn't say what it unlocks (e.g. "catalog.inspect"
// governs catalog.list/catalog.get, not a tool named "catalog.inspect").
const SCOPE_TOOLS: Record<string, string> = {
  'system.read': 'system.status',
  'apps.read': 'app.list',
  'services.read': 'service.status',
  'services.restart': 'service.restart',
  'catalog.inspect': 'catalog.list, catalog.get',
  'catalog.verify': 'catalog.verify',
  'catalog.publish': 'catalog.publish',
  'logs.read': 'logs.read, logs.web',
  'audit.read': 'audit.list, audit.get',
}
const ALL_SCOPES = Object.keys(SCOPE_TOOLS)

// Read-heavy defaults so granting access doesn't default to write scopes.
const SCOPE_PRESETS = [
  {
    id: 'read-only',
    label: 'Read-only',
    recommended: true,
    scopes: [
      'system.read',
      'apps.read',
      'services.read',
      'catalog.inspect',
      'logs.read',
      'audit.read',
    ],
  },
  {
    id: 'read-restart',
    label: 'Read + restart services',
    recommended: false,
    scopes: [
      'system.read',
      'apps.read',
      'services.read',
      'services.restart',
      'catalog.inspect',
      'logs.read',
      'audit.read',
    ],
  },
  {
    id: 'publishing',
    label: 'Package publishing',
    recommended: false,
    scopes: ['catalog.inspect', 'catalog.verify', 'catalog.publish'],
  },
  { id: 'custom', label: 'Custom', recommended: false, scopes: [] as string[] },
] as const

const { publicKey, signerAvailable, sync } = useSigner()

const agentStatus = ref<AgentStatus | null>(null)
const agentError = ref('')
const agentLoading = ref(false)
const agentActing = ref(false)

async function loadAgentStatus() {
  agentLoading.value = true
  agentError.value = ''
  try {
    await sync()
    agentStatus.value = await getAgentStatus()
  } catch (cause) {
    agentError.value =
      cause instanceof Error ? cause.message : 'Failed to load agent status.'
  } finally {
    agentLoading.value = false
  }
}

async function runInit() {
  agentActing.value = true
  agentError.value = ''
  try {
    await sync()
    await initAgent()
    await loadAgentStatus()
  } catch (cause) {
    agentError.value =
      cause instanceof Error ? cause.message : 'Failed to initialise the agent.'
  } finally {
    agentActing.value = false
  }
}

async function toggleAgent() {
  agentActing.value = true
  agentError.value = ''
  try {
    await sync()
    if (agentStatus.value?.service_enabled) {
      await disableAgent()
    } else {
      await enableAgent()
    }
    await loadAgentStatus()
  } catch (cause) {
    agentError.value =
      cause instanceof Error ? cause.message : 'Failed to update the agent.'
  } finally {
    agentActing.value = false
  }
}

const mcpPubkey = ref('')
const mcpScopes = ref<string[]>([])
const mcpGranting = ref(false)
const mcpError = ref('')

const wizardOpen = ref(false)
const wizardStep = ref<1 | 2 | 3 | 4>(1)
const selectedPreset = ref<(typeof SCOPE_PRESETS)[number]['id']>('read-only')
const grantedPubkey = ref('')

const transportTab = ref<'local' | 'remote'>('local')
const mcpEndpoint = ref<McpEndpoint | null>(null)
const mcpEndpointLoading = ref(false)
const caBundle = ref<McpCaBundle | null>(null)

async function loadRemoteTransportInfo() {
  mcpEndpointLoading.value = true
  try {
    const [endpoint, bundle] = await Promise.all([
      getMcpEndpoint(),
      getMcpCaBundle(),
    ])
    mcpEndpoint.value = endpoint
    caBundle.value = bundle
  } catch {
    mcpEndpoint.value = { configured: false }
    caBundle.value = { available: false }
  } finally {
    mcpEndpointLoading.value = false
  }
}

function downloadCaBundle() {
  if (!caBundle.value?.available) return
  const blob = new Blob([caBundle.value.pem], {
    type: 'application/x-pem-file',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'nostrhost-mcp-ca.pem'
  link.click()
  URL.revokeObjectURL(url)
}

function openWizard() {
  mcpPubkey.value = ''
  mcpError.value = ''
  selectedPreset.value = 'read-only'
  mcpScopes.value = [...SCOPE_PRESETS[0].scopes]
  wizardStep.value = 1
  transportTab.value = 'local'
  wizardOpen.value = true
}

function closeWizard() {
  wizardOpen.value = false
}

function choosePreset(id: (typeof SCOPE_PRESETS)[number]['id']) {
  selectedPreset.value = id
  const preset = SCOPE_PRESETS.find((p) => p.id === id)
  if (preset && id !== 'custom') mcpScopes.value = [...preset.scopes]
}

const grants = ref<CapabilityGrant[]>([])
const grantsLoading = ref(false)
const grantsError = ref('')
const confirmingRevoke = ref<string | null>(null)
const revokingPubkey = ref('')

async function loadGrants() {
  grantsLoading.value = true
  grantsError.value = ''
  try {
    await sync()
    const result = await listCapabilities()
    grants.value = result.grants
  } catch (cause) {
    grantsError.value =
      cause instanceof Error ? cause.message : 'Failed to load current access.'
  } finally {
    grantsLoading.value = false
  }
}

function truncatePubkey(pubkey: string) {
  return pubkey.length > 16
    ? `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`
    : pubkey
}

function requestRevokeGrant(pubkey: string) {
  mcpError.value = ''
  confirmingRevoke.value = pubkey
}

function cancelRevokeGrant() {
  confirmingRevoke.value = null
}

async function confirmRevokeGrant(pubkey: string) {
  confirmingRevoke.value = null
  revokingPubkey.value = pubkey
  mcpError.value = ''
  try {
    await sync()
    await revokeCapability(pubkey)
    await loadGrants()
  } catch (cause) {
    mcpError.value =
      cause instanceof Error ? cause.message : 'Failed to revoke access.'
  } finally {
    revokingPubkey.value = ''
  }
}

async function submitGrant() {
  mcpGranting.value = true
  mcpError.value = ''
  try {
    await sync()
    await grantCapability(mcpPubkey.value.trim(), mcpScopes.value)
    grantedPubkey.value = mcpPubkey.value.trim()
    wizardStep.value = 4
    await Promise.all([loadGrants(), loadRemoteTransportInfo()])
  } catch (cause) {
    mcpError.value =
      cause instanceof Error ? cause.message : 'Failed to publish the grant.'
  } finally {
    mcpGranting.value = false
  }
}

// -- local model -------------------------------------------------------

const hostProfile = ref<HostCapabilities | null>(null)
const recommendations = ref<ModelRecommendation[]>([])
const modelStatus = ref<ModelStatus | null>(null)
const modelsLoading = ref(false)
const modelsError = ref('')
const selectedModelId = ref('')
const downloadingModelId = ref('')
const selectingModelId = ref('')
const evalAcknowledged = ref(false)

const selectedRecommendation = computed(() =>
  recommendations.value.find((r) => r.model.id === selectedModelId.value),
)
const selectedIsDownloaded = computed(
  () => modelStatus.value?.selected_model === selectedModelId.value,
)

async function loadModels() {
  modelsLoading.value = true
  modelsError.value = ''
  try {
    await sync()
    const [profile, recommend, status] = await Promise.all([
      getModelProfile(),
      getModelRecommendations(),
      getModelStatus(),
    ])
    hostProfile.value = profile
    recommendations.value = recommend.models
    modelStatus.value = status
    if (!selectedModelId.value && recommendations.value.length) {
      selectedModelId.value = recommendations.value[0].model.id
    }
  } catch (cause) {
    modelsError.value =
      cause instanceof Error ? cause.message : 'Failed to load model catalog.'
  } finally {
    modelsLoading.value = false
  }
}

async function downloadSelectedModel() {
  const recommendation = selectedRecommendation.value
  if (!recommendation) return
  downloadingModelId.value = recommendation.model.id
  modelsError.value = ''
  try {
    await sync()
    await downloadModel(recommendation.model.id, !recommendation.model.deployment_eligible)
    await loadModels()
  } catch (cause) {
    modelsError.value =
      cause instanceof Error ? cause.message : 'Failed to download the model.'
  } finally {
    downloadingModelId.value = ''
  }
}

async function useSelectedModel() {
  const recommendation = selectedRecommendation.value
  if (!recommendation) return
  if (!recommendation.model.deployment_eligible && !evalAcknowledged.value) return
  selectingModelId.value = recommendation.model.id
  modelsError.value = ''
  try {
    await sync()
    await selectModel(recommendation.model.id)
    await Promise.all([loadModels(), loadMode()])
  } catch (cause) {
    modelsError.value =
      cause instanceof Error ? cause.message : 'Failed to switch to this model.'
  } finally {
    selectingModelId.value = ''
  }
}

watch(selectedModelId, () => {
  evalAcknowledged.value = false
})

// -- operation mode ------------------------------------------------------

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
const modeError = ref('')
const modeConfirmChecked = ref(false)

const pendingModeIsDangerous = computed(
  () => MODE_LEVELS.find((m) => m.level === pendingMode.value)?.dangerous ?? false,
)

async function loadMode() {
  modeLoading.value = true
  modeError.value = ''
  try {
    await sync()
    const mode = await getAgentMode()
    currentMode.value = mode.level
    pendingMode.value = mode.level
    modeConfirmChecked.value = false
  } catch (cause) {
    modeError.value =
      cause instanceof Error ? cause.message : 'Failed to load the operation mode.'
  } finally {
    modeLoading.value = false
  }
}

async function applyMode() {
  if (pendingModeIsDangerous.value && !modeConfirmChecked.value) return
  modeApplying.value = true
  modeError.value = ''
  try {
    await sync()
    await setAgentMode(pendingMode.value, modeConfirmChecked.value)
    await loadMode()
  } catch (cause) {
    modeError.value =
      cause instanceof Error ? cause.message : 'Failed to change the operation mode.'
  } finally {
    modeApplying.value = false
  }
}

// -- export & training data ----------------------------------------------

const exportCycles = ref<ExportCycleSummary[]>([])
const exportsLoading = ref(false)
const exportsError = ref('')
const preparingCycleId = ref('')
const preparedCandidates = ref<ExportCandidate[]>([])
const openCandidateId = ref<string | null>(null)

// Suggested community dataset repo -- prefilled as a convenience only; the
// operator can change or clear it, and sharing stays off until they opt in
// and save a token.
const DEFAULT_DATASET_REPO = '0xx0lostcause0xx0/nostrhost-agent'

const contributionSettings = ref<ContributionSettings | null>(null)
const contributionRepo = ref('')
const contributionToken = ref('')
const contributionSaving = ref(false)
const contributionError = ref('')
const submittingCandidateId = ref('')
const submittedCandidateIds = ref<Set<string>>(new Set())
const submittedPullRequestUrls = ref<Record<string, string>>({})

// Automatic submission is a separate, stronger opt-in from having sharing
// configured at all: it makes the resident daemon submit every completed
// cycle itself with no human review. pendingAutoSubmit tracks the Switch's
// value before Apply; autoSubmitConfirmChecked gates turning it on, the same
// pattern as the dangerous operation-mode levels below.
const pendingAutoSubmit = ref(false)
const autoSubmitConfirmChecked = ref(false)

async function loadExports() {
  exportsLoading.value = true
  exportsError.value = ''
  try {
    await sync()
    const [cycles, settings] = await Promise.all([
      listExportableCycles(),
      getContributionSettings(),
    ])
    exportCycles.value = cycles
    contributionSettings.value = settings
    pendingAutoSubmit.value = settings.auto_submit
    autoSubmitConfirmChecked.value = false
    contributionRepo.value = settings.dataset_repo || DEFAULT_DATASET_REPO
  } catch (cause) {
    exportsError.value =
      cause instanceof Error ? cause.message : 'Failed to load export data.'
  } finally {
    exportsLoading.value = false
  }
}

async function prepareCycle(cycleId: string) {
  preparingCycleId.value = cycleId
  exportsError.value = ''
  try {
    await sync()
    const candidate = await runExport(cycleId)
    preparedCandidates.value = [
      candidate,
      ...preparedCandidates.value.filter(
        (c) => c.candidate_file_id !== candidate.candidate_file_id,
      ),
    ]
    openCandidateId.value = candidate.candidate_file_id
  } catch (cause) {
    exportsError.value =
      cause instanceof Error ? cause.message : 'Failed to prepare this cycle for review.'
  } finally {
    preparingCycleId.value = ''
  }
}

async function toggleCandidateOpen(candidateFileId: string) {
  if (openCandidateId.value === candidateFileId) {
    openCandidateId.value = null
    return
  }
  try {
    await sync()
    const fresh = await getExportCandidate(candidateFileId)
    preparedCandidates.value = preparedCandidates.value.map((c) =>
      c.candidate_file_id === candidateFileId ? fresh : c,
    )
    openCandidateId.value = candidateFileId
  } catch (cause) {
    exportsError.value =
      cause instanceof Error ? cause.message : 'Failed to load the prepared candidate.'
  }
}

const turningOnAutoSubmit = computed(
  () => pendingAutoSubmit.value && !contributionSettings.value?.auto_submit,
)

async function saveContributionSettings() {
  if (turningOnAutoSubmit.value && !autoSubmitConfirmChecked.value) return
  contributionSaving.value = true
  contributionError.value = ''
  try {
    await sync()
    const settings = await setContributionSettings(
      contributionRepo.value.trim(),
      pendingAutoSubmit.value,
      contributionToken.value.trim() || undefined,
    )
    contributionSettings.value = settings
    pendingAutoSubmit.value = settings.auto_submit
    autoSubmitConfirmChecked.value = false
    contributionToken.value = ''
  } catch (cause) {
    contributionError.value =
      cause instanceof Error ? cause.message : 'Failed to save sharing settings.'
  } finally {
    contributionSaving.value = false
  }
}

async function submitCandidate(candidateFileId: string) {
  submittingCandidateId.value = candidateFileId
  exportsError.value = ''
  try {
    await sync()
    const result = await submitContribution(candidateFileId)
    submittedCandidateIds.value = new Set([
      ...submittedCandidateIds.value,
      candidateFileId,
    ])
    submittedPullRequestUrls.value = {
      ...submittedPullRequestUrls.value,
      [candidateFileId]: result.pull_request_url,
    }
  } catch (cause) {
    exportsError.value =
      cause instanceof Error ? cause.message : 'Failed to submit this candidate.'
  } finally {
    submittingCandidateId.value = ''
  }
}

onMounted(() => {
  if (publicKey.value) {
    loadAgentStatus()
    loadGrants()
    loadModels()
    loadMode()
    loadExports()
  }
})
watch(publicKey, (key) => {
  if (key) {
    loadAgentStatus()
    loadGrants()
    loadModels()
    loadMode()
    loadExports()
  }
})
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        AI &amp; agent administration
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        AI management
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Control the resident admin agent and grant MCP-connected agents scoped
        access to this node. All actions publish signed events to the control
        relay — there is no password store and no third-party account required.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>

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

        <Alert v-if="agentError" variant="danger" role="alert">{{
          agentError
        }}</Alert>

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

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>MCP agent access</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="grantsLoading"
            @click="loadGrants"
            >{{ grantsLoading ? 'Refreshing…' : 'Refresh' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p class="tw:text-sm tw:text-muted-foreground">
          Grant a Nostr pubkey scoped capabilities so an MCP-connected agent can
          call this node's tools through the signed operation chain. Granting no
          scopes clears an existing grant.
        </p>

        <Alert v-if="grantsError" variant="danger" role="alert">{{
          grantsError
        }}</Alert>

        <div class="tw:grid tw:gap-2">
          <span class="tw:text-sm tw:font-medium tw:text-foreground"
            >Current access</span
          >
          <p
            v-if="grantsLoading && !grants.length"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            Loading…
          </p>
          <p
            v-else-if="!grants.length"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            No agent currently has access.
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
            <li
              v-for="grant in grants"
              :key="grant.pubkey"
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <div
                class="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3"
              >
                <div class="tw:grid tw:gap-1">
                  <code class="tw:font-mono tw:text-xs" :title="grant.pubkey">{{
                    truncatePubkey(grant.pubkey)
                  }}</code>
                  <div class="tw:flex tw:flex-wrap tw:gap-1.5">
                    <code
                      v-for="scope in grant.scopes"
                      :key="scope"
                      class="tw:rounded tw:bg-surface-muted tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[11px] tw:text-muted-foreground"
                      >{{ scope }}</code
                    >
                  </div>
                </div>
                <Badge variant="neutral">{{ grant.type }}</Badge>
              </div>

              <div
                v-if="confirmingRevoke === grant.pubkey"
                class="tw:flex tw:items-center tw:justify-end tw:gap-2"
              >
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Revoke this agent's access?</span
                >
                <Button variant="outline" size="sm" @click="cancelRevokeGrant"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="revokingPubkey !== ''"
                  @click="confirmRevokeGrant(grant.pubkey)"
                  >Confirm</Button
                >
              </div>
              <div v-else class="tw:flex tw:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="revokingPubkey !== ''"
                  @click="requestRevokeGrant(grant.pubkey)"
                  >{{
                    revokingPubkey === grant.pubkey ? 'Revoking…' : 'Revoke'
                  }}</Button
                >
              </div>
            </li>
          </ul>
        </div>

        <div v-if="!wizardOpen" class="tw:flex tw:justify-end">
          <Button variant="primary" size="sm" @click="openWizard"
            >+ Connect an agent</Button
          >
        </div>

        <div
          v-else
          class="tw:grid tw:gap-4 tw:rounded-lg tw:border tw:border-border-subtle tw:p-4"
        >
          <div class="tw:flex tw:gap-1.5">
            <div
              v-for="n in 3"
              :key="n"
              class="tw:h-1 tw:flex-1 tw:rounded-full"
              :class="
                wizardStep >= n ? 'tw:bg-brand-500' : 'tw:bg-surface-muted'
              "
            />
          </div>

          <template v-if="wizardStep === 1">
            <div class="tw:grid tw:gap-1.5">
              <Label for="mcp-pubkey">Agent public key or npub</Label>
              <Input
                id="mcp-pubkey"
                v-model="mcpPubkey"
                spellcheck="false"
                autocomplete="off"
                placeholder="npub1… or 64-char hex"
              />
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                No key yet? On the agent's machine, run
                <code class="tw:font-mono"
                  >yunohost-mcp-connect --generate-key PATH</code
                >
                and paste the printed public key above — key generation stays on
                the agent's side, this node never handles its private key.
              </p>
            </div>
            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button variant="outline" size="sm" @click="closeWizard"
                >Cancel</Button
              >
              <Button
                variant="primary"
                size="sm"
                :disabled="!mcpPubkey.trim()"
                @click="wizardStep = 2"
                >Next: choose access</Button
              >
            </div>
          </template>

          <template v-else-if="wizardStep === 2">
            <div class="tw:grid tw:gap-2">
              <span class="tw:text-sm tw:font-medium tw:text-foreground"
                >Presets</span
              >
              <div class="tw:flex tw:flex-wrap tw:gap-2">
                <Button
                  v-for="preset in SCOPE_PRESETS"
                  :key="preset.id"
                  :variant="
                    selectedPreset === preset.id ? 'primary' : 'outline'
                  "
                  size="sm"
                  @click="choosePreset(preset.id)"
                  >{{ preset.label
                  }}<span v-if="preset.recommended">
                    (recommended)</span
                  ></Button
                >
              </div>
            </div>

            <div class="tw:grid tw:gap-1.5">
              <span class="tw:text-sm tw:font-medium tw:text-foreground">{{
                selectedPreset === 'custom' ? 'Scopes' : 'Included scopes'
              }}</span>
              <div
                v-if="selectedPreset === 'custom'"
                class="tw:grid tw:gap-2 tw:sm:grid-cols-2"
              >
                <label
                  v-for="scope in ALL_SCOPES"
                  :key="scope"
                  class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:text-foreground"
                >
                  <input
                    v-model="mcpScopes"
                    type="checkbox"
                    :value="scope"
                    class="tw:size-4 tw:rounded tw:border-border-subtle"
                  />
                  <code class="tw:font-mono tw:text-xs">{{ scope }}</code>
                  <span class="tw:text-xs tw:text-muted-foreground">{{
                    SCOPE_TOOLS[scope]
                  }}</span>
                </label>
              </div>
              <div v-else class="tw:grid tw:gap-2 tw:sm:grid-cols-2">
                <div
                  v-for="scope in mcpScopes"
                  :key="scope"
                  class="tw:flex tw:items-center tw:gap-2 tw:text-sm tw:text-foreground"
                >
                  <code class="tw:font-mono tw:text-xs">{{ scope }}</code>
                  <span class="tw:text-xs tw:text-muted-foreground">{{
                    SCOPE_TOOLS[scope]
                  }}</span>
                </div>
              </div>
            </div>

            <div class="tw:flex tw:justify-between tw:gap-2">
              <Button variant="outline" size="sm" @click="wizardStep = 1"
                >← Back</Button
              >
              <Button
                variant="primary"
                size="sm"
                :disabled="!mcpScopes.length"
                @click="wizardStep = 3"
                >Next: review</Button
              >
            </div>
          </template>

          <template v-else-if="wizardStep === 3">
            <div
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <span
                class="tw:text-xs tw:font-mono tw:uppercase tw:tracking-wide tw:text-muted-foreground"
                >This will publish a signed capability grant</span
              >
              <p class="tw:m-0 tw:text-sm">
                <code class="tw:font-mono tw:text-xs">{{
                  truncatePubkey(mcpPubkey.trim())
                }}</code>
                will be able to call
                <strong>{{ mcpScopes.length }} tool(s)</strong> governed by:
                <code
                  v-for="scope in mcpScopes"
                  :key="scope"
                  class="tw:mx-0.5 tw:rounded tw:bg-surface-muted tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[11px]"
                  >{{ scope }}</code
                >. It won't be able to do anything outside these scopes, and you
                can revoke this at any time from the list above.
              </p>
            </div>

            <Alert v-if="mcpError" variant="danger" role="alert">{{
              mcpError
            }}</Alert>

            <div class="tw:flex tw:justify-between tw:gap-2">
              <Button variant="outline" size="sm" @click="wizardStep = 2"
                >← Back</Button
              >
              <Button
                variant="primary"
                size="sm"
                :disabled="mcpGranting"
                @click="submitGrant"
                >{{ mcpGranting ? 'Signing…' : 'Sign & grant access' }}</Button
              >
            </div>
          </template>

          <template v-else-if="wizardStep === 4">
            <Alert variant="success">Access granted.</Alert>

            <div class="tw:flex tw:gap-2">
              <Button
                :variant="transportTab === 'local' ? 'primary' : 'outline'"
                size="sm"
                @click="transportTab = 'local'"
                >Local (stdio)</Button
              >
              <Button
                :variant="transportTab === 'remote' ? 'primary' : 'outline'"
                size="sm"
                @click="transportTab = 'remote'"
                >Remote (HTTPS)</Button
              >
            </div>

            <template v-if="transportTab === 'local'">
              <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
                On the agent's machine, run
                <code class="tw:font-mono">yunohost-mcp-connect setup</code>
                pointed at this node's MCP endpoint with the same key (<code
                  class="tw:font-mono tw:text-xs"
                  >{{ truncatePubkey(grantedPubkey) }}</code
                >) to finish connecting it.
              </p>
            </template>

            <template v-else>
              <p
                v-if="mcpEndpointLoading"
                class="tw:m-0 tw:text-sm tw:text-muted-foreground"
              >
                Checking this node's MCP endpoint…
              </p>
              <template v-else-if="mcpEndpoint?.configured">
                <div
                  class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
                >
                  <span
                    class="tw:text-xs tw:font-mono tw:uppercase tw:tracking-wide tw:text-muted-foreground"
                    >Run on the agent's machine</span
                  >
                  <code class="tw:font-mono tw:text-xs"
                    >yunohost-mcp-connect setup --server https://{{
                      mcpEndpoint.domain
                    }}/mcp</code
                  >
                </div>
                <template v-if="caBundle?.available">
                  <Alert variant="info">
                    This endpoint uses a self-signed certificate (a lab/test
                    domain) — the agent's machine needs to trust it before
                    connecting.
                  </Alert>
                  <div class="tw:flex tw:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      @click="downloadCaBundle"
                      >Download CA bundle</Button
                    >
                  </div>
                </template>
                <p v-else class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                  This endpoint uses a public certificate — no extra trust setup
                  needed.
                </p>
              </template>
              <Alert v-else variant="info">
                No MCP endpoint is configured on this node yet. On the node, run
                <code class="tw:font-mono"
                  >nostrhost mcp route &lt;domain&gt;</code
                >
                to route a domain to it, then reopen this step.
              </Alert>
            </template>

            <div class="tw:flex tw:justify-end">
              <Button variant="primary" size="sm" @click="closeWizard"
                >Done</Button
              >
            </div>
          </template>
        </div>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Local model</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="modelsLoading"
            @click="loadModels"
            >{{ modelsLoading ? 'Refreshing…' : 'Refresh' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p class="tw:text-sm tw:text-muted-foreground">
          Run a local model on this node instead of a remote API. Every
          candidate below currently fails the agent's own safety/quality
          gate — they can be downloaded and used for testing (evaluation
          only), but are not recommended for unattended operation.
        </p>

        <Alert v-if="modelsError" variant="danger" role="alert">{{
          modelsError
        }}</Alert>

        <p
          v-if="hostProfile"
          class="tw:m-0 tw:text-xs tw:text-muted-foreground"
        >
          This host: {{ hostProfile.logical_cpus }} CPUs,
          {{ formatBytes(hostProfile.memory_available_bytes) }} available of
          {{ formatBytes(hostProfile.memory_total_bytes) }} RAM,
          {{ formatBytes(hostProfile.model_dir_free_bytes) }} free disk.
        </p>

        <div v-if="recommendations.length" class="tw:grid tw:gap-2">
          <Label for="model-select">Candidate model</Label>
          <Select id="model-select" v-model="selectedModelId">
            <option
              v-for="rec in recommendations"
              :key="rec.model.id"
              :value="rec.model.id"
            >
              {{ rec.model.name }} ({{ formatBytes(rec.model.size_bytes) }})
            </option>
          </Select>

          <template v-if="selectedRecommendation">
            <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <Badge
                :variant="
                  selectedRecommendation.model.deployment_eligible
                    ? 'success'
                    : 'warning'
                "
                >{{ selectedRecommendation.model.evaluation_status }}</Badge
              >
              <Badge
                :variant="
                  selectedRecommendation.assessment.resource_compatible
                    ? 'success'
                    : 'danger'
                "
                >{{
                  selectedRecommendation.assessment.resource_compatible
                    ? 'fits this host'
                    : 'does not fit this host'
                }}</Badge
              >
              <Badge v-if="selectedIsDownloaded" variant="brand"
                >in use</Badge
              >
            </div>
            <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
              {{ selectedRecommendation.model.evaluation_note }}
            </p>

            <div class="tw:flex tw:justify-end tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="
                  !!downloadingModelId ||
                  !selectedRecommendation.assessment.resource_compatible
                "
                @click="downloadSelectedModel"
                >{{
                  downloadingModelId === selectedModelId
                    ? 'Downloading…'
                    : 'Download'
                }}</Button
              >
            </div>

            <template
              v-if="!selectedRecommendation.model.deployment_eligible"
            >
              <label
                class="tw:flex tw:items-start tw:gap-2 tw:text-xs tw:text-foreground"
              >
                <input
                  v-model="evalAcknowledged"
                  type="checkbox"
                  class="tw:mt-0.5 tw:size-4 tw:rounded tw:border-border-subtle"
                />
                <span
                  >I understand this model has not passed the agent's
                  safety/quality gate and is evaluation-only.</span
                >
              </label>
            </template>

            <div class="tw:flex tw:justify-end">
              <Button
                variant="primary"
                size="sm"
                :disabled="
                  !!selectingModelId ||
                  selectedIsDownloaded ||
                  (!selectedRecommendation.model.deployment_eligible &&
                    !evalAcknowledged)
                "
                @click="useSelectedModel"
                >{{
                  selectingModelId === selectedModelId
                    ? 'Switching…'
                    : selectedIsDownloaded
                      ? 'Currently in use'
                      : 'Use this model'
                }}</Button
              >
            </div>
          </template>
        </div>
        <p v-else class="tw:m-0 tw:text-sm tw:text-muted-foreground">
          {{ modelsLoading ? 'Loading…' : 'No candidate models available.' }}
        </p>
      </CardContent>
    </Card>

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

        <Alert v-if="modeError" variant="danger" role="alert">{{
          modeError
        }}</Alert>

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

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Export &amp; training data</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="exportsLoading"
            @click="loadExports"
            >{{ exportsLoading ? 'Refreshing…' : 'Refresh' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p class="tw:text-sm tw:text-muted-foreground">
          Prepare one completed agent decision as a locally-redacted review
          file. Nothing is ever uploaded automatically — sharing is off by
          default, and submitting sends only the single file you review
          below.
        </p>

        <Alert v-if="exportsError" variant="danger" role="alert">{{
          exportsError
        }}</Alert>

        <div class="tw:grid tw:gap-2">
          <span class="tw:text-sm tw:font-medium tw:text-foreground"
            >Completed cycles</span
          >
          <p
            v-if="!exportCycles.length"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            {{
              exportsLoading
                ? 'Loading…'
                : 'No completed agent cycles are ready to export yet.'
            }}
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
            <li
              v-for="cycle in exportCycles"
              :key="cycle.cycle_id"
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <div
                class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"
              >
                <div class="tw:grid tw:gap-1">
                  <span class="tw:text-sm tw:text-foreground">{{
                    cycle.decision === 'no_call' ? 'No action' : cycle.decision
                  }}</span>
                  <span class="tw:text-xs tw:text-muted-foreground">{{
                    cycle.finished_at
                  }}</span>
                </div>
                <Badge variant="neutral">{{ cycle.cycle_result }}</Badge>
              </div>
              <div class="tw:flex tw:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="preparingCycleId === cycle.cycle_id"
                  @click="prepareCycle(cycle.cycle_id)"
                  >{{
                    preparingCycleId === cycle.cycle_id
                      ? 'Preparing…'
                      : 'Prepare for review'
                  }}</Button
                >
              </div>
            </li>
          </ul>
        </div>

        <div v-if="preparedCandidates.length" class="tw:grid tw:gap-2">
          <span class="tw:text-sm tw:font-medium tw:text-foreground"
            >Prepared candidates</span
          >
          <div
            v-for="candidate in preparedCandidates"
            :key="candidate.candidate_file_id"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
              <code class="tw:font-mono tw:text-xs">{{
                candidate.candidate_id
              }}</code>
              <div class="tw:flex tw:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  @click="toggleCandidateOpen(candidate.candidate_file_id)"
                  >{{
                    openCandidateId === candidate.candidate_file_id
                      ? 'Hide'
                      : 'Review'
                  }}</Button
                >
                <Button
                  v-if="
                    contributionSettings?.enabled &&
                    contributionSettings?.token_configured
                  "
                  variant="primary"
                  size="sm"
                  :disabled="
                    submittingCandidateId === candidate.candidate_file_id ||
                    submittedCandidateIds.has(candidate.candidate_file_id)
                  "
                  @click="submitCandidate(candidate.candidate_file_id)"
                  >{{
                    submittedCandidateIds.has(candidate.candidate_file_id)
                      ? 'Submitted'
                      : submittingCandidateId === candidate.candidate_file_id
                        ? 'Submitting…'
                        : 'Submit to Hugging Face'
                  }}</Button
                >
              </div>
            </div>
            <pre
              v-if="openCandidateId === candidate.candidate_file_id"
              class="tw:m-0 tw:max-h-64 tw:overflow-auto tw:rounded tw:bg-surface-muted tw:p-2 tw:text-[11px]"
              >{{ JSON.stringify(candidate, null, 2) }}</pre
            >
            <a
              v-if="submittedPullRequestUrls[candidate.candidate_file_id]"
              :href="submittedPullRequestUrls[candidate.candidate_file_id]"
              target="_blank"
              rel="noopener noreferrer"
              class="tw:text-xs tw:text-brand-500 tw:underline"
              >View the pull request →</a
            >
          </div>
        </div>

        <div
          class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
        >
          <div>
            <p class="tw:text-sm tw:font-medium tw:text-foreground">
              Hugging Face sharing
            </p>
            <p class="tw:text-xs tw:text-muted-foreground">
              Off until a dataset repo and token are saved below. Once
              configured, submitting a candidate above opens a pull request
              with only that one file — never a direct commit, never the raw
              audit journal.
            </p>
          </div>

          <div class="tw:grid tw:gap-1.5">
            <Label for="hf-repo">Dataset repo</Label>
            <Input
              id="hf-repo"
              v-model="contributionRepo"
              placeholder="owner/dataset"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="hf-token">Hugging Face token</Label>
            <Input
              id="hf-token"
              v-model="contributionToken"
              type="password"
              autocomplete="off"
              :placeholder="
                contributionSettings?.token_configured
                  ? 'Token already saved — leave blank to keep it'
                  : 'hf_…'
              "
            />
          </div>

          <div
            class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div>
              <p class="tw:text-sm tw:font-medium tw:text-foreground">
                Automatic submission
              </p>
              <p class="tw:text-xs tw:text-muted-foreground">
                When on, the agent submits every completed cycle itself, the
                moment it finishes — with no human review. The automated
                redaction above is the only privacy check before it becomes a
                public pull request. Off by default; leave off to keep
                reviewing each candidate yourself before submitting.
              </p>
            </div>
            <Switch v-model="pendingAutoSubmit" />
          </div>

          <Alert v-if="turningOnAutoSubmit" variant="danger">
            <p class="tw:m-0">
              Every future completed cycle will be redacted and submitted as
              a pull request automatically, with nobody checking it first.
            </p>
            <label
              class="tw:mt-2 tw:flex tw:items-start tw:gap-2 tw:text-xs tw:text-foreground"
            >
              <input
                v-model="autoSubmitConfirmChecked"
                type="checkbox"
                class="tw:mt-0.5 tw:size-4 tw:rounded tw:border-border-subtle"
              />
              <span
                >I understand submissions will happen automatically with no
                review, and want to proceed.</span
              >
            </label>
          </Alert>

          <Alert v-if="contributionError" variant="danger" role="alert">{{
            contributionError
          }}</Alert>
          <div class="tw:flex tw:justify-end">
            <Button
              variant="primary"
              size="sm"
              :disabled="
                contributionSaving ||
                !contributionRepo.trim() ||
                (turningOnAutoSubmit && !autoSubmitConfirmChecked)
              "
              @click="saveContributionSettings"
              >{{ contributionSaving ? 'Saving…' : 'Save' }}</Button
            >
          </div>
        </div>
      </CardContent>
    </Card>
  </section>
</template>
