<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  approveOperation,
  getApprovalTemplate,
  getNotifySignerPairing,
  getOperation,
  getRejectionTemplate,
  listNotifySigners,
  listOperations,
  registerNotifySigner,
  rejectOperation,
  removeNotifySigner,
  startNotifySignerPairing,
  type NotifySignerPairing,
  type NotifySigners,
  type OperationEntry,
  type OperationState,
  type SignedEvent,
} from '@/api/nativeOperations'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import { useAsyncResource } from '@/composables/useAsyncResource'
import {
  renderNostrConnectQr,
  useBunkerSigner,
} from '@/composables/useBunkerSigner'
import { useNotifications } from '@/composables/useNotifications'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { shortenKey } from '@/lib/utils'

const notifications = useNotifications()
const route = useRoute()
const router = useRouter()
const {
  connected: bunkerConnected,
  remoteNpub: bunkerRemoteNpub,
  busy: bunkerBusy,
  error: bunkerError,
  tryReconnectSaved,
  connectBunker: connectBunkerSigner,
  disconnectBunker: disconnectBunkerSigner,
  signTemplate,
} = useBunkerSigner()
const bunkerInput = ref('')

// Whether the node itself pushes parked approvals to a remote signer, so this
// page can tell an admin that their signer may be prompted without the
// console open (see `nostrhost notify signer pair`).
const nodeSigners = ref<NotifySigners | null>(null)

async function loadNodeSigners() {
  try {
    nodeSigners.value = await listNotifySigners()
  } catch {
    nodeSigners.value = null
  }
}

// Node-side registration: the node (not this browser) pushes parked approvals
// to the admin's own remote signer, so approvals work from any session.
const nodeSignerInput = ref('')
const nodeSignerLabel = ref('')
const nodeSignerBusy = ref('')
const nodeSignerError = ref('')
const pairing = ref<NotifySignerPairing | null>(null)
const pairingQr = ref('')
let pairingTimer: ReturnType<typeof setInterval> | undefined

const ownPubkey = computed(() => (publicKey.value ?? '').toLowerCase())
const isOwnTarget = (pubkey: string) => pubkey.toLowerCase() === ownPubkey.value

async function registerNodeSigner() {
  const uri = nodeSignerInput.value.trim()
  if (!uri) return
  nodeSignerBusy.value = 'register'
  nodeSignerError.value = ''
  try {
    nodeSigners.value = await registerNotifySigner(
      uri,
      nodeSignerLabel.value.trim() || undefined,
    )
    nodeSignerInput.value = ''
    nodeSignerLabel.value = ''
    notifications.success('Remote signer registered with the node.')
  } catch (cause) {
    nodeSignerError.value =
      cause instanceof Error
        ? cause.message
        : 'Could not register that remote signer.'
  } finally {
    nodeSignerBusy.value = ''
  }
}

async function removeNodeSigner(signerPubkey: string) {
  if (!window.confirm('Stop pushing approvals to this remote signer?')) return
  nodeSignerBusy.value = `remove-${signerPubkey}`
  nodeSignerError.value = ''
  try {
    await removeNotifySigner(signerPubkey)
    await loadNodeSigners()
    notifications.success('Remote signer removed.')
  } catch (cause) {
    nodeSignerError.value =
      cause instanceof Error
        ? cause.message
        : 'Could not remove that remote signer.'
  } finally {
    nodeSignerBusy.value = ''
  }
}

async function startPairing() {
  stopPairingPoll()
  nodeSignerBusy.value = 'pair'
  nodeSignerError.value = ''
  try {
    const started = await startNotifySignerPairing()
    pairing.value = started
    pairingQr.value = await renderNostrConnectQr(started.uri)
    notifications.info(
      'Scan the QR with your signer app to authorise this node.',
    )
    pairingTimer = setInterval(pollPairing, 3000)
  } catch (cause) {
    nodeSignerError.value =
      cause instanceof Error
        ? cause.message
        : 'Could not start the signer pairing.'
  } finally {
    nodeSignerBusy.value = ''
  }
}

