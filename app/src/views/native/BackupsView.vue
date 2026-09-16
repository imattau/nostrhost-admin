<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  createBackup,
  deleteBackup,
  getBackupInfo,
  getBackups,
  restoreBackup,
  type BackupArchiveDetail,
  type BackupArchiveInfo,
} from '@/api/nativeBackups'
import { getAppManagement } from '@/api/nativePackages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import { parseList } from '@/lib/utils'
import { toErrorMessage } from '@/utils/errors'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import ActionMenu from '@/components/native/ActionMenu.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success, danger } = useNotifications()
const route = useRoute()
const router = useRouter()

const archives = ref<Record<string, BackupArchiveInfo>>({})
const installedApps = ref<Array<{ id: string; name: string }>>([])

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  const [result, inventory] = await Promise.all([
    getBackups(),
    getAppManagement(),
  ])
  archives.value = result.archives
  installedApps.value = inventory.apps
    .filter((app) => app.installed)
    .map((app) => ({ id: app.id, name: app.name }))
  const requested = route.query.archive
  if (
    typeof requested === 'string' &&
    archives.value[requested] &&
    expandedArchive.value !== requested
  ) {
    await toggleDetail(requested)
  }
}, 'Failed to load backups.')

// -- archive contents (expand-in-place) --------------------------------------

const expandedArchive = ref<string | null>(null)
const archiveDetail = ref<BackupArchiveDetail | null>(null)

async function toggleDetail(name: string) {
  if (expandedArchive.value === name) {
    expandedArchive.value = null
    await router.replace({ query: { ...route.query, archive: undefined } })
    return
  }
  if (route.query.archive !== name) {
    await router.replace({ query: { ...route.query, archive: name } })
  }
  expandedArchive.value = name
  archiveDetail.value = null
  try {
    await sync()
    archiveDetail.value = await getBackupInfo(name)
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to load contents of ${name}.`))
  }
}

watch(
  () => route.query.archive,
  async (archive) => {
    if (typeof archive !== 'string' || expandedArchive.value === archive) return
    if (archives.value[archive]) await toggleDetail(archive)
  },
)
const busy = ref('')
const { run } = useActionRunner(busy, '')

const archiveRows = computed(() =>
  Object.entries(archives.value)
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)),
)

function formatSize(size: number | string) {
  if (typeof size !== 'number') return String(size)
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

// -- create -------------------------------------------------------------

const showCreateForm = ref(false)
const createName = ref('')
const createDescription = ref('')
const createApps = ref<string[]>([])
const createSystem = ref('')
const { pending: confirmingCreate, request: requestCreateConfirm } =
  useConfirm(false)

function resetCreateForm() {
  createName.value = ''
  createDescription.value = ''
  createApps.value = []
  createSystem.value = ''
  confirmingCreate.value = false
}

function requestCreate() {
  requestCreateConfirm(true)
}

async function confirmCreate() {
  confirmingCreate.value = false
  await run(
    'create',
    async () => {
      await sync()
      const result = await createBackup({
        name: createName.value.trim() || undefined,
        description: createDescription.value.trim() || undefined,
        apps: createApps.value,
        system: parseList(createSystem.value),
      })
      success(
        `Backup creation submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      showCreateForm.value = false
      resetCreateForm()
      await load()
    },
    'Failed to create backup.',
  )
}

// -- restore --------------------------------------------------------------

const {
  pending: confirmingRestore,
  request: requestRestoreConfirm,
  cancel: cancelRestore,
} = useConfirm<string | null>(null)

function requestRestore(name: string) {
  requestRestoreConfirm(name)
}

