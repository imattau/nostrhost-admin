<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  approveOperation,
  getApprovalTemplate,
  getOperation,
  getRejectionTemplate,
  listOperations,
  rejectOperation,
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
import { useBunkerSigner } from '@/composables/useBunkerSigner'
import { useNotifications } from '@/composables/useNotifications'
import { shortenKey } from '@/lib/utils'

const notifications = useNotifications()
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

onMounted(() => {
  tryReconnectSaved()
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

const confirmingReject = ref<string | null>(null)

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  operations.value = await listOperations(200)
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
  busy.value = `approve-${requestId}`
  try {
    await sync()
    const event = await signDecision('approval', requestId, undefined)
    await approveOperation(requestId, undefined, event)
    notifications.success(
      event
        ? `Approved ${requestId} with your remote signer.`
        : `Approved ${requestId}.`,
    )
    await load()
  } catch (cause) {
    notifications.fromOperationError(cause, `Failed to approve ${requestId}.`)
  } finally {
    busy.value = ''
  }
}

async function confirmReject() {
  const requestId = confirmingReject.value
  if (!requestId) return
  confirmingReject.value = null
  busy.value = `reject-${requestId}`
  try {
    await sync()
    const event = await signDecision('rejection', requestId, undefined)
    await rejectOperation(requestId, undefined, event)
    notifications.success(`Rejected ${requestId}.`)
    await load()
  } catch (cause) {
    notifications.fromOperationError(cause, `Failed to reject ${requestId}.`)
  } finally {
    busy.value = ''
  }
}

const expanded = ref<string | null>(null)
const expandedDetail = ref<OperationEntry | null>(null)

async function toggleExpanded(requestId: string) {
  if (expanded.value === requestId) {
    expanded.value = null
    return
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
          <CardTitle>Remote signer</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-2">
          <p class="tw:text-xs tw:text-muted-foreground">
            Connect a NIP-46 bunker to sign approvals/rejections yourself
            instead of the server's admin key. This browser's connection is
            separate from any bunker saved on the portal's account page.
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
                  <dd class="tw:break-all tw:font-mono tw:text-foreground">
                    {{ JSON.stringify(expandedDetail) }}
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
      @cancel="confirmingReject = null"
    />
  </PageLayout>
</template>
