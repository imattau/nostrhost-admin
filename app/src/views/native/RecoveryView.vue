<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  applyRollback,
  getReconcilePlan,
  getStateDiff,
  getStateHistory,
  getStateStatus,
  planRollback,
  publishState,
  type RollbackPlan,
  type StateHistoryEntry,
  type StateStatus,
} from '@/api/nativeState'
import { getBackupPolicy, getRestorePoints } from '@/api/nativeBackups'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success, fromOperationError } = useNotifications()

const status = ref<StateStatus | null>(null)
const history = ref<StateHistoryEntry[]>([])
const diff = ref('')
const drift = ref<Record<string, unknown> | null>(null)
const snapshotCount = ref(0)
const scheduleOn = ref(false)

const busy = ref('')
const { run } = useActionRunner(busy, '')

const { loading, load } = useAsyncResource(async () => {
  const [state, hist, reconcile, snapshots, policy] = await Promise.all([
    getStateStatus(),
    getStateHistory(20),
    getReconcilePlan(),
    getRestorePoints(),
    getBackupPolicy(),
  ])
  status.value = state
  history.value = hist.history
  drift.value = reconcile
  snapshotCount.value = snapshots.snapshots.length
  scheduleOn.value = policy.schedule.enabled
  diff.value = ''
}, 'Failed to load recovery state.')

const dirty = computed(() => status.value?.dirty ?? false)
const hasKnownGood = computed(() => Boolean(status.value?.known_good))
const hasSnapshot = computed(() => snapshotCount.value > 0)

async function loadDiff() {
  diff.value = ''
  await run(
    'diff',
    async () => {
      const result = await getStateDiff(status.value?.known_good ?? '')
      diff.value = result.diff || '(no difference)'
    },
    'Failed to compute state diff.',
  )
}

// -- rollback ---------------------------------------------------------------

const plan = ref<RollbackPlan | null>(null)

async function buildPlan() {
  plan.value = null
  await run(
    'plan',
    async () => {
      plan.value = await planRollback()
    },
    (cause) => fromOperationError(cause, 'Failed to generate a rollback plan.'),
  )
}

const {
  pending: confirmingApply,
  request: requestApplyConfirm,
  cancel: cancelApply,
} = useConfirm(false)

async function confirmApply() {
  confirmingApply.value = false
  if (!plan.value) return
  await run(
    'apply',
    async () => {
      await applyRollback(plan.value as RollbackPlan)
      success('Rollback submitted for approval/execution.')
      plan.value = null
      await load()
    },
    (cause) => fromOperationError(cause, 'Failed to apply the rollback plan.'),
  )
}

function stepTone(step: { automatic?: boolean; reversibility?: string }) {
  if (step.automatic) return 'tw:text-foreground'
  if (step.reversibility === 'impossible') return 'tw:text-destructive'
  return 'tw:text-warning'
}

// -- disaster recovery ------------------------------------------------------

async function publish() {
  await run(
    'publish',
    async () => {
      await publishState(false)
      success('State repository replication submitted.')
    },
    (cause) => fromOperationError(cause, 'Failed to publish the state repository.'),
  )
}

