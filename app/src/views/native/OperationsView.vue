<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  approveOperation,
  getOperation,
  listOperations,
  rejectOperation,
  type OperationEntry,
  type OperationState,
} from '@/api/nativeOperations'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { shortenKey } from '@/lib/utils'

const { publicKey, sync } = useSigner()
const notifications = useNotifications()

const operations = ref<OperationEntry[] | null>(null)
const loading = ref(false)
const error = ref('')
const filter = ref<'all' | 'pending' | OperationState>('all')
const busy = ref('')

const confirmingReject = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    operations.value = await listOperations(200)
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load operations.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})

const filteredOperations = computed(() => {
  const all = operations.value ?? []
  if (filter.value === 'all') return all
  if (filter.value === 'pending') return all.filter((op) => op.state === 'REQUESTED')
  return all.filter((op) => op.state === filter.value)
})

const pendingCount = computed(
  () => (operations.value ?? []).filter((op) => op.state === 'REQUESTED').length,
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
    await approveOperation(requestId)
    notifications.success(`Approved ${requestId}.`)
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
    await rejectOperation(requestId)
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

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle>{{ operations?.length ?? 0 }} operation(s)</CardTitle>
          <template #actions>
            <Badge v-if="pendingCount" variant="warning">{{ pendingCount }} pending approval</Badge>
            <Button variant="outline" size="sm" :disabled="loading" @click="load">{{
              loading ? 'Refreshing…' : 'Refresh'
            }}</Button>
          </template>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <div class="tw:flex tw:flex-wrap tw:gap-2">
            <Button
              v-for="option in (['all', 'pending', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'REJECTED'] as const)"
              :key="option"
              :variant="filter === option ? 'primary' : 'outline'"
              size="sm"
              @click="filter = option"
              >{{ option === 'all' ? 'All' : option === 'pending' ? 'Pending' : option }}</Button
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
                  <span class="tw:font-mono tw:text-[11px] tw:text-muted-foreground">{{
                    op.pubkey ? shortenKey(op.pubkey) : 'unknown signer'
                  }}</span>
                </span>
                <Badge :variant="stateVariant(op.state)">{{ op.state }}</Badge>
              </button>

              <dl
                v-if="expanded === op.request_id"
                class="tw:grid tw:gap-x-4 tw:gap-y-1 tw:rounded-md tw:bg-surface-muted tw:p-3 tw:text-xs tw:sm:grid-cols-[auto_1fr]"
              >
                <dt class="tw:font-semibold tw:text-muted-foreground">Request ID</dt>
                <dd class="tw:break-all tw:font-mono tw:text-foreground">{{ op.request_id }}</dd>
                <dt class="tw:font-semibold tw:text-muted-foreground">Submitted</dt>
                <dd class="tw:text-foreground">
                  {{ op.created_at ? new Date(op.created_at * 1000).toLocaleString() : 'unknown' }}
                </dd>
                <template v-if="expandedDetail">
                  <dt class="tw:font-semibold tw:text-muted-foreground">Result</dt>
                  <dd class="tw:break-all tw:font-mono tw:text-foreground">
                    {{ JSON.stringify(expandedDetail) }}
                  </dd>
                </template>
              </dl>

              <div v-if="op.state === 'REQUESTED'" class="tw:flex tw:justify-end tw:gap-2">
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
                  >{{ busy === `approve-${op.request_id}` ? 'Approving…' : 'Approve' }}</Button
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