async function pollPairing() {
  const current = pairing.value
  if (!current || current.status !== 'pending') return
  try {
    const next = await getNotifySignerPairing(current.pairing_id)
    pairing.value = next
    if (next.status === 'paired') {
      stopPairingPoll()
      await loadNodeSigners()
      notifications.success(
        'Remote signer paired. Approvals will now reach it without this browser.',
      )
    } else if (next.status !== 'pending') {
      stopPairingPoll()
      if (next.error) nodeSignerError.value = next.error
    }
  } catch {
    // transient; the next tick retries
  }
}

function stopPairingPoll() {
  if (pairingTimer) {
    clearInterval(pairingTimer)
    pairingTimer = undefined
  }
}

function cancelPairing() {
  stopPairingPoll()
  pairing.value = null
  pairingQr.value = ''
}

let pollTimer: ReturnType<typeof setInterval> | undefined

// Keep the list live while the page is open: approvals may be pushed to a
// signer and executed by the node without any interaction in this tab.
async function refreshQuietly() {
  if (document.visibilityState !== 'visible' || busy.value) return
  try {
    operations.value = await listOperations(200)
  } catch {
    // transient; the next tick or an explicit Refresh retries
  }
}

onMounted(() => {
  tryReconnectSaved()
  pollTimer = setInterval(refreshQuietly, 15000)
  document.addEventListener('visibilitychange', refreshQuietly)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  stopPairingPoll()
  document.removeEventListener('visibilitychange', refreshQuietly)
})

async function connectBunker() {
  if (!bunkerInput.value.trim()) return
  try {
    await connectBunkerSigner(bunkerInput.value.trim())
    bunkerInput.value = ''
    notifications.success('Remote signer connected.')
  } catch (cause) {
    notifications.danger(
      cause instanceof Error
        ? cause.message
        : 'Could not connect to that remote signer.',
    )
  }
}

async function disconnectBunker() {
  await disconnectBunkerSigner()
}

// Fetches the exact event the connected bunker must sign, has it sign, and
// returns it ready to submit - or undefined if no bunker is connected, in
// which case the caller falls back to letting the server sign with its own
// key.
async function signDecision(
  kind: 'approval' | 'rejection',
  requestId: string,
  note: string | undefined,
): Promise<SignedEvent | undefined> {
  if (!bunkerConnected.value) return undefined
  const template =
    kind === 'approval'
      ? await getApprovalTemplate(requestId, note)
      : await getRejectionTemplate(requestId, note)
  return (await signTemplate(template)) as SignedEvent
}

const operations = ref<OperationEntry[] | null>(null)
const filter = ref<'all' | 'pending' | OperationState>('all')
const busy = ref('')
const { run } = useActionRunner(busy, '')

const { pending: confirmingReject } = useConfirm<string | null>(null)
const rejectReason = ref('')

const nodeSignerStatus = computed(() => {
  const info = nodeSigners.value
  if (!info) return ''
  if (info.this_admin)
    return 'The node pushes parked approvals to your remote signer.'
  if (info.remote)
    return "The node pushes parked approvals to another admin's signer."
  return 'No remote signer is registered with the node; approvals made here are signed in this browser or by the server key.'
})

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  await loadNodeSigners()
  operations.value = await listOperations(200)
  const requested = route.query.operation
  if (typeof requested === 'string' && expanded.value !== requested) {
    await toggleExpanded(requested)
  }
}, 'Failed to load operations.')

const filteredOperations = computed(() => {
  const all = operations.value ?? []
  if (filter.value === 'all') return all
  if (filter.value === 'pending')
    return all.filter((op) => op.state === 'REQUESTED')
  return all.filter((op) => op.state === filter.value)
})

