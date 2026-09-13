<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  createBackup,
  deleteBackup,
  getBackups,
  restoreBackup,
  type BackupArchiveInfo,
} from '@/api/nativeBackups'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const archives = ref<Record<string, BackupArchiveInfo>>({})
const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

const archiveRows = computed(() =>
  Object.entries(archives.value)
    .map(([name, info]) => ({ name, ...info }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at)),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const result = await getBackups()
    archives.value = result.archives
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load backups.'
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
const createApps = ref('')
const createSystem = ref('')
const confirmingCreate = ref(false)
const createError = ref('')

function resetCreateForm() {
  createName.value = ''
  createDescription.value = ''
  createApps.value = ''
  createSystem.value = ''
  confirmingCreate.value = false
  createError.value = ''
}

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function requestCreate() {
  createError.value = ''
  confirmingCreate.value = true
}

async function confirmCreate() {
  confirmingCreate.value = false
  busy.value = 'create'
  createError.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await createBackup({
      name: createName.value.trim() || undefined,
      description: createDescription.value.trim() || undefined,
      apps: parseList(createApps.value),
      system: parseList(createSystem.value),
    })
    notice.value = `Backup creation submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    showCreateForm.value = false
    resetCreateForm()
    await load()
  } catch (cause) {
    createError.value =
      cause instanceof Error ? cause.message : 'Failed to create backup.'
  } finally {
    busy.value = ''
  }
}

// -- restore --------------------------------------------------------------

const confirmingRestore = ref<string | null>(null)

function requestRestore(name: string) {
  notice.value = ''
  error.value = ''
  confirmingRestore.value = name
}

function cancelRestore() {
  confirmingRestore.value = null
}

async function confirmRestore(name: string) {
  confirmingRestore.value = null
  busy.value = `restore-${name}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await restoreBackup({ name })
    notice.value = `Restore of ${name} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to restore ${name}.`
  } finally {
    busy.value = ''
  }
}

// -- delete -----------------------------------------------------------------

const confirmingDelete = ref<string | null>(null)

function requestDelete(name: string) {
  notice.value = ''
  error.value = ''
  confirmingDelete.value = name
}

function cancelDelete() {
  confirmingDelete.value = null
}

async function confirmDelete(name: string) {
  confirmingDelete.value = null
  busy.value = `delete-${name}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await deleteBackup(name)
    notice.value = `Deletion of ${name} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to delete ${name}.`
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        System maintenance
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Backups
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Local backup archives (apps and system configuration). Restoring
        overwrites live state and deleting an archive cannot be undone — both
        ask for confirmation first.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

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
              <Label for="backup-create-apps"
                >Apps (comma-separated, blank = all)</Label
              >
              <Input
                id="backup-create-apps"
                v-model="createApps"
                placeholder="nextcloud, wordpress"
                autocomplete="off"
              />
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
          <Alert v-if="createError" variant="danger">{{ createError }}</Alert>
          <div
            v-if="confirmingCreate"
            class="tw:flex tw:items-center tw:justify-end tw:gap-2"
          >
            <span class="tw:text-xs tw:text-muted-foreground"
              >Create this backup archive now?</span
            >
            <Button
              variant="outline"
              size="sm"
              @click="confirmingCreate = false"
              >Cancel</Button
            >
            <Button
              variant="danger"
              size="sm"
              :disabled="busy !== ''"
              @click="confirmCreate"
              >Confirm</Button
            >
          </div>
          <div v-else class="tw:flex tw:justify-end">
            <Button size="sm" :disabled="busy !== ''" @click="requestCreate">{{
              busy === 'create' ? 'Creating…' : 'Create backup'
            }}</Button>
          </div>
        </div>

        <p
          v-if="!loading && archiveRows.length === 0"
          class="tw:text-sm tw:text-muted-foreground"
        >
          No backup archives yet.
        </p>
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
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2"
            >
              <template v-if="confirmingRestore === archive.name">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Restore {{ archive.name }}? This overwrites live state.</span
                >
                <Button variant="outline" size="sm" @click="cancelRestore"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmRestore(archive.name)"
                  >Confirm</Button
                >
              </template>
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestRestore(archive.name)"
                >{{
                  busy === `restore-${archive.name}` ? 'Restoring…' : 'Restore'
                }}</Button
              >

              <template v-if="confirmingDelete === archive.name">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Delete {{ archive.name }}? This cannot be undone.</span
                >
                <Button variant="outline" size="sm" @click="cancelDelete"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmDelete(archive.name)"
                  >Confirm</Button
                >
              </template>
              <Button
                v-else
                variant="danger"
                size="sm"
                :disabled="busy !== ''"
                @click="requestDelete(archive.name)"
                >{{
                  busy === `delete-${archive.name}` ? 'Deleting…' : 'Delete'
                }}</Button
              >
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </section>
</template>
