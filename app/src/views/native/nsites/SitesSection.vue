<script setup lang="ts">
import { inject, ref } from 'vue'

import {
  snapshotNsite,
  unregisterNsite,
  type NsiteSite,
} from '@/api/nativeNsites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import { Camera } from '@lucide/vue'
import { PackageOpen } from '@lucide/vue'
import { signAndSubmitSnapshot } from '@/lib/nsite/publish'
import { siteLabel } from './helpers'
import { NSITE_STATE_KEY } from './useNsiteState'

defineProps<{ wizardVisible: boolean }>()
const emit = defineEmits<{ 'toggle-wizard': [] }>()

const { sync } = useSigner()
const { success } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!
const { status, sites, sitesLoading } = nsite

const unregistering = ref('')
const { run } = useActionRunner(unregistering, '')
const snapshotting = ref('')
const { run: runSnapshot } = useActionRunner(snapshotting, '')
const {
  pending: confirmingUnregister,
  request: requestUnregister,
  cancel: cancelUnregister,
} = useConfirm<NsiteSite | null>(null)

function siteKindName(site: NsiteSite): string {
  return site.kind === 35128
    ? 'named'
    : site.kind === 15128
      ? 'root'
      : String(site.kind)
}

function canSnapshot(site: NsiteSite): boolean {
  return site.kind === 35128 || site.kind === 15128
}

async function snapshotSite(site: NsiteSite) {
  const items = site.paths ?? []
  const servers = site.servers ?? []
  if (!items.length || !servers.length) {
    success('Snapshot needs the site manifest to have paths and servers.')
    return
  }
  await runSnapshot(
    `${site.pubkey}:${site.d}`,
    async () => {
      await sync()
      await signAndSubmitSnapshot({
        pubkey: site.pubkey,
        kind: site.kind,
        d: site.d,
        items,
        servers,
        signEvent: (event) => window.nostr!.signEvent(event),
        submit: (args) =>
          snapshotNsite({
            event: args.event,
            plan_sha256: args.plan_sha256,
          }),
      })
      success('Snapshot submitted.')
      await nsite.loadSites()
    },
    'Failed to snapshot the site.',
  )
}

async function confirmUnregister() {
  const site = confirmingUnregister.value
  if (!site) return
  cancelUnregister()
  await run(
    `${site.pubkey}:${site.d}`,
    async () => {
      await sync()
      await unregisterNsite({ pubkey: site.pubkey, d: site.d })
      success('Site unregister submitted.')
      await nsite.loadSites()
    },
    'Failed to unregister the site.',
  )
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <span>Registered sites</span>
        <span class="tw:text-xs tw:font-normal tw:text-muted-foreground"
          >root/named manifests are mutable; snapshots are immutable
          history</span
        >
        <Button
          variant="outline"
          size="sm"
          :disabled="!status?.enabled"
          @click="emit('toggle-wizard')"
          >{{ wizardVisible ? 'Close wizard' : 'Publish a site' }}</Button
        >
      </CardTitle>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <p v-if="sitesLoading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
        Loading…
      </p>
      <EmptyState
        v-else-if="!sites.length"
        :icon="PackageOpen"
        title="No registered sites"
        description="A registered site is an allowlisted owner pubkey; publishing records its manifest and serves it over HTTPS."
      >
        <template #action>
          <Button
            variant="outline"
            size="sm"
            :disabled="!status?.enabled"
            @click="emit('toggle-wizard')"
            >{{
              wizardVisible ? 'Close wizard' : 'Publish your first site'
            }}</Button
          >
        </template>
      </EmptyState>
      <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:p-0 tw:list-none">
        <li
          v-for="site in sites"
          :key="site.pubkey + ':' + site.d"
          class="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2"
        >
          <code class="tw:font-mono tw:text-sm">{{ siteLabel(site) }}</code>
          <Badge variant="neutral">{{ siteKindName(site) }}</Badge>
          <Badge
            :variant="site.status === 'published' ? 'success' : 'warning'"
            :title="
              site.status === 'published'
                ? 'A manifest has been published; the gateway is serving it.'
                : 'Allowlisted, but no manifest has been published yet.'
            "
            >{{ site.status === 'published' ? 'Published' : 'Not published' }}</Badge
          >
          <template v-if="site.title">
            <span class="tw:text-sm">{{ site.title }}</span>
          </template>
          <template v-if="site.last_event_id">
            <span
              class="tw:text-xs tw:text-muted-foreground tw:font-mono"
              :title="site.last_event_id"
              >{{ site.last_event_id.slice(0, 12) }}…</span
            >
          </template>
          <template v-if="site.snapshots?.length">
            <Badge variant="neutral" class="tw:gap-1" :title="site.snapshots.join('\n')"
              ><Camera class="tw:h-3 tw:w-3" />
              {{ site.snapshots.length }} snapshot{{
                site.snapshots.length === 1 ? '' : 's'
              }}</Badge
            >
          </template>
          <Button
            v-if="canSnapshot(site)"
            variant="ghost"
            size="sm"
            :disabled="snapshotting !== '' || unregistering !== ''"
            :title="
              'Snapshot the current manifest — root/named manifests are mutable, snapshots are immutable history.'
            "
            @click="snapshotSite(site)"
            >{{
              snapshotting === site.pubkey + ':' + site.d
                ? 'Snapshotting…'
                : 'Snapshot'
            }}</Button
          >
          <Button
            variant="ghost"
            size="sm"
            class="tw:ml-auto"
            :disabled="unregistering !== ''"
            @click="requestUnregister(site)"
            >{{
              unregistering === site.pubkey + ':' + site.d
                ? 'Removing…'
                : 'Unregister'
            }}</Button
          >
        </li>
      </ul>
    </CardContent>
  </Card>

  <ConfirmDialog
    :open="confirmingUnregister !== null"
    tier="disruptive"
    title="Unregister this site?"
    description="The site's manifest stops being served over HTTPS. You'll need to publish it again to bring it back."
    confirm-label="Unregister"
    :busy="
      confirmingUnregister !== null &&
      unregistering ===
        confirmingUnregister.pubkey + ':' + confirmingUnregister.d
    "
    @confirm="confirmUnregister"
    @cancel="cancelUnregister"
  />
</template>
