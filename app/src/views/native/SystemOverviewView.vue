<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  getHealth,
  getIdentities,
  getSystemStatus,
  getSystemVersions,
  type Health,
  type Identity,
  type PackageVersion,
  type SystemStatus,
  type SystemVersions,
} from '@/api/nativeSystem'
import { listOperations, type OperationEntry } from '@/api/nativeOperations'
import { getPrimaryDomain } from '@/api/nativeDomains'
import { getBackups } from '@/api/nativeBackups'
import { getAppManagement } from '@/api/nativePackages'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAsyncResource } from '@/composables/useAsyncResource'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import RuledSection from '@/components/native/RuledSection.vue'
import StatusMark from '@/components/native/StatusMark.vue'

const health = ref<Health | null>(null)
const status = ref<SystemStatus | null>(null)
const versions = ref<SystemVersions | null>(null)
const identities = ref<Identity[] | null>(null)
const recentOperations = ref<OperationEntry[] | null>(null)
const primaryDomain = ref('')
const hasBackup = ref(false)
const hasWorkload = ref(false)

const { publicKey, loading, load } = useAsyncResource(async () => {
  const [
    healthResult,
    statusResult,
    versionsResult,
    identitiesResult,
    operationsResult,
    primaryResult,
    backupResult,
    appResult,
  ] = await Promise.all([
    getHealth(),
    getSystemStatus(),
    getSystemVersions(),
    getIdentities(),
    listOperations(5),
    getPrimaryDomain(),
    getBackups(),
    getAppManagement(),
  ])
  health.value = healthResult
  status.value = statusResult
  versions.value = versionsResult
  identities.value = identitiesResult
  recentOperations.value = operationsResult
  primaryDomain.value = primaryResult.current
  hasBackup.value = Object.keys(backupResult.archives).length > 0
  hasWorkload.value = appResult.apps.some((app) => app.installed)
}, 'Failed to load system status.')

function operationStateVariant(state: OperationEntry['state']) {
  if (state === 'SUCCEEDED') return 'success'
  if (state === 'FAILED' || state === 'REJECTED') return 'danger'
  if (state === 'EXECUTING' || state === 'APPROVED') return 'warning'
  return 'neutral'
}

function shortenKey(key: string) {
  return `${key.slice(0, 12)}…${key.slice(-8)}`
}

// getSystemVersions() returns the raw package list from the underlying
// YunoHost host (yunohost, moulinette, ssowat, ...) alongside NostrHost's
// own components — split them into two groups so the platform internals
// read as NostrHost's foundation rather than unexplained stray names.
const PLATFORM_LABELS: Record<string, string> = {
  yunohost: 'YunoHost core',
  'yunohost-admin': 'YunoHost admin (legacy)',
  moulinette: 'Moulinette',
  ssowat: 'SSOwat (single sign-on)',
  nostrhost: 'NostrHost core',
  nostrhost_admin: 'NostrHost admin console',
}

type VersionEntry = { name: string; label: string; info: PackageVersion }

function toEntries(
  source: SystemVersions,
  match: (name: string) => boolean,
): VersionEntry[] {
  return Object.entries(source)
    .filter(([name]) => match(name))
    .map(([name, info]) => ({
      name,
      label: PLATFORM_LABELS[name] ?? name,
      info,
    }))
}

const nostrhostVersions = computed(() =>
  versions.value
    ? toEntries(versions.value, (name) => name.startsWith('nostrhost'))
    : [],
)
const platformVersions = computed(() =>
  versions.value
    ? toEntries(versions.value, (name) => !name.startsWith('nostrhost'))
    : [],
)

const attentionOperations = computed(() =>
  (recentOperations.value ?? []).filter((operation) =>
    ['REQUESTED', 'FAILED', 'REJECTED'].includes(operation.state),
  ),
)

