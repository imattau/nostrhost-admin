<script setup lang="ts">
import { inject, ref } from 'vue'

import { unregisterNsite, type NsiteSite } from '@/api/nativeNsites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'
import EmptyState from '@/components/native/EmptyState.vue'
import { PackageOpen } from '@lucide/vue'
import { siteLabel } from './helpers'
import { NSITE_STATE_KEY } from './useNsiteState'

defineProps<{ wizardVisible: boolean }>()
const emit = defineEmits<{ 'toggle-wizard': [] }>()

const { sync } = useSigner()
const { success, danger } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!
const { status, sites, sitesLoading } = nsite

const unregistering = ref('')

function siteKindName(site: NsiteSite): string {
  return site.kind === 35128
    ? 'named'
    : site.kind === 15128
      ? 'root'
      : String(site.kind)
}

async function confirmUnregister(site: NsiteSite) {
  unregistering.value = `${site.pubkey}:${site.d}`
  try {
    await sync()
    await unregisterNsite({ pubkey: site.pubkey, d: site.d })
    success('Site unregister submitted.')
    await nsite.loadSites()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to unregister the site.'))
  } finally {
    unregistering.value = ''
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle
        class="tw:flex tw:items-center tw:justify-between tw:gap-2"
      >
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
      <p
        v-if="sitesLoading"
        class="tw:m-0 tw:text-sm tw:text-muted-foreground"
      >
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
          <Button
            variant="ghost"
            size="sm"
            class="tw:ml-auto"
            :disabled="unregistering !== ''"
            @click="confirmUnregister(site)"
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
</template>
