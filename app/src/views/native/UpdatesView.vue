<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  applyUpdates,
  getAvailableUpdates,
  getMigrations,
  refreshUpdates,
  runMigration,
  type AvailableUpdates,
  type Migration,
  type UpdateTarget,
} from '@/api/nativeUpdates'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()

const updates = ref<AvailableUpdates | null>(null)
const migrations = ref<Migration[]>([])
const error = ref('')
const notice = ref('')
const loading = ref(false)
const busy = ref('')

const confirmingApply = ref<'apps' | 'system' | null>(null)
const confirmingMigration = ref<string | null>(null)
const disclaimerAccepted = ref<Record<string, boolean>>({})

const systemPackageGroups = computed(() =>
  updates.value ? Object.entries(updates.value.system) : [],
)
const upgradableAppCount = computed(() => updates.value?.apps.length ?? 0)
const upgradableSystemCount = computed(() =>
  systemPackageGroups.value.reduce((sum, [, pkgs]) => sum + pkgs.length, 0),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [updatesResult, migrationsResult] = await Promise.all([
      getAvailableUpdates(),
      getMigrations('pending'),
    ])
    updates.value = updatesResult
    migrations.value = migrationsResult.migrations
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load updates.'
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

async function refresh(target: UpdateTarget) {
  busy.value = `refresh-${target}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    updates.value = await refreshUpdates(target)
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to refresh updates.'
  } finally {
    busy.value = ''
  }
}

function requestApply(target: 'apps' | 'system') {
  notice.value = ''
  error.value = ''
  confirmingApply.value = target
}

function cancelApply() {
  confirmingApply.value = null
}

async function confirmApply() {
  const target = confirmingApply.value
  if (!target) return
  busy.value = `apply-${target}`
  confirmingApply.value = null
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await applyUpdates(target)
    notice.value = `${target === 'system' ? 'System' : 'App'} upgrade submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to apply ${target} upgrade.`
  } finally {
    busy.value = ''
  }
}

function requestMigration(id: string) {
  notice.value = ''
  error.value = ''
  confirmingMigration.value = id
}

function cancelMigration() {
  confirmingMigration.value = null
}

async function confirmMigration(migration: Migration) {
  confirmingMigration.value = null
  busy.value = `migrate-${migration.id}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await runMigration(
      migration.id,
      Boolean(disclaimerAccepted.value[migration.id]),
    )
    notice.value = `Migration ${migration.id} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to run migration ${migration.id}.`
  } finally {
    busy.value = ''
  }
}

function canRun(migration: Migration) {
  if (migration.state !== 'pending') return false
  return !migration.disclaimer || disclaimerAccepted.value[migration.id]
}