const nextSteps = computed(() => {
  const steps: { label: string; route: string }[] = []
  if (!primaryDomain.value)
    steps.push({ label: 'Choose the server address', route: 'native-domains' })
  if (!(identities.value ?? []).some((identity) => identity.enabled))
    steps.push({ label: 'Link a Nostr identity', route: 'native-identities' })
  if (!hasWorkload.value)
    steps.push({
      label: 'Install an application or publish a site',
      route: 'app-management',
    })
  if (!hasBackup.value)
    steps.push({ label: 'Create the first backup', route: 'native-backups' })
  return steps
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Home"
      :title="status?.hostname || 'Your server'"
      description="What needs attention, what changed recently, and the system underneath your apps."
    />

    <template v-if="publicKey">
      <div
        class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-t tw:border-border-subtle tw:py-3 tw:text-sm"
      >
        <span>
          <span class="tw:text-muted-foreground">Server address</span>
          <code class="tw:ml-2 tw:font-mono">{{
            primaryDomain || 'Not chosen'
          }}</code>
        </span>
        <RouterLink :to="{ name: 'native-domains' }" class="workbench-link">
          {{ primaryDomain ? 'Change →' : 'Choose address →' }}
        </RouterLink>
      </div>
      <div
        class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:border-y tw:border-border-subtle tw:py-4"
      >
        <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-x-8 tw:gap-y-3">
          <StatusMark
            v-if="health"
            :state="health.ok ? 'healthy' : 'danger'"
            :label="
              health.ok
                ? 'Control plane reachable'
                : 'Control plane unavailable'
            "
          />
          <span v-if="status?.loadavg" class="tw:text-sm">
            <span class="tw:text-muted-foreground">Load</span>
            <code class="tw:ml-2 tw:font-mono">{{
              status.loadavg.join(' / ')
            }}</code>
          </span>
          <span v-if="health" class="tw:text-sm">
            <span class="tw:text-muted-foreground">API</span>
            <code class="tw:ml-2 tw:font-mono">{{ health.version }}</code>
          </span>
        </div>
        <Button variant="ghost" size="sm" :disabled="loading" @click="load">
          {{ loading ? 'Refreshing…' : 'Refresh state' }}
        </Button>
      </div>

      <RuledSection
        v-if="nextSteps.length"
        title="Next steps"
        description="Finish the essentials first; specialist controls can wait until you need them."
        labelledby="next-steps-title"
      >
        <ol
          class="tw:m-0 tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle tw:p-0"
        >
          <li
            v-for="step in nextSteps"
            :key="step.label"
            class="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:py-3 tw:text-sm"
          >
            <span>{{ step.label }}</span>
            <RouterLink :to="{ name: step.route }" class="workbench-link"
              >Open →</RouterLink
            >
          </li>
        </ol>
      </RuledSection>

      <RuledSection title="Needs attention" labelledby="attention-title">
        <ul
          v-if="attentionOperations.length"
          class="tw:m-0 tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle tw:p-0"
        >
          <li
            v-for="op in attentionOperations"
            :key="op.id"
            class="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:py-3"
          >
            <div class="tw:min-w-0">
              <strong class="tw:block tw:text-sm">{{
                op.tool ?? 'Signed operation'
              }}</strong>
              <code
                class="tw:block tw:truncate tw:font-mono tw:text-xs tw:text-muted-foreground"
                >{{ op.request_id }}</code
              >
            </div>
            <Badge :variant="operationStateVariant(op.state)">{{
              op.state
            }}</Badge>
          </li>
        </ul>
        <div
          v-else
          class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3 tw:py-2"
        >
          <StatusMark
            state="healthy"
            label="No recent operations need attention"
          />
          <RouterLink
            :to="{ name: 'native-diagnosis' }"
            class="workbench-link tw:text-sm"
            >Open diagnosis →</RouterLink
          >
        </div>
      </RuledSection>

      <RuledSection title="Recent signed activity" labelledby="activity-title">
        <template #actions>
          <RouterLink
            :to="{ name: 'native-operations' }"
            class="workbench-link tw:text-sm"
            >View ledger →</RouterLink
          >
        </template>
        <ul
          v-if="recentOperations && recentOperations.length"
          class="tw:m-0 tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle tw:p-0"
        >
          <li
            v-for="op in recentOperations"
            :key="op.id"
            class="tw:grid tw:grid-cols-[minmax(0,1fr)_auto] tw:items-center tw:gap-4 tw:py-3 tw:text-sm"
          >
            <div class="tw:min-w-0">
              <strong class="tw:block tw:font-medium">{{
                op.tool ?? 'Operation'
              }}</strong>
              <code
                class="tw:block tw:truncate tw:font-mono tw:text-xs tw:text-muted-foreground"
                >{{ op.request_id }}</code
              >
            </div>
            <Badge :variant="operationStateVariant(op.state)">{{
              op.state
            }}</Badge>
          </li>
        </ul>
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <EmptyState v-else title="No operations recorded yet" />
      </RuledSection>

      <RuledSection title="System inventory" labelledby="inventory-title">
        <div class="tw:grid tw:gap-8 tw:md:grid-cols-2">
          <div class="tw:min-w-0">
            <h3
              class="tw:m-0 tw:text-xs tw:font-semibold tw:text-muted-foreground"
            >
              NostrHost
            </h3>
            <dl
              class="tw:mt-2 tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle"
            >
              <div
                v-for="entry in nostrhostVersions"
                :key="entry.name"
                class="tw:flex tw:justify-between tw:gap-3 tw:py-2.5 tw:text-sm"
              >
                <dt>{{ entry.label }}</dt>
                <dd
                  class="tw:m-0 tw:font-mono tw:text-xs tw:text-muted-foreground"
                >
                  {{ entry.info.version ?? 'unknown' }}
                </dd>
              </div>
            </dl>
          </div>
          <div class="tw:min-w-0">
            <h3
              class="tw:m-0 tw:text-xs tw:font-semibold tw:text-muted-foreground"
            >
              Platform
            </h3>
            <dl
              class="tw:mt-2 tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle"
            >
              <div
                v-for="entry in platformVersions"
                :key="entry.name"
                class="tw:flex tw:justify-between tw:gap-3 tw:py-2.5 tw:text-sm"
              >
                <dt>{{ entry.label }}</dt>
                <dd
                  class="tw:m-0 tw:font-mono tw:text-xs tw:text-muted-foreground"
                >
                  {{ entry.info.version ?? 'unknown' }}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <p
          v-if="!loading && !versions"
          class="tw:text-sm tw:text-muted-foreground"
        >
          No version data yet.
        </p>
      </RuledSection>

      <RuledSection title="Linked identities" labelledby="identities-title">
        <template #actions>
          <RouterLink
            :to="{ name: 'native-identities' }"
            class="workbench-link tw:text-sm"
            >Manage identities →</RouterLink
          >
        </template>
        <div v-if="identities && identities.length" class="tw:overflow-x-auto">
          <table class="tw:w-full tw:border-collapse tw:text-left tw:text-sm">
            <thead
              class="tw:border-y tw:border-border-subtle tw:text-xs tw:text-muted-foreground"
            >
              <tr>
                <th class="tw:py-2 tw:font-medium">Account</th>
                <th class="tw:py-2 tw:font-medium">Signer</th>
                <th class="tw:py-2 tw:font-medium">Public key</th>
                <th class="tw:py-2 tw:text-right tw:font-medium">State</th>
              </tr>
            </thead>
            <tbody class="tw:divide-y tw:divide-border-subtle">
              <tr v-for="identity in identities" :key="identity.pubkey">
                <td class="tw:py-3 tw:font-medium">{{ identity.username }}</td>
                <td class="tw:py-3 tw:text-muted-foreground">
                  {{ identity.signer_type }}
                </td>
                <td class="tw:py-3">
                  <code class="tw:font-mono tw:text-xs">{{
                    shortenKey(identity.pubkey)
                  }}</code>
                </td>
                <td class="tw:py-3 tw:text-right">
                  <Badge :variant="identity.enabled ? 'success' : 'neutral'">{{
                    identity.enabled ? 'Enabled' : 'Disabled'
                  }}</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else-if="!loading" title="No linked identities yet" />
      </RuledSection>
    </template>
  </PageLayout>
</template>