async function refresh() {
  await run('refresh', async () => {
    await load()
  }, 'Failed to refresh recovery state.')
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System maintenance"
      title="Recovery"
      description="Configuration-state history (ngit/NIP-34) and assisted rollback. Data files restore from Restic snapshots on the Backups screen."
    />

    <Card v-if="status">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Recovery readiness</span>
          <Button variant="outline" size="sm" :disabled="busy !== ''" @click="refresh">
            {{ busy === 'refresh' ? 'Refreshing…' : 'Refresh' }}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3 tw:text-sm">
        <ul class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
          <li class="tw:flex tw:items-center tw:justify-between">
            <span>Known-good state marked</span>
            <span :class="hasKnownGood ? 'tw:text-foreground' : 'tw:text-warning'">
              {{ hasKnownGood ? status.known_good.slice(0, 16) : 'none' }}
            </span>
          </li>
          <li class="tw:flex tw:items-center tw:justify-between">
            <span>Recovery bundle on host</span>
            <span :class="status.recovery_bundle ? 'tw:text-foreground' : 'tw:text-warning'">
              {{ status.recovery_bundle ? 'present' : 'missing' }}
            </span>
          </li>
          <li class="tw:flex tw:items-center tw:justify-between">
            <span>Restic restore points</span>
            <span :class="hasSnapshot ? 'tw:text-foreground' : 'tw:text-warning'">{{ snapshotCount }}</span>
          </li>
          <li class="tw:flex tw:items-center tw:justify-between">
            <span>Scheduled backups</span>
            <span :class="scheduleOn ? 'tw:text-foreground' : 'tw:text-warning'">
              {{ scheduleOn ? 'enabled' : 'off' }}
            </span>
          </li>
        </ul>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Rebuilding a lost host uses the offline recovery bundle plus the replicated state
          repository and a Restic snapshot — see the runbook in
          <code class="tw:font-mono">docs/admin/backup-and-recovery.md</code>.
        </p>
      </CardContent>
    </Card>

    <Card v-if="status">
      <CardHeader>
        <CardTitle>Configuration state</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3 tw:text-sm">
        <div class="tw:grid tw:gap-1 tw:sm:grid-cols-2">
          <p class="tw:m-0 tw:text-muted-foreground">
            Revision
            <code class="tw:ml-1 tw:font-mono tw:text-foreground">{{
              status.revision ? status.revision.slice(0, 16) : '(none)'
            }}</code>
            <span v-if="dirty" class="tw:ml-2 tw:text-warning">dirty</span>
          </p>
          <p class="tw:m-0 tw:text-muted-foreground">
            Known-good
            <code class="tw:ml-1 tw:font-mono tw:text-foreground">{{
              status.known_good ? status.known_good.slice(0, 16) : '(none)'
            }}</code>
          </p>
        </div>
        <div class="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
          <Button variant="outline" size="sm" :disabled="busy !== ''" @click="loadDiff">
            {{ busy === 'diff' ? 'Diffing…' : 'Diff vs known-good' }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== '' || !hasKnownGood"
            @click="buildPlan"
            >{{ busy === 'plan' ? 'Planning…' : 'Rollback plan' }}</Button
          >
          <Button
            variant="warning"
            size="sm"
            :disabled="busy !== ''"
            @click="publish"
            >{{ busy === 'publish' ? 'Publishing…' : 'Publish state' }}</Button
          >
        </div>
        <pre
          v-if="diff"
          class="tw:max-h-80 tw:overflow-auto tw:rounded-md tw:bg-surface-muted tw:p-3 tw:text-xs"
          >{{ diff }}</pre
        >
      </CardContent>
    </Card>

    <Card v-if="plan">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Rollback plan</span>
          <span class="tw:text-xs tw:font-normal tw:text-muted-foreground">
            {{ plan.summary.total }} step(s) · {{ plan.summary.automatic }} automatic ·
            {{ plan.summary.manual }} manual · {{ plan.summary.restore_required }} restore
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3">
        <p v-if="plan.restic_snapshot" class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          Linked Restic snapshot:
          <code class="tw:font-mono">{{ plan.restic_snapshot.slice(0, 16) }}</code>
        </p>
        <EmptyState
          v-if="plan.steps.length === 0"
          title="Nothing to roll back"
          description="The known-good state matches the current state."
        />
        <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
          <li
            v-for="(step, index) in plan.steps"
            :key="index"
            class="tw:flex tw:items-start tw:justify-between tw:gap-3 tw:rounded-md tw:border tw:border-border-subtle tw:p-2 tw:text-xs"
          >
            <div>
              <code class="tw:font-mono">{{ step.path }}</code>
              <p class="tw:mb-0 tw:mt-1 tw:text-muted-foreground">
                {{ step.action || 'change' }} · {{ step.reversibility || 'unknown' }}
                <span v-if="step.restore_required"> · data restore</span>
              </p>
            </div>
            <span :class="stepTone(step)">{{
              step.automatic ? (step.tool || 'automatic') : 'manual'
            }}</span>
          </li>
        </ul>
        <div class="tw:flex tw:justify-end">
          <Button
            variant="danger"
            size="sm"
            :disabled="busy !== ''"
            @click="requestApplyConfirm(true)"
            >{{ busy === 'apply' ? 'Applying…' : 'Apply rollback' }}</Button
          >
        </div>
      </CardContent>
    </Card>

    <Card v-if="status">
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          v-if="!loading && history.length === 0"
          title="No state revisions yet"
          description="Configuration changes are recorded as the host is reconciled."
        />
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">Loading…</p>
        <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:pl-0 tw:text-sm">
          <li
            v-for="entry in history"
            :key="entry.revision"
            class="tw:flex tw:items-center tw:justify-between tw:gap-3"
          >
            <span class="tw:truncate">
              <code class="tw:font-mono">{{ entry.revision.slice(0, 12) }}</code>
              <span class="tw:ml-2 tw:text-muted-foreground">{{ entry.message }}</span>
            </span>
            <span v-if="entry.known_good" class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
              >known-good</span
            >
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card v-if="drift">
      <CardHeader>
        <CardTitle>Drift (read-only)</CardTitle>
      </CardHeader>
      <CardContent>
        <pre class="tw:max-h-80 tw:overflow-auto tw:rounded-md tw:bg-surface-muted tw:p-3 tw:text-xs">{{
          JSON.stringify(drift, null, 2)
        }}</pre>
        <p v-if="!drift" class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          No drift information available.
        </p>
      </CardContent>
    </Card>

    <ConfirmDialog
      :open="confirmingApply"
      tier="destructive"
      title="Apply this rollback plan?"
      description="Automatic steps run through the signed operation chain; manual steps must be performed by an operator. Data restores from the linked Restic snapshot."
      confirm-label="Apply rollback"
      confirm-phrase="rollback"
      :busy="busy === 'apply'"
      @confirm="confirmApply"
      @cancel="cancelApply"
    />
  </PageLayout>
</template>
