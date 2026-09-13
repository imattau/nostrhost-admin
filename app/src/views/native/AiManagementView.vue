<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import {
  disableAgent,
  enableAgent,
  getAgentStatus,
  initAgent,
  type AgentStatus,
} from '@/api/nativeAgent'
import {
  grantCapability,
  listCapabilities,
  revokeCapability,
  type CapabilityGrant,
} from '@/api/nativeCapability'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSigner } from '@/composables/useSigner'

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

function openWizard() {
  mcpPubkey.value = ''
  mcpError.value = ''
  selectedPreset.value = 'read-only'
  mcpScopes.value = [...SCOPE_PRESETS[0].scopes]
  wizardStep.value = 1
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
    await loadGrants()
  } catch (cause) {
    mcpError.value =
      cause instanceof Error ? cause.message : 'Failed to publish the grant.'
  } finally {
    mcpGranting.value = false
  }
}

onMounted(() => {
  if (publicKey.value) {
    loadAgentStatus()
    loadGrants()
  }
})
watch(publicKey, (key) => {
  if (key) {
    loadAgentStatus()
    loadGrants()
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
            <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
              On the agent's machine, run
              <code class="tw:font-mono">yunohost-mcp-connect setup</code>
              pointed at this node's MCP endpoint with the same key (<code
                class="tw:font-mono tw:text-xs"
                >{{ truncatePubkey(grantedPubkey) }}</code
              >) to finish connecting it.
            </p>
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
          <span>Local models &amp; data sharing</span>
          <Badge variant="warning">Coming soon</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p class="tw:text-sm tw:text-muted-foreground">
          NostrHost does not yet run local models or share usage data with
          Hugging Face — these controls are placeholders for that future work
          and do nothing until it ships.
        </p>
        <div
          class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:opacity-60"
        >
          <div>
            <p class="tw:text-sm tw:font-medium tw:text-foreground">
              Download a local model
            </p>
            <p class="tw:text-xs tw:text-muted-foreground">
              Fetch and run a model on this node instead of a remote API.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>Download</Button>
        </div>
        <div
          class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:opacity-60"
        >
          <div>
            <p class="tw:text-sm tw:font-medium tw:text-foreground">
              Share usage data with Hugging Face
            </p>
            <p class="tw:text-xs tw:text-muted-foreground">
              Opt in to contribute anonymised training data. Off by default.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled>Off</Button>
        </div>
      </CardContent>
    </Card>
  </section>
</template>
