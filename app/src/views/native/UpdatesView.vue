<script setup lang="ts">
import { computed, ref } from 'vue'

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
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success } = useNotifications()

const updates = ref<AvailableUpdates | null>(null)
const migrations = ref<Migration[]>([])
const busy = ref('')
const { run } = useActionRunner(busy, '')

const {
  pending: confirmingApply,
  request: requestApplyConfirm,
  cancel: cancelApply,
} = useConfirm<'apps' | 'system' | null>(null)
const {
  pending: confirmingMigration,
  request: requestMigrationConfirm,
  cancel: cancelMigration,
} = useConfirm<string | null>(null)
const disclaimerAccepted = ref<Record<string, boolean>>({})

const systemPackageGroups = computed(() =>
  updates.value ? Object.entries(updates.value.system) : [],
)
const upgradableAppCount = computed(() => updates.value?.apps.length ?? 0)
const upgradableSystemCount = computed(() =>
  systemPackageGroups.value.reduce((sum, [, pkgs]) => sum + pkgs.length, 0),
)

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  const [updatesResult, migrationsResult] = await Promise.all([
    getAvailableUpdates(),
    getMigrations('pending'),
  ])
  updates.value = updatesResult
  migrations.value = migrationsResult.migrations
}, 'Failed to load updates.')

async function refresh(target: UpdateTarget) {
  await run(
    `refresh-${target}`,
    async () => {
      await sync()
      updates.value = await refreshUpdates(target)
    },
    'Failed to refresh updates.',
  )
}

function requestApply(target: 'apps' | 'system') {
  requestApplyConfirm(target)
}

async function confirmApply() {
  const target = confirmingApply.value
  if (!target) return
  await run(
    `apply-${target}`,
    async () => {
      confirmingApply.value = null
      await sync()
      const result = await applyUpdates(target)
      success(
        `${target === 'system' ? 'System' : 'App'} upgrade submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to apply ${target} upgrade.`,
  )
}

function requestMigration(id: string) {
  requestMigrationConfirm(id)
}

const confirmingMigrationRecord = computed(
  () =>
    migrations.value.find((m) => m.id === confirmingMigration.value) ?? null,
)

async function confirmMigration(id: string) {
  confirmingMigration.value = null
  await run(
    `migrate-${id}`,
    async () => {
      await sync()
      const result = await runMigration(
        id,
        Boolean(disclaimerAccepted.value[id]),
      )
      success(
        `Migration ${id} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to run migration ${id}.`,
  )
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
        <p
          v-if="!updates && loading"
          class="tw:text-sm tw:text-muted-foreground"
        >
          Loading…
        </p>
        <EmptyState v-else-if="!updates" title="No update data yet" />
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
              <Button
                v-if="upgradableSystemCount > 0"
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
              <Button
                v-if="upgradableAppCount > 0"
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

            <div class="tw:flex tw:justify-end">
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

    <ConfirmDialog
      :open="confirmingApply === 'system'"
      tier="disruptive"
      title="Apply the system upgrade?"
      description="System packages are updated now; some services may briefly restart."
      confirm-label="Apply"
      :busy="busy === 'apply-system'"
      @confirm="confirmApply"
      @cancel="cancelApply"
    />
    <ConfirmDialog
      :open="confirmingApply === 'apps'"
      tier="disruptive"
      title="Apply app upgrades?"
      description="Installed apps are updated now; each app may be briefly unavailable during its own upgrade."
      confirm-label="Apply"
      :busy="busy === 'apply-apps'"
      @confirm="confirmApply"
      @cancel="cancelApply"
    />
    <ConfirmDialog
      :open="confirmingMigration !== null"
      tier="destructive"
      title="Run this migration?"
      :description="`${confirmingMigrationRecord?.description ?? confirmingMigration} may not be reversible and can affect every app.`"
      confirm-label="Run"
      :confirm-phrase="confirmingMigration ?? undefined"
      :busy="busy === `migrate-${confirmingMigration}`"
      @confirm="confirmMigration(confirmingMigration!)"
      @cancel="cancelMigration"
    />
  </PageLayout>
</template>
