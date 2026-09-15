<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import { attachNsiteDomain, detachNsiteDomain, type NsiteCustomDomain } from '@/api/nativeNsites'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'
import EmptyState from '@/components/native/EmptyState.vue'
import { Globe2 } from '@lucide/vue'
import { siteLabel } from './helpers'
import { NSITE_STATE_KEY } from './useNsiteState'

const { sync } = useSigner()
const { success, danger } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!
const { status, sites, customDomains, domainsLoading } = nsite

const attachBusy = ref(false)
const detaching = ref('')
const cdFqdn = ref('')
const cdSiteKey = ref('')
const cdMethod = ref<'cname' | 'txt'>('cname')

const siteOptions = computed(() =>
  sites.value.map((site) => ({
    value: `${site.pubkey}:${site.d}`,
    label: siteLabel(site),
  })),
)

function domainLabel(domain: NsiteCustomDomain): string {
  return domain.d
    ? `${domain.pubkey.slice(0, 8)}…/d=${domain.d}`
    : `${domain.pubkey.slice(0, 16)}…`
}

function selectedSitePubkeyD() {
  const [pubkey = '', d = ''] = cdSiteKey.value.split(':')
  return { pubkey, d }
}

async function confirmAttachDomain() {
  attachBusy.value = true
  try {
    await sync()
    const { pubkey, d } = selectedSitePubkeyD()
    await attachNsiteDomain({
      fqdn: cdFqdn.value.trim(),
      pubkey,
      d: d || undefined,
      method: cdMethod.value,
    })
    success('Domain attach submitted; the ownership proof is checked against DNS.')
    cdFqdn.value = ''
    cdSiteKey.value = ''
    await nsite.loadDomains()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to attach the domain.'))
  } finally {
    attachBusy.value = false
  }
}

async function confirmDetachDomain(fqdn: string) {
  detaching.value = fqdn
  try {
    await sync()
    await detachNsiteDomain({ fqdn })
    success(`Domain ${fqdn} detach submitted.`)
    await nsite.loadDomains()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to detach the domain.'))
  } finally {
    detaching.value = ''
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Custom domains</CardTitle>
      <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
        Attach an FQDN to a registered site so it is served on its own
        domain. Ownership is proven against DNS (a CNAME to the gateway
        domain, or a <code>nostrhost-site:&lt;pubkey&gt;</code> TXT record
        under <code>_nostrhost-site.&lt;fqdn&gt;</code>) before the Caddy
        route and mapping are added.
      </p>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <p
        v-if="domainsLoading"
        class="tw:m-0 tw:text-sm tw:text-muted-foreground"
      >
        Loading…
      </p>
      <ul
        v-else-if="customDomains.length"
        class="tw:m-0 tw:grid tw:gap-2 tw:p-0 tw:list-none"
      >
        <li
          v-for="domain in customDomains"
          :key="domain.fqdn"
          class="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-md tw:border tw:px-3 tw:py-2"
        >
          <code class="tw:font-mono tw:text-sm">{{ domain.fqdn }}</code>
          <Badge variant="neutral">{{ domain.method }}</Badge>
          <span class="tw:text-xs tw:text-muted-foreground tw:font-mono">
            → {{ domainLabel(domain) }}
          </span>
          <Button
            variant="ghost"
            size="sm"
            class="tw:ml-auto"
            :disabled="detaching !== ''"
            @click="confirmDetachDomain(domain.fqdn)"
            >{{
              detaching === domain.fqdn ? 'Detaching…' : 'Detach'
            }}</Button
          >
        </li>
      </ul>
      <EmptyState
        v-else-if="!domainsLoading"
        :icon="Globe2"
        title="No custom domains"
        description="Attach a domain you own to a registered site below."
      />

      <div class="tw:grid tw:grid-cols-1 tw:gap-2 sm:tw:grid-cols-2">
        <div class="tw:grid tw:gap-1">
          <Label for="cd-fqdn">FQDN</Label>
          <Input
            id="cd-fqdn"
            v-model="cdFqdn"
            placeholder="blog.example.com"
            :disabled="!status?.enabled"
          />
        </div>
        <div class="tw:grid tw:gap-1">
          <Label for="cd-site">Site</Label>
          <Select
            id="cd-site"
            v-model="cdSiteKey"
            :disabled="!status?.enabled"
          >
            <option value="" disabled>Choose a registered site…</option>
            <option
              v-for="opt in siteOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </Select>
        </div>
        <div class="tw:grid tw:gap-1">
          <Label for="cd-method">Proof</Label>
          <Select
            id="cd-method"
            v-model="cdMethod"
            :disabled="!status?.enabled"
          >
            <option value="cname">CNAME to the gateway domain</option>
            <option value="txt">
              TXT under _nostrhost-site.&lt;fqdn&gt;
            </option>
          </Select>
        </div>
        <div class="tw:flex tw:items-end">
          <Button
            class="tw:w-full"
            :disabled="
              attachBusy || !status?.enabled || !cdFqdn.trim() || !cdSiteKey
            "
            @click="confirmAttachDomain"
            >{{ attachBusy ? 'Attaching…' : 'Attach domain' }}</Button
          >
        </div>
      </div>
    </CardContent>
  </Card>
</template>
