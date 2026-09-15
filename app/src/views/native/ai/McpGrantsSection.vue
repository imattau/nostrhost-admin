<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

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
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { truncatePubkey } from '@/lib/utils'
import { toErrorMessage } from '@/utils/errors'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'

// Curated subset of the scopes defined in nostrhost-yunohost's
// nostr_operations.py (SCOPE_*), each mapped to the tool(s) it governs —
// the scope string alone doesn't say what it unlocks (e.g. "catalog.inspect"
// governs catalog.list/catalog.get, not a tool named "catalog.inspect").
const SCOPE_TOOLS: Record<string, string> = {
  'server.read': 'system.status',
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
      'server.read',
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
      'server.read',
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

const { publicKey, sync } = useSigner()
const { success, danger } = useNotifications()

const mcpPubkey = ref('')
const mcpScopes = ref<string[]>([])
const mcpGranting = ref(false)

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
const confirmingRevoke = ref<string | null>(null)
const revokingPubkey = ref('')

async function loadGrants() {
  grantsLoading.value = true
  try {
    await sync()
    const result = await listCapabilities()
    grants.value = result.grants
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load current access.'))
  } finally {
    grantsLoading.value = false
  }
}

function requestRevokeGrant(pubkey: string) {
  confirmingRevoke.value = pubkey
}

function cancelRevokeGrant() {
  confirmingRevoke.value = null
}

async function confirmRevokeGrant(pubkey: string) {
  confirmingRevoke.value = null
  revokingPubkey.value = pubkey
  try {
    await sync()
    await revokeCapability(pubkey)
    success('Revoked access.')
    await loadGrants()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to revoke access.'))
  } finally {
    revokingPubkey.value = ''
  }
}

async function submitGrant() {
  mcpGranting.value = true
  try {
    await sync()
    await grantCapability(mcpPubkey.value.trim(), mcpScopes.value)
    grantedPubkey.value = mcpPubkey.value.trim()
    wizardStep.value = 4
    await Promise.all([loadGrants(), loadRemoteTransportInfo()])
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to publish the grant.'))
  } finally {
    mcpGranting.value = false
  }
}

onMounted(() => {
  if (publicKey.value) loadGrants()
})
watch(publicKey, (key) => {
  if (key) loadGrants()
})
</script>

<template>
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

            <div class="tw:flex tw:justify-end">
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

  <ConfirmDialog
    :open="confirmingRevoke !== null"
    tier="disruptive"
    title="Revoke this agent's access?"
    description="The connected agent loses every scope it was granted. It can be re-granted access later."
    confirm-label="Revoke"
    :busy="revokingPubkey === confirmingRevoke"
    @confirm="confirmRevokeGrant(confirmingRevoke!)"
    @cancel="cancelRevokeGrant"
  />
</template>