function formatAge(seconds: number) {
  if (seconds >= 99999 * 3600) return 'unknown'
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86400)} d ago`
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System maintenance"
      title="Updates"
      description="Pending apt/app package updates and platform migrations. Applying updates or running a migration is disruptive and asks for confirmation first — some migrations cannot be undone."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Available updates</span>
          <span class="tw:flex tw:gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== '' || loading"
              @click="refresh('apps')"
              >{{
                busy === 'refresh-apps' ? 'Refreshing…' : 'Refresh apps'
              }}</Button
            >
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== '' || loading"
              @click="refresh('system')"
              >{{
                busy === 'refresh-system' ? 'Refreshing…' : 'Refresh system'
              }}</Button
            >
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p v-if="!updates" class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Loading…' : 'No update data yet.' }}
        </p>
        <template v-else>
          <p class="tw:text-xs tw:text-muted-foreground">
            apt cache refreshed {{ formatAge(updates.last_apt_update) }} · app
            catalogue refreshed
            {{ formatAge(updates.last_apps_catalog_update) }}
          </p>
          <Alert v-if="updates.important_yunohost_upgrade" variant="warning">
            A major platform version upgrade is available. Review the migrations
            below before applying system updates.
          </Alert>

          <div class="tw:grid tw:gap-2">
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 class="tw:m-0 tw:text-sm tw:font-semibold">
                System packages
                <Badge variant="neutral">{{ upgradableSystemCount }}</Badge>
              </h3>
              <template v-if="confirmingApply === 'system'">
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >Apply system upgrade?</span
                  >
                  <Button variant="outline" size="sm" @click="cancelApply"
                    >Cancel</Button
                  >
                  <Button
                    variant="danger"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="confirmApply"
                    >Confirm</Button
                  >
                </span>
              </template>
              <Button
                v-else-if="upgradableSystemCount > 0"
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestApply('system')"
                >{{
                  busy === 'apply-system' ? 'Applying…' : 'Apply system upgrade'
                }}</Button
              >
            </div>
            <p
              v-if="upgradableSystemCount === 0"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              System packages are up to date.
            </p>
            <div
              v-for="[category, packages] in systemPackageGroups"
              v-else
              :key="category"
              class="tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <p
                v-if="packages.length"
                class="tw:mb-2 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-muted-foreground"
              >
                {{ category }}
              </p>
              <ul
                v-if="packages.length"
                class="tw:m-0 tw:grid tw:gap-1 tw:pl-0"
              >
                <li
                  v-for="pkg in packages"
                  :key="pkg.name"
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-sm"
                >
                  <code class="tw:font-mono">{{ pkg.name }}</code>
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >{{ pkg.current_version }} → {{ pkg.new_version }}</span
                  >
                </li>
              </ul>
            </div>
          </div>

          <div
            class="tw:grid tw:gap-2 tw:border-t tw:border-border-subtle tw:pt-4"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <h3 class="tw:m-0 tw:text-sm tw:font-semibold">
                Apps
                <Badge variant="neutral">{{ upgradableAppCount }}</Badge>
              </h3>
              <template v-if="confirmingApply === 'apps'">
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >Apply app upgrades?</span
                  >
                  <Button variant="outline" size="sm" @click="cancelApply"
                    >Cancel</Button
                  >
                  <Button
                    variant="danger"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="confirmApply"
                    >Confirm</Button
                  >
                </span>
              </template>
              <Button
                v-else-if="upgradableAppCount > 0"
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestApply('apps')"
                >{{
                  busy === 'apply-apps' ? 'Applying…' : 'Apply app upgrades'
                }}</Button
              >
            </div>
            <p
              v-if="upgradableAppCount === 0"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              Installed apps are up to date.
            </p>
            <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
              <li
                v-for="app in updates.apps"
                :key="app.id"
                class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-sm"
              >
                <code class="tw:font-mono">{{ app.id }}</code>
                <span class="tw:text-xs tw:text-muted-foreground">{{
                  app.upgrade?.status || 'upgradable'
                }}</span>
              </li>
            </ul>
          </div>
        </template>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Migrations</CardTitle>
      </CardHeader>
      <CardContent>
        <p
          v-if="migrations.length === 0"
          class="tw:text-sm tw:text-muted-foreground"
        >
          {{
            loading
              ? 'Loading…'
              : 'The upstream YunoHost migrations subsystem is disabled on nostrhost — this platform only ever installs onto a fresh system, so no migration can legitimately apply.'
          }}
        </p>
        <ul v-else class="tw:m-0 tw:grid tw:gap-3 tw:pl-0">
          <li
            v-for="migration in migrations"
            :key="migration.id"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
              <div>
                <code class="tw:font-mono tw:text-sm">{{ migration.id }}</code>
                <p class="tw:mb-0 tw:mt-1 tw:text-sm tw:text-muted-foreground">
                  {{ migration.description }}
                </p>
              </div>
              <Badge
                :variant="migration.mode === 'manual' ? 'warning' : 'neutral'"
              >
                {{ migration.mode }}
              </Badge>
            </div>

            <Alert v-if="migration.disclaimer" variant="warning">
              <p class="tw:m-0">{{ migration.disclaimer }}</p>
              <label
                class="tw:mt-2 tw:flex tw:items-center tw:gap-2 tw:text-sm"
              >
                <input
                  v-model="disclaimerAccepted[migration.id]"
                  type="checkbox"
                  class="tw:size-4 tw:accent-brand-500"
                />
                I have read and accept this disclaimer.
              </label>
            </Alert>

            <template v-if="confirmingMigration === migration.id">
              <div class="tw:flex tw:items-center tw:justify-end tw:gap-2">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Run {{ migration.id }}? This may not be reversible.</span
                >
                <Button variant="outline" size="sm" @click="cancelMigration"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmMigration(migration)"
                  >Confirm</Button
                >
              </div>
            </template>
            <div v-else class="tw:flex tw:justify-end">
              <Button
                variant="danger"
                size="sm"
                :disabled="busy !== '' || !canRun(migration)"
                @click="requestMigration(migration.id)"
                >{{
                  busy === `migrate-${migration.id}` ? 'Running…' : 'Run'
                }}</Button
              >
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </PageLayout>
</template>
