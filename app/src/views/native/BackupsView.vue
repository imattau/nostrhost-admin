<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  checkBackup,
  createBackup,
  deleteBackup,
  getBackupPolicy,
  getBackupSchedule,
  getBackupStats,
  getRestorePoints,
  restoreBackup,
  setBackupPolicy,
  type BackupPolicy,
  type BackupSchedule,
  type BackupStats,
  type RestorePoint,
} from '@/api/nativeBackups'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import { parseList } from '@/lib/utils'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success, fromOperationError } = useNotifications()

const points = ref<RestorePoint[]>([])
const policy = ref<BackupPolicy | null>(null)
const schedule = ref<BackupSchedule | null>(null)
const stats = ref<BackupStats | null>(null)

const busy = ref('')
const { run } = useActionRunner(busy, '')

const { loading, load } = useAsyncResource(async () => {
  const [list, pol, sched, st] = await Promise.all([
    getRestorePoints(),
    getBackupPolicy(),
    getBackupSchedule(),
    getBackupStats(),
  ])
  points.value = list.snapshots
  policy.value = pol
  schedule.value = sched
  stats.value = st
}, 'Failed to load backups.')

const rows = computed(() =>
  [...points.value].sort((a, b) =>
    String(b.time ?? '').localeCompare(String(a.time ?? '')),
  ),
)

function shortId(point: RestorePoint) {
  return point.short_id || point.id.slice(0, 8)
}

function formatSize(size?: number) {
  if (typeof size !== 'number' || size <= 0) return '—'
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < units.length - 1)
  return `${value.toFixed(1)} ${units[unit]}`
}

function pathSummary(point: RestorePoint) {
  const paths = point.paths ?? []
  if (!paths.length) return 'configured paths'
  return paths.length <= 3 ? paths.join(', ') : `${paths.slice(0, 3).join(', ')} +${paths.length - 3}`
}

// -- integrity check / stats ------------------------------------------------

async function runCheck() {
  await run(
    'check',
    async () => {
      await checkBackup()
      success('Repository integrity check passed.')
    },
    'Repository integrity check failed.',
  )
}

// -- create -----------------------------------------------------------------

const showCreate = ref(false)
const createPaths = ref('')
const createTag = ref('')
const { pending: confirmingCreate, request: requestCreateConfirm } = useConfirm(false)

async function confirmCreate() {
  confirmingCreate.value = false
  await run(
    'create',
    async () => {
      await createBackup({
        paths: parseList(createPaths.value),
        tag: createTag.value.trim(),
      })
      success('Backup snapshot submitted.')
      showCreate.value = false
      createPaths.value = ''
      createTag.value = ''
      await load()
    },
    'Failed to create backup.',
  )
}

// -- restore ----------------------------------------------------------------

const {
  pending: confirmingRestore,
  request: requestRestoreConfirm,
  cancel: cancelRestore,
} = useConfirm<RestorePoint | null>(null)

function requestRestore(point: RestorePoint) {
  requestRestoreConfirm(point)
}

async function confirmRestore(point: RestorePoint) {
  confirmingRestore.value = null
  await run(
    `restore-${point.id}`,
    async () => {
      await restoreBackup({ snapshot: point.id })
      success(`Restore of ${shortId(point)} submitted.`)
    },
    (cause) => fromOperationError(cause, `Failed to restore ${shortId(point)}.`),
  )
}

// -- forget -----------------------------------------------------------------

const {
  pending: confirmingForget,
  request: requestForgetConfirm,
  cancel: cancelForget,
} = useConfirm<RestorePoint | null>(null)

function requestForget(point: RestorePoint) {
  requestForgetConfirm(point)
}

async function confirmForget(point: RestorePoint) {
  confirmingForget.value = null
  await run(
    `forget-${point.id}`,
    async () => {
      await deleteBackup({ snapshot: point.id, prune: true })
      success(`Snapshot ${shortId(point)} forgotten.`)
      await load()
    },
    (cause) => fromOperationError(cause, `Failed to forget ${shortId(point)}.`),
  )
}

// -- retention / schedule ---------------------------------------------------