const pendingCount = computed(
  () =>
    (operations.value ?? []).filter((op) => op.state === 'REQUESTED').length,
)

function stateVariant(state: OperationState) {
  if (state === 'SUCCEEDED') return 'success'
  if (state === 'FAILED' || state === 'REJECTED') return 'danger'
  if (state === 'EXECUTING' || state === 'APPROVED') return 'warning'
  return 'neutral'
}

async function approve(requestId: string) {
  await run(
    `approve-${requestId}`,
    async () => {
      await sync()
      const event = await signDecision('approval', requestId, undefined)
      await approveOperation(requestId, undefined, event)
      notifications.info(
        event
          ? `Approval for ${requestId} was submitted with your remote signer. Refreshing for executor confirmation.`
          : `Approval for ${requestId} was submitted. Refreshing for executor confirmation.`,
      )
      await load()
    },
    (cause) =>
      notifications.fromOperationError(
        cause,
        `Failed to approve ${requestId}.`,
      ),
  )
}

async function confirmReject() {
  const requestId = confirmingReject.value
  if (!requestId) return
  confirmingReject.value = null
  const reason = rejectReason.value.trim() || undefined
  rejectReason.value = ''
  await run(
    `reject-${requestId}`,
    async () => {
      await sync()
      const event = await signDecision('rejection', requestId, reason)
      await rejectOperation(requestId, reason, event)
      notifications.info(
        `Rejection for ${requestId} was submitted. Refreshing for executor confirmation.`,
      )
      await load()
    },
    (cause) =>
      notifications.fromOperationError(cause, `Failed to reject ${requestId}.`),
  )
}

function cancelReject() {
  confirmingReject.value = null
  rejectReason.value = ''
}

const expanded = ref<string | null>(null)
const expandedDetail = ref<OperationEntry | null>(null)

async function toggleExpanded(requestId: string) {
  if (expanded.value === requestId) {
    expanded.value = null
    expandedDetail.value = null
    await router.replace({ query: { ...route.query, operation: undefined } })
    return
  }
  if (route.query.operation !== requestId) {
    await router.replace({ query: { ...route.query, operation: requestId } })
  }
  expanded.value = requestId
  expandedDetail.value = null
  try {
    expandedDetail.value = await getOperation(requestId)
  } catch (cause) {
    notifications.danger(
      cause instanceof Error ? cause.message : `Failed to load ${requestId}.`,
    )
  }
}

