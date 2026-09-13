<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import {
  disableAgent,
  enableAgent,
  getAgentStatus,
  initAgent,
  type AgentStatus,
} from '@/api/nativeAgent'
import { grantCapability, revokeCapability } from '@/api/nativeCapability'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSigner } from '@/composables/useSigner'

// Curated subset of the scopes defined in nostrhost-yunohost's
// nostr_operations.py (SCOPE_*) — read-heavy defaults so granting an MCP
// agent access doesn't default to write/delete capabilities.
const AVAILABLE_SCOPES = [
  'system.read',
  'services.read',
  'services.restart',
  'apps.read',
  'catalog.inspect',
  'logs.read',
  'audit.read',
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
const mcpResult = ref('')

async function submitGrant() {
  mcpGranting.value = true
  mcpError.value = ''
  mcpResult.value = ''
  try {
    await sync()
    await grantCapability(mcpPubkey.value.trim(), mcpScopes.value)
    mcpResult.value = mcpScopes.value.length
      ? `Granted ${mcpScopes.value.length} scope(s) to this pubkey.`
      : 'Cleared this pubkey’s capability grant.'
  } catch (cause) {
    mcpError.value =
      cause instanceof Error ? cause.message : 'Failed to publish the grant.'
  } finally {
    mcpGranting.value = false
  }
}

async function submitRevoke() {
  mcpGranting.value = true
  mcpError.value = ''
  mcpResult.value = ''
  try {
    await sync()
    await revokeCapability(mcpPubkey.value.trim())
    mcpScopes.value = []
    mcpResult.value = 'Cleared this pubkey’s capability grant.'
  } catch (cause) {
    mcpError.value =
      cause instanceof Error ? cause.message : 'Failed to publish the revoke.'
  } finally {
    mcpGranting.value = false
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
        <CardTitle>MCP agent access</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p class="tw:text-sm tw:text-muted-foreground">
          Grant a Nostr pubkey scoped capabilities so an MCP-connected agent can
          call this node's tools through the signed operation chain. Capability
          grants are relay events keyed by pubkey — granting no scopes clears an
          existing grant, and there is no local list of past grants to browse
          back.
        </p>

        <div class="tw:grid tw:gap-1.5">
          <Label for="mcp-pubkey">Agent public key or npub</Label>
          <Input
            id="mcp-pubkey"
            v-model="mcpPubkey"
            spellcheck="false"
            autocomplete="off"
            placeholder="npub1… or 64-char hex"
          />
        </div>

        <div class="tw:grid tw:gap-1.5">
          <span class="tw:text-sm tw:font-medium tw:text-foreground"
            >Scopes</span
          >
          <div class="tw:grid tw:gap-2 tw:sm:grid-cols-2">
            <label
              v-for="scope in AVAILABLE_SCOPES"
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
            </label>
          </div>
        </div>

        <Alert v-if="mcpError" variant="danger" role="alert">{{
          mcpError
        }}</Alert>
        <Alert v-if="mcpResult" variant="success">{{ mcpResult }}</Alert>

        <div class="tw:flex tw:justify-end tw:gap-2">
          <Button
            variant="outline"
            :disabled="mcpGranting || !mcpPubkey.trim()"
            @click="submitRevoke"
            >{{ mcpGranting ? 'Working…' : 'Revoke access' }}</Button
          >
          <Button
            variant="primary"
            :disabled="mcpGranting || !mcpPubkey.trim() || !mcpScopes.length"
            @click="submitGrant"
            >{{ mcpGranting ? 'Granting…' : 'Grant access' }}</Button
          >
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