const retentionDraft = ref<Record<string, string>>({})
const scheduleEnabled = ref(false)
const scheduleCalendar = ref('daily')

function loadDraft() {
  retentionDraft.value = Object.fromEntries(
    Object.entries(policy.value?.retention ?? {}).map(([key, value]) => [key, String(value)]),
  )
  scheduleEnabled.value = policy.value?.schedule.enabled ?? false
  scheduleCalendar.value = policy.value?.schedule.calendar ?? 'daily'
}

loadDraft()

const {
  pending: confirmingPolicy,
  request: requestPolicyConfirm,
  cancel: cancelPolicy,
} = useConfirm(false)

async function savePolicy() {
  confirmingPolicy.value = false
  const retention: Record<string, number> = {}
  for (const [key, value] of Object.entries(retentionDraft.value)) {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) retention[key] = parsed
  }
  await run(
    'policy',
    async () => {
      await setBackupPolicy({
        retention,
        schedule_enabled: scheduleEnabled.value,
        schedule_calendar: scheduleCalendar.value.trim() || 'daily',
      })
      success('Backup policy updated.')
      loadDraft()
      await load()
    },
    (cause) => fromOperationError(cause, 'Failed to update backup policy.'),
  )
}

const retentionKeys = computed(() => {
  const keys = Object.keys(retentionDraft.value)
  return keys.length ? keys : ['keep_last', 'keep_daily', 'keep_weekly', 'keep_monthly']
})

