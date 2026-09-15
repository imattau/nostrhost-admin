<script setup lang="ts">
import { computed, inject, ref } from 'vue'

import {
  getNsitePublishPlan,
  publishNsite,
  type NsitePublishPlan,
} from '@/api/nativeNsites'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useActionRunner } from '@/composables/useActionRunner'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { parseList } from '@/lib/utils'
import { KIND_ROOT, KIND_NAMED } from '@/lib/nsite/manifest'
import { siteLabel } from './helpers'
import { NSITE_STATE_KEY } from './useNsiteState'

const { publicKey, sync } = useSigner()
const { success } = useNotifications()
const nsite = inject(NSITE_STATE_KEY)!
const { sites } = nsite

const copyBusy = ref('')
const { run } = useActionRunner(copyBusy, '')
const copySourceKey = ref('')
const copyD = ref('')
const copyServers = ref('')
const copyPlan = ref<NsitePublishPlan | null>(null)

const copySources = computed(() =>
  sites.value.map((site) => ({
    value: `${site.kind}:${site.pubkey}:${site.d}`,
    label: siteLabel(site),
  })),
)

const hasSigner = computed(() => Boolean(window.nostr))

function copyTargetKind() {
  return Number(copySourceKey.value.split(':')[0] || KIND_ROOT)
}

async function buildCopyPlan() {
  await run(
    'plan',
    async () => {
      copyPlan.value = null
      await sync()
      const result = await getNsitePublishPlan({
        pubkey: publicKey.value ?? '',
        kind: copyTargetKind(),
        d: copyD.value.trim(),
        servers: copyServers.value ? parseList(copyServers.value) : undefined,
        copy_of: copySourceKey.value,
      })
      copyPlan.value = result.plan
      success(
        `Copy plan ready: ${result.plan.items.length} file(s), a/A tags set. Review and sign to publish.`,
      )
    },
    'Failed to build the copy plan.',
  )
}

async function submitCopy() {
  if (!copyPlan.value) return
  const plan = copyPlan.value
  await run(
    'publish',
    async () => {
      const signed = await window.nostr!.signEvent({
        kind: plan.unsigned_event.kind,
        pubkey: plan.unsigned_event.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: plan.unsigned_event.tags,
        content: plan.unsigned_event.content,
      })
      await publishNsite({
        event: signed,
        plan_sha256: plan.plan_sha256,
        relays: plan.relays,
      })
      success('Copy published.')
      copyPlan.value = null
      copySourceKey.value = ''
      copyD.value = ''
      copyServers.value = ''
      await Promise.all([nsite.load(), nsite.loadSites()])
    },
    'Failed to publish the copy.',
  )
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Create my copy</CardTitle>
      <p class="tw:m-0 tw:text-sm tw:text-muted-foreground">
        Copy a registered site into your own namespace. The copied manifest
        keeps the same blobs (content-addressed, so nothing is re-uploaded) and
        carries <code>a</code> (parent) and{' '} <code>A</code> (origin) tags
        pointing at the source, per NIP-5A. You sign it with your own key, so
        the copy is published under your pubkey.
      </p>
    </CardHeader>
    <CardContent class="tw:grid tw:gap-3">
      <div class="tw:grid tw:grid-cols-1 tw:gap-2 sm:tw:grid-cols-3">
        <div class="tw:grid tw:gap-1">
          <Label for="copy-source">Source site</Label>
          <Select id="copy-source" v-model="copySourceKey">
            <option value="" disabled>Choose a registered site…</option>
            <option
              v-for="opt in copySources"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </Select>
        </div>
        <div class="tw:grid tw:gap-1">
          <Label for="copy-d">Copy d tag</Label>
          <Input
            id="copy-d"
            v-model="copyD"
            placeholder="fork-name (named copies only)"
            :disabled="copyTargetKind() !== KIND_NAMED"
          />
        </div>
        <div class="tw:grid tw:gap-1">
          <Label for="copy-servers">Blossom servers</Label>
          <Input
            id="copy-servers"
            v-model="copyServers"
            placeholder="https://blossom.primal.net, …"
          />
        </div>
      </div>

      <Button
        :disabled="copyBusy !== '' || !copySourceKey || !publicKey"
        @click="buildCopyPlan"
        >{{
          copyBusy === 'plan' ? 'Building plan…' : 'Build copy plan'
        }}</Button
      >

      <div
        v-if="copyPlan"
        class="tw:grid tw:gap-1.5 tw:rounded-md tw:border tw:px-3 tw:py-2 tw:text-xs"
      >
        <div class="tw:flex tw:justify-between tw:gap-3">
          <span class="tw:text-muted-foreground">Source</span>
          <code class="tw:font-mono">{{ copyPlan.copy_of }}</code>
        </div>
        <div class="tw:flex tw:justify-between tw:gap-3">
          <span class="tw:text-muted-foreground">Target</span>
          <code class="tw:font-mono"
            >{{ copyPlan.kind }}:{{ copyPlan.pubkey.slice(0, 16) }}…:{{
              copyPlan.d
            }}</code
          >
        </div>
        <div class="tw:flex tw:justify-between tw:gap-3">
          <span class="tw:text-muted-foreground">Files</span>
          <span class="tw:font-mono">{{ copyPlan.items.length }}</span>
        </div>
        <div class="tw:flex tw:justify-between tw:gap-3">
          <span class="tw:text-muted-foreground">Plan digest</span>
          <code class="tw:font-mono tw:truncate"
            >{{ copyPlan.plan_sha256.slice(0, 16) }}…</code
          >
        </div>
      </div>

      <Button
        v-if="copyPlan"
        variant="primary"
        :disabled="copyBusy === 'publish' || !hasSigner"
        @click="submitCopy"
        >{{
          copyBusy === 'publish' ? 'Publishing…' : 'Sign & publish copy'
        }}</Button
      >
    </CardContent>
  </Card>
</template>