watch(
  () => route.query.operation,
  async (requestId) => {
    if (typeof requestId !== 'string' || expanded.value === requestId) return
    await toggleExpanded(requestId)
  },
)
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Operations"
      title="History &amp; approvals"
      description="Every signed write this console (or another caller) has submitted, with its outcome. Requests parked for approval can be approved or rejected here."
    />

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle>Remote signer (this browser)</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-2">
          <p class="tw:text-xs tw:text-muted-foreground">
            Connect a NIP-46 bunker to sign approvals/rejections yourself
            instead of the server's admin key. This browser's connection is
            separate from any bunker saved on the portal's account page; to
            approve without this browser open, register the node below.
          </p>
          <Alert v-if="bunkerError" variant="danger" role="alert">{{
            bunkerError
          }}</Alert>
          <div
            v-if="bunkerConnected"
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span class="tw:font-mono tw:text-xs tw:text-foreground">{{
              bunkerRemoteNpub
            }}</span>
            <Button variant="outline" size="sm" @click="disconnectBunker"
              >Disconnect</Button
            >
          </div>
          <div v-else class="tw:flex tw:flex-wrap tw:gap-2">
            <input
              v-model="bunkerInput"
              aria-label="Remote signer address"
              class="tw:min-w-0 tw:flex-1 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
              placeholder="bunker:// or NIP-05 signer"
              autocomplete="off"
            />
            <Button
              variant="outline"
              size="sm"
              :disabled="bunkerBusy || !bunkerInput.trim()"
              @click="connectBunker"
              >Connect</Button
            >
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approve from anywhere</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p class="tw:text-xs tw:text-muted-foreground">
            Register this node with your own remote signer so parked approvals
            are pushed to it and can be signed from any browser/session, even
            with this console closed. Only your own admin identity can be
            registered, and your signer still confirms every signature.
          </p>
          <p
            v-if="nodeSignerStatus"
            class="tw:text-xs tw:text-muted-foreground"
          >
            {{ nodeSignerStatus }}
          </p>
          <Alert v-if="nodeSignerError" variant="danger" role="alert">{{
            nodeSignerError
          }}</Alert>

          <ul
            v-if="nodeSigners?.targets.length"
            class="tw:grid tw:gap-2 tw:list-none tw:p-0"
          >
            <li
              v-for="target in nodeSigners.targets"
              :key="target.signer_pubkey"
              class="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:border-border-subtle tw:p-3"
            >
              <div class="tw:min-w-0">
                <p class="tw:text-sm tw:font-semibold tw:text-foreground">
                  {{ target.label || 'Remote signer' }}
                </p>
                <p class="tw:break-all tw:font-mono tw:text-xs tw:opacity-70">
                  {{ shortenKey(target.signer_pubkey) }}
                </p>
                <p class="tw:break-all tw:text-xs tw:opacity-60">
                  {{ target.relays.join(', ') }}
                </p>
              </div>
              <Button
                v-if="isOwnTarget(target.signer_pubkey)"
                variant="outline"
                size="sm"
                :disabled="nodeSignerBusy !== ''"
                @click="removeNodeSigner(target.signer_pubkey)"
                >Remove</Button
              >
            </li>
          </ul>

          <div class="tw:grid tw:gap-2">
            <input
              v-model="nodeSignerInput"
              aria-label="Remote signer bunker URI"
              class="tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
              placeholder="bunker:// URI of your signer"
              autocomplete="off"
            />
            <div class="tw:flex tw:flex-wrap tw:gap-2">
              <Button
                variant="primary"
                size="sm"
                :disabled="nodeSignerBusy !== '' || !nodeSignerInput.trim()"
                @click="registerNodeSigner"
                >{{
                  nodeSignerBusy === 'register' ? 'Registering…' : 'Register'
                }}</Button
              >
              <Button
                variant="outline"
                size="sm"
                :disabled="
                  nodeSignerBusy !== '' || pairing?.status === 'pending'
                "
                @click="startPairing"
                >{{
                  nodeSignerBusy === 'pair' ? 'Starting…' : 'Pair with QR'
                }}</Button
              >
            </div>
          </div>

          <div
            v-if="pairing"
            class="tw:grid tw:justify-items-center tw:gap-2 tw:rounded-md tw:border tw:border-border-subtle tw:p-3"
          >
            <img
              v-if="pairingQr"
              :src="pairingQr"
              alt="Scan this QR code with your signer app"
              class="tw:h-60 tw:w-60"
            />
            <p class="tw:break-all tw:text-center tw:text-xs tw:opacity-70">
              {{ pairing.uri }}
            </p>
            <p class="tw:text-xs tw:text-muted-foreground">
              Status: <span class="tw:font-semibold">{{ pairing.status }}</span>
              <template v-if="pairing.error"> — {{ pairing.error }}</template>
            </p>
            <Button variant="outline" size="sm" @click="cancelPairing"
              >Cancel</Button
            >
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ operations?.length ?? 0 }} operation(s)</CardTitle>
          <template #actions>
            <Badge v-if="pendingCount" variant="warning"
              >{{ pendingCount }} pending approval</Badge
            >
            <Button
              variant="outline"
              size="sm"
              :disabled="loading"
              @click="load"
              >{{ loading ? 'Refreshing…' : 'Refresh' }}</Button
            >
          </template>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <div class="tw:flex tw:flex-wrap tw:gap-2">
            <Button
              v-for="option in [
                'all',
                'pending',
                'EXECUTING',
                'SUCCEEDED',
                'FAILED',
                'REJECTED',
              ] as const"
              :key="option"
              :variant="filter === option ? 'primary' : 'outline'"
              size="sm"
              @click="filter = option"
              >{{
                option === 'all'
                  ? 'All'
                  : option === 'pending'
                    ? 'Pending'
                    : option
              }}</Button
            >
          </div>

          <EmptyState
            v-if="!loading && filteredOperations.length === 0"
            title="No operations to show"
            description="Writes made through this console (or another caller) will show up here with their outcome."
          />

          <ul v-else class="tw:grid tw:gap-2">
            <li
              v-for="op in filteredOperations"
              :key="op.id"
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <button
                type="button"
                class="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:[font:inherit]"
                @click="toggleExpanded(op.request_id)"
              >
                <span class="tw:flex tw:flex-col tw:gap-0.5">
                  <code class="tw:font-mono tw:text-sm tw:text-foreground">{{
                    op.tool ?? op.request_id
                  }}</code>
                  <span
                    class="tw:font-mono tw:text-[11px] tw:text-muted-foreground"
                    >{{
                      op.pubkey ? shortenKey(op.pubkey) : 'unknown signer'
                    }}</span
                  >
                </span>
                <Badge :variant="stateVariant(op.state)">{{ op.state }}</Badge>
              </button>

              <dl
                v-if="expanded === op.request_id"
                class="tw:grid tw:gap-x-4 tw:gap-y-1 tw:rounded-md tw:bg-surface-muted tw:p-3 tw:text-xs tw:sm:grid-cols-[auto_1fr]"
              >
                <dt class="tw:font-semibold tw:text-muted-foreground">
                  Request ID
                </dt>
                <dd class="tw:break-all tw:font-mono tw:text-foreground">
                  {{ op.request_id }}
                </dd>
                <dt class="tw:font-semibold tw:text-muted-foreground">
                  Submitted
                </dt>
                <dd class="tw:text-foreground">
                  {{
                    op.created_at
                      ? new Date(op.created_at * 1000).toLocaleString()
                      : 'unknown'
                  }}
                </dd>
                <template v-if="expandedDetail">
                  <dt class="tw:font-semibold tw:text-muted-foreground">
                    Result
                  </dt>
                  <dd class="tw:break-all tw:text-foreground">
                    <pre
                      class="tw:whitespace-pre-wrap tw:font-mono tw:text-xs"
                      >{{ JSON.stringify(expandedDetail, null, 2) }}</pre
                    >
                  </dd>
                </template>
              </dl>

              <div
                v-if="op.state === 'REQUESTED'"
                class="tw:flex tw:justify-end tw:gap-2"
              >
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmingReject = op.request_id"
                  >Reject</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="approve(op.request_id)"
                  >{{
                    busy === `approve-${op.request_id}`
                      ? 'Approving…'
                      : 'Approve'
                  }}</Button
                >
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <ConfirmDialog
      :open="confirmingReject !== null"
      tier="disruptive"
      title="Reject this operation?"
      description="The requester will need to submit it again if they still want it applied."
      confirm-label="Reject"
      :busy="confirmingReject !== null && busy === `reject-${confirmingReject}`"
      @confirm="confirmReject"
      @cancel="cancelReject"
    >
      <label
        for="reject-reason"
        class="tw:mb-1 tw:block tw:text-xs tw:font-medium tw:text-muted-foreground"
        >Reason (optional, recorded in the audit trail)</label
      >
      <textarea
        id="reject-reason"
        v-model="rejectReason"
        rows="2"
        class="tw:w-full tw:rounded-lg tw:border tw:border-border-subtle tw:bg-background tw:px-3 tw:py-2 tw:text-sm tw:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500"
      />
    </ConfirmDialog>
  </PageLayout>
</template>