async function confirmRestore(name: string) {
  confirmingRestore.value = null
  await run(
    `restore-${name}`,
    async () => {
      await sync()
      const result = await restoreBackup({ name })
      success(
        `Restore of ${name} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
    },
    `Failed to restore ${name}.`,
  )
}

// -- delete -----------------------------------------------------------------

const {
  pending: confirmingDelete,
  request: requestDeleteConfirm,
  cancel: cancelDelete,
} = useConfirm<string | null>(null)

function requestDelete(name: string) {
  requestDeleteConfirm(name)
}

async function confirmDelete(name: string) {
  confirmingDelete.value = null
  await run(
    `delete-${name}`,
    async () => {
      await sync()
      const result = await deleteBackup(name)
      success(
        `Deletion of ${name} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to delete ${name}.`,
  )
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System maintenance"
      title="Backups"
      description="Local backup archives (apps and system configuration). Restoring overwrites live state and deleting an archive cannot be undone — both ask for confirmation first."
    />

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Local archives</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy !== ''"
            @click="showCreateForm = !showCreateForm"
            >{{ showCreateForm ? 'Cancel' : 'Create backup' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <div
          v-if="showCreateForm"
          class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
        >
          <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="backup-create-name">Name (optional)</Label>
              <Input
                id="backup-create-name"
                v-model="createName"
                placeholder="before-upgrade"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="backup-create-description"
                >Description (optional)</Label
              >
              <Input
                id="backup-create-description"
                v-model="createDescription"
                autocomplete="off"
              />
            </div>
          </div>
          <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="backup-create-apps">Apps to include</Label>
              <select
                id="backup-create-apps"
                v-model="createApps"
                multiple
                class="tw:min-h-32 tw:w-full tw:rounded-[3px] tw:border tw:border-border-subtle tw:bg-workbench tw:px-3 tw:py-2 tw:text-sm tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-focus"
              >
                <option
                  v-for="app in installedApps"
                  :key="app.id"
                  :value="app.id"
                >
                  {{ app.name }} · {{ app.id }}
                </option>
              </select>
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Leave empty to include every installed app. Use Ctrl/⌘ to select
                several.
              </p>
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="backup-create-system"
                >System parts (comma-separated, blank = all)</Label
              >
              <Input
                id="backup-create-system"
                v-model="createSystem"
                autocomplete="off"
              />
            </div>
          </div>
          <div class="tw:flex tw:justify-end">
            <Button size="sm" :disabled="busy !== ''" @click="requestCreate">{{
              busy === 'create' ? 'Creating…' : 'Create backup'
            }}</Button>
          </div>
        </div>

        <EmptyState
          v-if="!loading && archiveRows.length === 0"
          title="No backup archives yet"
          description="Create a backup above to snapshot apps and system configuration."
        />
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <ul v-else class="tw:m-0 tw:grid tw:gap-3 tw:pl-0">
          <li
            v-for="archive in archiveRows"
            :key="archive.name"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
              <div>
                <code class="tw:font-mono tw:text-sm">{{ archive.name }}</code>
                <p
                  v-if="archive.description"
                  class="tw:mb-0 tw:mt-1 tw:text-sm tw:text-muted-foreground"
                >
                  {{ archive.description }}
                </p>
              </div>
              <span class="tw:shrink-0 tw:text-xs tw:text-muted-foreground">{{
                formatSize(archive.size)
              }}</span>
            </div>
            <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
              Created {{ archive.created_at }}
            </p>

            <div
              v-if="expandedArchive === archive.name"
              class="tw:grid tw:gap-1 tw:rounded-md tw:bg-surface-muted tw:p-3 tw:text-xs"
            >
              <p v-if="!archiveDetail" class="tw:m-0 tw:text-muted-foreground">
                Loading contents…
              </p>
              <template v-else>
                <p class="tw:m-0 tw:font-semibold tw:text-muted-foreground">
                  Apps
                </p>
                <p
                  v-if="!Object.keys(archiveDetail.apps ?? {}).length"
                  class="tw:m-0 tw:text-muted-foreground"
                >
                  none
                </p>
                <code v-else class="tw:font-mono">{{
                  Object.keys(archiveDetail.apps ?? {}).join(', ')
                }}</code>
                <p
                  class="tw:m-0 tw:mt-2 tw:font-semibold tw:text-muted-foreground"
                >
                  System
                </p>
                <p
                  v-if="!Object.keys(archiveDetail.system ?? {}).length"
                  class="tw:m-0 tw:text-muted-foreground"
                >
                  none
                </p>
                <code v-else class="tw:font-mono">{{
                  Object.keys(archiveDetail.system ?? {}).join(', ')
                }}</code>
              </template>
            </div>

            <div
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2"
            >
              <Button
                variant="outline"
                size="sm"
                @click="toggleDetail(archive.name)"
                >{{
                  expandedArchive === archive.name
                    ? 'Hide contents'
                    : 'Contents'
                }}</Button
              >
              <Button
                variant="warning"
                size="sm"
                :disabled="busy !== ''"
                @click="requestRestore(archive.name)"
                >{{
                  busy === `restore-${archive.name}` ? 'Restoring…' : 'Restore'
                }}</Button
              >
              <ActionMenu :label="`More actions for ${archive.name}`">
                <button
                  type="button"
                  role="menuitem"
                  class="tw:flex tw:min-h-10 tw:w-full tw:items-center tw:px-3 tw:py-2 tw:text-left tw:text-sm tw:font-medium tw:text-destructive tw:hover:bg-surface-muted"
                  :disabled="busy !== ''"
                  @click="requestDelete(archive.name)"
                >
                  {{
                    busy === `delete-${archive.name}`
                      ? 'Deleting…'
                      : 'Delete archive'
                  }}
                </button>
              </ActionMenu>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <ConfirmDialog
      :open="confirmingCreate"
      tier="soft"
      title="Create this backup?"
      description="The selected apps and system configuration are copied into a new local archive."
      confirm-label="Create backup"
      :busy="busy === 'create'"
      @confirm="confirmCreate"
      @cancel="confirmingCreate = false"
    />
    <ConfirmDialog
      :open="confirmingRestore !== null"
      tier="disruptive"
      title="Restore this backup?"
      :description="`Restoring ${confirmingRestore} overwrites live state with the archive's contents.`"
      confirm-label="Restore"
      :busy="busy === `restore-${confirmingRestore}`"
      @confirm="confirmRestore(confirmingRestore!)"
      @cancel="cancelRestore"
    />
    <ConfirmDialog
      :open="confirmingDelete !== null"
      tier="destructive"
      title="Delete this backup archive?"
      description="This cannot be undone."
      confirm-label="Delete"
      :confirm-phrase="confirmingDelete ?? undefined"
      :busy="busy === `delete-${confirmingDelete}`"
      @confirm="confirmDelete(confirmingDelete!)"
      @cancel="cancelDelete"
    />
  </PageLayout>
</template>
