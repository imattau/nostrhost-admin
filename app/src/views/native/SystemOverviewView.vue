<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()
const { danger } = useNotifications()

const health = ref<Health | null>(null)
const status = ref<SystemStatus | null>(null)
const versions = ref<SystemVersions | null>(null)
const identities = ref<Identity[] | null>(null)
const recentOperations = ref<OperationEntry[] | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    await sync()
    const [healthResult, statusResult, versionsResult, identitiesResult, operationsResult] =
      await Promise.all([
        getHealth(),
        getSystemStatus(),
        getSystemVersions(),
        getIdentities(),
        listOperations(5),
      ])
    health.value = healthResult
    status.value = statusResult
    versions.value = versionsResult
    identities.value = identitiesResult
    recentOperations.value = operationsResult
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to load system status.'))
  } finally {
    loading.value = false
  }
}

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

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="NostrHost native status"
      title="System overview"
      description="Read-only reachability, version, and identity reads from the native API. This screen cannot change host state."
    />

    <div v-if="publicKey" class="tw:flex tw:items-center tw:justify-between">
      <p class="tw:text-sm tw:text-muted-foreground">
        Signed in as
        <code class="tw:font-mono">{{ shortenKey(publicKey) }}</code>
      </p>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">{{
        loading ? 'Refreshing…' : 'Refresh'
      }}</Button>
    </div>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Host status</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="health || status" class="tw:flex tw:flex-wrap tw:items-center tw:gap-x-6 tw:gap-y-2">
          <div v-if="health" class="tw:flex tw:items-center tw:gap-2">
            <Badge :variant="health.ok ? 'success' : 'danger'">
              {{ health.ok ? 'Reachable' : 'Unreachable' }}
            </Badge>
            <span class="tw:text-sm tw:text-muted-foreground"
              >API version {{ health.version }}</span
            >
          </div>
          <div v-if="status" class="tw:flex tw:items-center tw:gap-1.5 tw:text-sm">
            <span class="tw:text-muted-foreground">Host</span>
            <code class="tw:font-mono tw:text-foreground">{{ status.hostname }}</code>
          </div>
          <div v-if="status?.loadavg" class="tw:flex tw:items-center tw:gap-1.5 tw:text-sm">
            <span class="tw:text-muted-foreground">Load</span>
            <code class="tw:font-mono tw:text-foreground">{{ status.loadavg.join(' / ') }}</code>
          </div>
        </div>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Checking…' : 'No health data yet.' }}
        </p>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Recent operations</span>
          <RouterLink
            :to="{ name: 'native-operations' }"
            class="tw:text-xs tw:font-medium tw:text-brand-500 tw:hover:underline"
            >View all →</RouterLink
          >
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul v-if="recentOperations && recentOperations.length" class="tw:grid tw:gap-2">
          <li
            v-for="op in recentOperations"
            :key="op.id"
            class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
          >
            <code class="tw:font-mono tw:text-xs">{{ op.tool ?? op.request_id }}</code>
            <Badge :variant="operationStateVariant(op.state)">{{ op.state }}</Badge>
          </li>
        </ul>
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <EmptyState v-else title="No operations recorded yet" />
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Diagnosis</span>
          <RouterLink
            :to="{ name: 'native-diagnosis' }"
            class="tw:text-xs tw:font-medium tw:text-brand-500 tw:hover:underline"
            >View report →</RouterLink
          >
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="tw:text-sm tw:text-muted-foreground">
          Per-category health checks — DNS, mail, ports, services, and more.
          Reachability alone doesn't cover this; open the full report to see
          current issues and manage ignore filters.
        </p>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Installed versions</CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-5">
        <template v-if="versions && Object.keys(versions).length">
          <div v-if="nostrhostVersions.length" class="tw:grid tw:gap-2">
            <p
              class="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-muted-foreground"
            >
              NostrHost
            </p>
            <ul class="tw:grid tw:gap-2">
              <li
                v-for="entry in nostrhostVersions"
                :key="entry.name"
                class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
              >
                <span class="tw:text-sm tw:text-foreground">{{
                  entry.label
                }}</span>
                <span class="tw:text-sm tw:text-muted-foreground">
                  {{ entry.info.version ?? 'unknown' }}
                  <template v-if="entry.info.repo">
                    · {{ entry.info.repo }}</template
                  >
                </span>
              </li>
            </ul>
          </div>

          <div v-if="platformVersions.length" class="tw:grid tw:gap-2">
            <p
              class="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-muted-foreground"
            >
              Platform (built on YunoHost)
            </p>
            <ul class="tw:grid tw:gap-2">
              <li
                v-for="entry in platformVersions"
                :key="entry.name"
                class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
              >
                <span class="tw:text-sm tw:text-foreground">{{
                  entry.label
                }}</span>
                <span class="tw:text-sm tw:text-muted-foreground">
                  {{ entry.info.version ?? 'unknown' }}
                  <template v-if="entry.info.repo">
                    · {{ entry.info.repo }}</template
                  >
                </span>
              </li>
            </ul>
          </div>
        </template>
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <EmptyState v-else title="No version data yet" />
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Linked identities</CardTitle>
      </CardHeader>
      <CardContent>
        <ul v-if="identities && identities.length" class="tw:grid tw:gap-2">
          <li
            v-for="identity in identities"
            :key="identity.pubkey"
            class="tw:grid tw:gap-1 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <strong class="tw:text-sm tw:text-foreground">{{
                identity.username
              }}</strong>
              <Badge :variant="identity.enabled ? 'success' : 'neutral'">
                {{ identity.enabled ? 'Enabled' : 'Disabled' }}
              </Badge>
            </div>
            <code class="tw:font-mono tw:text-xs tw:text-muted-foreground">{{
              shortenKey(identity.pubkey)
            }}</code>
            <span class="tw:text-xs tw:text-muted-foreground"
              >{{ identity.signer_type
              }}<template v-if="identity.label">
                · {{ identity.label }}</template
              ></span
            >
          </li>
        </ul>
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <EmptyState v-else title="No linked identities yet" />
      </CardContent>
    </Card>
  </PageLayout>
</template>