function retentionLabel(key: string) {
  return key.replace('keep_', 'keep ')
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System maintenance"
      title="Backups"
      description="Restic restore points. Snapshots are encrypted and deduplicated; restoring overwrites live files and forgetting a snapshot cannot be undone."
    />

    <Card v-if="policy">
      <CardHeader>
        <CardTitle>Repository</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3 tw:text-sm">
        <div class="tw:grid tw:gap-1 tw:sm:grid-cols-2">
          <p class="tw:m-0 tw:text-muted-foreground">
            Location
            <code class="tw:ml-1 tw:font-mono tw:text-foreground">{{ policy.repo }}</code>
          </p>
          <p class="tw:m-0 tw:text-muted-foreground">
            Snapshots
            <span class="tw:ml-1 tw:text-foreground">{{ stats?.stats.snapshots_count ?? rows.length }}</span>
            · Size
            <span class="tw:ml-1 tw:text-foreground">{{ formatSize(stats?.stats.total_size) }}</span>
          </p>
          <p class="tw:m-0 tw:text-muted-foreground">
            Paths
            <span class="tw:ml-1 tw:text-foreground">{{ policy.paths.join(', ') }}</span>
          </p>
          <p class="tw:m-0 tw:text-muted-foreground">
            Scheduled
            <span class="tw:ml-1 tw:text-foreground">{{
              schedule?.enabled ? `${schedule.calendar} (${schedule.active_state})` : 'off'
            }}</span>
          </p>
        </div>
        <div class="tw:flex tw:justify-end">
          <Button variant="outline" size="sm" :disabled="busy !== ''" @click="runCheck">
            {{ busy === 'check' ? 'Checking…' : 'Check integrity' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card v-if="policy">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Restore points</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== ''"
            @click="showCreate = !showCreate"
            >{{ showCreate ? 'Cancel' : 'New snapshot' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <div
          v-if="showCreate"
          class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
        >
          <div class="tw:grid tw:gap-1.5">
            <Label for="backup-paths">Paths (comma or newline separated, blank = configured)</Label>
            <Input id="backup-paths" v-model="createPaths" autocomplete="off" placeholder="/etc, /var/www" />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="backup-tag">Tag (optional)</Label>
            <Input id="backup-tag" v-model="createTag" autocomplete="off" placeholder="manual" />
          </div>
          <div class="tw:flex tw:justify-end">
            <Button size="sm" :disabled="busy !== ''" @click="requestCreateConfirm(true)">Create snapshot</Button>
          </div>
        </div>

        <EmptyState
          v-if="!loading && rows.length === 0"
          title="No restore points yet"
          description="Create a snapshot to capture the configured paths, or wait for the scheduled backup."
        />
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">Loading…</p>
        <ul v-else class="tw:m-0 tw:grid tw:gap-3 tw:pl-0">
          <li
            v-for="point in rows"
            :key="point.id"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
              <div>
                <code class="tw:font-mono tw:text-sm">{{ shortId(point) }}</code>
                <span class="tw:ml-2 tw:text-xs tw:text-muted-foreground">{{ point.hostname || policy.host }}</span>
                <p class="tw:mb-0 tw:mt-1 tw:text-sm tw:text-muted-foreground">{{ pathSummary(point) }}</p>
              </div>
              <span class="tw:shrink-0 tw:text-xs tw:text-muted-foreground">{{ point.time }}</span>
            </div>
            <div class="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2">
              <Button
                variant="warning"
                size="sm"
                :disabled="busy !== ''"
                @click="requestRestore(point)"
                >{{ busy === `restore-${point.id}` ? 'Restoring…' : 'Restore' }}</Button
              >
              <Button
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestForget(point)"
                >{{ busy === `forget-${point.id}` ? 'Forgetting…' : 'Forget' }}</Button
              >
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card v-if="policy">
      <CardHeader>
        <CardTitle>Retention &amp; schedule</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <div class="tw:grid tw:gap-3 tw:sm:grid-cols-2 tw:lg:grid-cols-4">
          <div v-for="key in retentionKeys" :key="key" class="tw:grid tw:gap-1.5">
            <Label :for="`retention-${key}`">{{ retentionLabel(key) }}</Label>
            <Input
              :id="`retention-${key}`"
              v-model="retentionDraft[key]"
              type="number"
              min="0"
              inputmode="numeric"
            />
          </div>
        </div>
        <div class="tw:grid tw:gap-3 tw:sm:grid-cols-2">
          <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
            <input v-model="scheduleEnabled" type="checkbox" class="tw:h-4 tw:w-4" />
            <span>Scheduled backups</span>
          </label>
          <div class="tw:grid tw:gap-1.5">
            <Label for="schedule-calendar">Cadence (systemd OnCalendar)</Label>
            <Input id="schedule-calendar" v-model="scheduleCalendar" autocomplete="off" placeholder="daily" />
          </div>
        </div>
        <div class="tw:flex tw:justify-end">
          <Button size="sm" :disabled="busy !== ''" @click="requestPolicyConfirm(true)">
            {{ busy === 'policy' ? 'Saving…' : 'Save policy' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <ConfirmDialog
      :open="confirmingCreate"
      tier="soft"
      title="Create this snapshot?"
      description="The configured paths are copied into a new encrypted Restic snapshot."
      confirm-label="Create snapshot"
      :busy="busy === 'create'"
      @confirm="confirmCreate"
      @cancel="confirmingCreate = false"
    />
    <ConfirmDialog
      :open="confirmingRestore !== null"
      tier="destructive"
      title="Restore this snapshot?"
      :description="`Restoring ${confirmingRestore ? shortId(confirmingRestore) : ''} overwrites live files with the snapshot's contents.`"
      confirm-label="Restore"
      :confirm-phrase="confirmingRestore ? shortId(confirmingRestore) : undefined"
      :busy="busy === `restore-${confirmingRestore?.id}`"
      @confirm="confirmRestore(confirmingRestore!)"
      @cancel="cancelRestore"
    />
    <ConfirmDialog
      :open="confirmingForget !== null"
      tier="destructive"
      title="Forget this snapshot?"
      description="The snapshot is removed and the repository pruned. This cannot be undone."
      confirm-label="Forget"
      :confirm-phrase="confirmingForget ? shortId(confirmingForget) : undefined"
      :busy="busy === `forget-${confirmingForget?.id}`"
      @confirm="confirmForget(confirmingForget!)"
      @cancel="cancelForget"
    />
    <ConfirmDialog
      :open="confirmingPolicy"
      tier="disruptive"
      title="Update backup policy?"
      description="Retention changes the automatic pruning behaviour; the schedule controls when snapshots run."
      confirm-label="Save policy"
      :busy="busy === 'policy'"
      @confirm="savePolicy"
      @cancel="cancelPolicy"
    />
  </PageLayout>
</template>
