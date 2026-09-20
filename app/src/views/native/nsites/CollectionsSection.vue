<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import {
  discoverCollections,
  getCollection,
  getCollectionPlan,
  publishCollection,
  type CollectionEntry,
  type NsiteCollection,
  type NsiteCollectionGetEnvelope,
  type ResolvedCollectionEntry,
} from '@/api/nativeNsites'
import { getConnectivity } from '@/api/nativeConnectivity'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useActionRunner } from '@/composables/useActionRunner'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import EmptyState from '@/components/native/EmptyState.vue'
import { parseList, truncatePubkey } from '@/lib/utils'
import { dedupeEntries } from '@/lib/nsite/collection'
import { signAndSubmitCollection } from '@/lib/nsite/collectionPublish'
import { toErrorMessage } from '@/utils/errors'
import { naddrEncode } from 'nostr-tools/nip19'

const { publicKey } = useSigner()
const { success, danger } = useNotifications()

const browseKind = ref<'collections' | 'detail'>('collections')
const collections = ref<NsiteCollection[] | null>(null)
const collectionsLoading = ref(false)
const collectionsLoaded = ref(false)
const discoverError = ref('')
const { run: runDiscover } = useActionRunner(collectionsLoading, false)

const activeCollection = ref<NsiteCollectionGetEnvelope | null>(null)
const detailBusy = ref(false)
const { run: runDetail } = useActionRunner(detailBusy, false)

// -- authoring -------------------------------------------------------------

const wizardOpen = ref(false)
const wStep = ref(0) // 0 identity · 1 entries · 2 relays · 3 review · 4 done
const wD = ref('')
const wTitle = ref('')
const wDescription = ref('')
const wImage = ref('')
const wRelays = ref('')
const wCopyOf = ref('')
const wEntries = ref<CollectionEntry[]>([])
const wPinned = ref(false)
const wPinnedRef = ref('')
const wLiveRef = ref('')
const reviewEvent = ref<unknown>(null)
const reviewDigest = ref('')
const publishResult = ref<unknown>(null)
const wizardBusy = ref('')
const { run: runWizard } = useActionRunner(wizardBusy, '')

const signerAvailable = ref(Boolean(window.nostr))

async function loadCollections(force = false) {
  if (collectionsLoaded.value && !force) return
  if (collectionsLoading.value) return
  await runDiscover(
    true,
    async () => {
      discoverError.value = ''
      const result = await discoverCollections(force)
      collections.value = result.collections
      collectionsLoaded.value = true
    },
    (cause) => {
      discoverError.value = toErrorMessage(
        cause,
        'Collection discovery failed.',
      )
    },
  )
}

async function openCollection(coordinate: string) {
  await runDetail(
    true,
    async () => {
      activeCollection.value = await getCollection({ coordinate })
      browseKind.value = 'detail'
    },
    'Failed to load the collection.',
  )
}

function backToBrowse() {
  wizardOpen.value = false
  browseKind.value = 'collections'
  activeCollection.value = null
}

function copyNaddr() {
  const c = activeCollection.value
  if (!c?.coordinate) return
  const parts = c.coordinate.split(':')
  const relays = (c as { relays_queried?: string[] }).relays_queried?.slice(
    0,
    3,
  )
  const addr = naddrEncode({
    kind: 30004,
    pubkey: parts[1],
    identifier: parts[2] || '',
    relays: relays && relays.length ? relays : undefined,
  })
  void navigator.clipboard.writeText(addr)
  success(`Copied naddr (${addr.slice(0, 12)}…).`)
}

async function openWizard(copyOf = '') {
  wCopyOf.value = copyOf
  wStep.value = 0
  wD.value = ''
  wTitle.value = ''
  wDescription.value = ''
  wImage.value = ''
  wEntries.value = []
  wPinned.value = false
  wPinnedRef.value = ''
  wLiveRef.value = ''
  reviewEvent.value = null
  reviewDigest.value = ''
  publishResult.value = null
  signerAvailable.value = Boolean(window.nostr)
  wizardOpen.value = true
  if (copyOf) {
    const c = activeCollection.value
    if (c?.entries) {
      wEntries.value = c.entries.map((e) => ({
        kind: e.kind,
        ref: e.ref,
        relay: e.relay,
      }))
      wD.value = `${c.d}-copy`
      wTitle.value = `${c.title || c.d} (copy)`
    }
  }
  try {
    const network = await getConnectivity()
    wRelays.value = network.effective.relays.nsite.join(', ')
  } catch {
    wRelays.value = ''
  }
}

function addLiveEntry() {
  const ref = wLiveRef.value.trim()
  if (!ref) return
  let entry: CollectionEntry | null = null
  if (/^15128:[0-9a-f]{64}:$/.test(ref)) {
    entry = { kind: 'live-root', ref, relay: '' }
  } else if (/^35128:[0-9a-f]{64}:[a-zA-Z0-9_-]+$/.test(ref)) {
    entry = { kind: 'live-named', ref, relay: '' }
  }
  if (!entry) {
    danger('Use a coordinate like 15128:<pubkey>: or 35128:<pubkey>:<d>.')
    return
  }
  wEntries.value = dedupeEntries([...wEntries.value, entry])
  wLiveRef.value = ''
}

function addPinnedEntry() {
  const ref = wPinnedRef.value.trim()
  if (!/^[0-9a-f]{64}$/.test(ref)) {
    danger('A pinned entry needs a 64-hex kind-5128 snapshot event id.')
    return
  }
  wEntries.value = dedupeEntries([
    ...wEntries.value,
    { kind: 'pinned', ref, relay: '' },
  ])
  wPinnedRef.value = ''
}

function removeEntry(index: number) {
  wEntries.value = wEntries.value.filter((_, i) => i !== index)
}

function moveEntry(index: number, delta: number) {
  const next = index + delta
  if (next < 0 || next >= wEntries.value.length) return
  const items = [...wEntries.value]
  ;[items[index], items[next]] = [items[next], items[index]]
  wEntries.value = items
}

async function doReview() {
  await runWizard(
    'review',
    async () => {
      if (!wD.value.trim()) {
        danger('Give the collection a d identifier.')
        return
      }
      if (!wTitle.value.trim()) {
        danger('Give the collection a title.')
        return
      }
      if (!wEntries.value.length) {
        danger('Add at least one site entry.')
        return
      }
      if (!signerAvailable.value) {
        danger(
          'Publishing needs a NIP-07 signer (window.nostr). Sign in with one, or wait for NIP-46.',
        )
        return
      }
      const relays = parseList(wRelays.value)
      const plan = await getCollectionPlan({
        pubkey: publicKey.value ?? '',
        d: wD.value.trim(),
        title: wTitle.value.trim(),
        description: wDescription.value.trim(),
        image: wImage.value.trim(),
        entries: wEntries.value,
        relays: relays.length ? relays : undefined,
        copy_of: wCopyOf.value || undefined,
      })
      reviewEvent.value = plan.plan.unsigned_event
      reviewDigest.value = plan.plan.plan_sha256
      wRelays.value = relays.join(', ')
      wStep.value = 3
    },
    'Failed to build the collection plan.',
  )
}

async function doPublish() {
  await runWizard(
    'publish',
    async () => {
      const relays = parseList(wRelays.value)
      const outcome = await signAndSubmitCollection({
        pubkey: publicKey.value ?? '',
        d: wD.value.trim(),
        title: wTitle.value.trim(),
        description: wDescription.value.trim(),
        image: wImage.value.trim(),
        entries: wEntries.value,
        relays,
        signEvent: (event) => window.nostr!.signEvent(event),
        submit: (args) =>
          publishCollection({
            event: args.event,
            plan_sha256: args.plan_sha256,
            relays: args.relays,
          }),
      })
      publishResult.value = outcome
      wStep.value = 4
      collectionsLoaded.value = false
      void loadCollections()
    },
    'Publish failed.',
  )
}

function formatDate(ts: number | undefined): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

function entryKindLabel(entry: ResolvedCollectionEntry): string {
  return entry.kind === 'pinned'
    ? 'Pinned snapshot'
    : entry.kind === 'live-named'
      ? 'Live named'
      : 'Live site'
}

const publishEventId = computed(() => {
  const value = publishResult.value as { event_id?: string } | null
  return value?.event_id?.slice(0, 16) ?? ''
})

function openSite(url: string) {
  if (url) window.open(url, '_blank')
}

onMounted(() => {
  if (publicKey.value) void loadCollections()
})
</script>

<template>
  <div class="tw:grid tw:gap-4">
    <!-- discovery / grid -->
    <template v-if="browseKind === 'collections'">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Collections</span>
            <span class="tw:text-xs tw:font-normal tw:text-muted-foreground"
              >curated kind-30004 lists signed by their authors, published to
              external relays</span
            >
            <div class="tw:flex tw:gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="collectionsLoading"
                @click="loadCollections(true)"
                >{{ collectionsLoading ? 'Scanning…' : 'Refresh' }}</Button
              >
              <Button
                size="sm"
                :disabled="!signerAvailable"
                @click="openWizard()"
                >New collection</Button
              >
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert
            v-if="discoverError"
            variant="warning"
            role="status"
            class="tw:mb-3"
          >
            {{ discoverError }}
          </Alert>
          <p
            v-if="collectionsLoading && !collections"
            class="tw:m-0 tw:text-sm"
          >
            Scanning relays…
          </p>
          <EmptyState
            v-else-if="collectionsLoaded && !collections?.length"
            title="No collections discovered yet"
            description="nsite.collection.discover scans the configured catalogue + lookup relays for kind-30004 t=nsite lists."
          />
          <div v-else-if="collections?.length" class="tw:grid tw:gap-3">
            <button
              v-for="col in collections"
              :key="col.coordinate"
              type="button"
              class="tw:grid tw:gap-1 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:p-3 tw:text-left hover:tw:bg-surface-hover"
              @click="openCollection(col.coordinate)"
            >
              <div class="tw:flex tw:items-center tw:gap-2">
                <span class="tw:truncate tw:text-sm tw:font-medium">{{
                  col.title || col.d
                }}</span>
                <Badge variant="neutral">{{ col.entries }} entries</Badge>
              </div>
              <p
                v-if="col.description"
                class="tw:m-0 tw:line-clamp-2 tw:text-xs tw:text-muted-foreground"
              >
                {{ col.description }}
              </p>
              <p
                class="tw:m-0 tw:font-mono tw:text-xs tw:text-muted-foreground"
              >
                {{ truncatePubkey(col.pubkey) }} · updated
                {{ formatDate(col.created_at) }}
              </p>
            </button>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- collection detail -->
    <template v-else-if="browseKind === 'detail'">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"
          >
            <div class="tw:grid tw:gap-0.5">
              <span>{{
                activeCollection?.title || activeCollection?.d || 'Collection'
              }}</span>
              <span class="tw:font-mono tw:text-xs tw:text-muted-foreground">{{
                activeCollection?.coordinate
              }}</span>
            </div>
            <div class="tw:flex tw:gap-2">
              <Button variant="outline" size="sm" @click="copyNaddr()"
                >Copy naddr</Button
              >
              <Button variant="outline" size="sm" @click="openWizard()"
                >Save a copy</Button
              >
              <Button variant="outline" size="sm" @click="backToBrowse"
                >Back</Button
              >
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p v-if="activeCollection?.description" class="tw:m-0 tw:text-sm">
            {{ activeCollection.description }}
          </p>
          <p
            v-if="activeCollection?.blocked"
            class="tw:m-0 tw:text-xs tw:text-muted-foreground"
          >
            This collection's curator is on the operator mute list; entries are
            shown, the curator is not endorsed.
          </p>
          <p
            v-if="detailBusy && !activeCollection?.found"
            class="tw:m-0 tw:text-sm"
          >
            Resolving…
          </p>
          <EmptyState
            v-else-if="activeCollection && !activeCollection.found"
            title="Collection not found"
            description="No valid kind-30004 t=nsite event resolved for this coordinate."
          />
          <ol v-else class="tw:m-0 tw:grid tw:gap-2 tw:p-0 tw:list-none">
            <li
              v-for="(entry, index) in activeCollection?.entries || []"
              :key="entry.ref"
              class="tw:grid tw:gap-1 tw:rounded-md tw:border tw:border-border-subtle tw:px-3 tw:py-2 tw:text-sm"
            >
              <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
                <span class="tw:text-muted-foreground">{{ index + 1 }}.</span>
                <Badge
                  :variant="entry.kind === 'pinned' ? 'warning' : 'success'"
                  >{{ entryKindLabel(entry) }}</Badge
                >
                <span
                  v-if="!entry.available"
                  class="tw:text-xs tw:text-muted-foreground"
                  >unavailable</span
                >
                <span class="tw:ml-auto tw:flex tw:gap-2">
                  <Button
                    v-if="entry.site?.label"
                    variant="ghost"
                    size="sm"
                    @click="openSite(`https://${entry.site!.label}`)"
                    >Open</Button
                  >
                </span>
              </div>
              <p
                class="tw:m-0 tw:truncate tw:font-mono tw:text-xs tw:text-muted-foreground"
              >
                {{ entry.kind === 'pinned' ? entry.ref : entry.ref }}
              </p>
            </li>
          </ol>
        </CardContent>
      </Card>
    </template>

    <!-- authoring wizard -->
    <Card v-if="wizardOpen">
      <CardHeader>
        <CardTitle>
          {{ wCopyOf ? 'Save a copy of a collection' : 'New collection' }}
          <span class="tw:text-sm tw:font-normal tw:text-muted-foreground"
            >· step {{ wStep + 1 }} of 5</span
          >
        </CardTitle>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-3">
        <!-- step 1: identity + metadata -->
        <template v-if="wStep === 0">
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-d">Identifier (d)</Label>
            <Input
              id="col-d"
              v-model="wD"
              placeholder="indie-web"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-title">Title</Label>
            <Input id="col-title" v-model="wTitle" spellcheck="false" />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-description">Description (optional)</Label>
            <Textarea
              id="col-description"
              v-model="wDescription"
              class="tw:min-h-20"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-image">Cover image URL (optional, https)</Label>
            <Input
              id="col-image"
              v-model="wImage"
              spellcheck="false"
              autocomplete="off"
            />
          </div>
          <template v-if="!signerAvailable">
            <Alert variant="warning">
              No NIP-07 signer detected. Publishing needs a browser signer
              (window.nostr) until NIP-46 support lands.
            </Alert>
          </template>
          <div class="tw:flex tw:justify-end tw:gap-2">
            <Button variant="outline" size="sm" @click="wizardOpen = false"
              >Cancel</Button
            >
            <Button size="sm" @click="wStep = 1">Next</Button>
          </div>
        </template>

        <!-- step 2: entries -->
        <template v-else-if="wStep === 1">
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-live">Live site coordinate</Label>
            <div class="tw:flex tw:gap-2">
              <Input
                id="col-live"
                v-model="wLiveRef"
                placeholder="15128:&lt;pubkey&gt;: or 35128:&lt;pubkey&gt;:&lt;d&gt;"
                spellcheck="false"
                autocomplete="off"
              />
              <Button variant="outline" size="sm" @click="addLiveEntry"
                >Add live</Button
              >
            </div>
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-pinned">Pinned snapshot (kind-5128 event id)</Label>
            <div class="tw:flex tw:gap-2">
              <Input
                id="col-pinned"
                v-model="wPinnedRef"
                placeholder="64-hex event id"
                spellcheck="false"
                autocomplete="off"
              />
              <Button variant="outline" size="sm" @click="addPinnedEntry"
                >Pin</Button
              >
            </div>
          </div>
          <div v-if="wEntries.length" class="tw:grid tw:gap-1">
            <p class="tw:m-0 tw:text-sm">
              Ordered entries (drag order via arrows):
            </p>
            <ol class="tw:m-0 tw:grid tw:gap-1 tw:p-0 tw:list-none">
              <li
                v-for="(entry, index) in wEntries"
                :key="entry.ref"
                class="tw:flex tw:items-center tw:gap-2 tw:rounded tw:border tw:border-border-subtle tw:px-2 tw:py-1 tw:text-xs tw:font-mono"
              >
                <span class="tw:text-muted-foreground">{{ index + 1 }}</span>
                <Badge
                  :variant="entry.kind === 'pinned' ? 'warning' : 'success'"
                  >{{ entry.kind }}</Badge
                >
                <span class="tw:truncate">{{ entry.ref }}</span>
                <span class="tw:ml-auto tw:flex tw:gap-1">
                  <button
                    type="button"
                    :disabled="index === 0"
                    @click="moveEntry(index, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    :disabled="index === wEntries.length - 1"
                    @click="moveEntry(index, 1)"
                  >
                    ↓
                  </button>
                  <button type="button" @click="removeEntry(index)">×</button>
                </span>
              </li>
            </ol>
          </div>
          <div class="tw:flex tw:justify-end tw:gap-2">
            <Button variant="outline" size="sm" @click="wStep = 0">Back</Button>
            <Button size="sm" :disabled="!wEntries.length" @click="wStep = 2"
              >Next</Button
            >
          </div>
        </template>

        <!-- step 3: relays -->
        <template v-else-if="wStep === 2">
          <div class="tw:grid tw:gap-1.5">
            <Label for="col-relays">Publish relays (comma-separated, ≤6)</Label>
            <Input
              id="col-relays"
              v-model="wRelays"
              spellcheck="false"
              autocomplete="off"
            />
            <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
              Prefilled from the host's nsite relay defaults. The same signed
              event is broadcast to each relay; at least one must accept.
            </p>
          </div>
          <div class="tw:flex tw:justify-end tw:gap-2">
            <Button variant="outline" size="sm" @click="wStep = 1">Back</Button>
            <Button
              size="sm"
              :disabled="wizardBusy === 'review'"
              @click="doReview"
              >{{
                wizardBusy === 'review' ? 'Planning…' : 'Review & sign'
              }}</Button
            >
          </div>
        </template>

        <!-- step 4: review -->
        <template v-else-if="wStep === 3">
          <p class="tw:m-0 tw:text-sm">
            Kind <code class="tw:font-mono">30004</code> · d
            <code class="tw:font-mono">{{ wD }}</code>
          </p>
          <div class="tw:grid tw:gap-1">
            <p class="tw:m-0 tw:text-sm">Tags to be signed:</p>
            <pre
              class="tw:m-0 tw:max-h-48 tw:overflow-auto tw:rounded tw:bg-muted tw:p-2 tw:text-xs tw:font-mono"
              >{{ JSON.stringify(reviewEvent, null, 2) }}</pre
            >
          </div>
          <p class="tw:m-0 tw:text-sm">
            Plan digest <code class="tw:font-mono">{{ reviewDigest }}</code>
          </p>
          <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
            Editing anything above (d, title, entries, relays) discards this
            digest — go back and re-review.
          </p>
          <div class="tw:flex tw:justify-end tw:gap-2">
            <Button variant="outline" size="sm" @click="wStep = 2">Back</Button>
            <Button
              size="sm"
              :disabled="wizardBusy !== ''"
              @click="doPublish"
              >{{
                wizardBusy === 'publish' ? 'Publishing…' : 'Sign &amp; publish'
              }}</Button
            >
          </div>
        </template>

        <!-- step 5: result -->
        <template v-else-if="wStep === 4">
          <div class="tw:grid tw:gap-1 tw:text-sm">
            <p class="tw:m-0">
              Published
              <code class="tw:font-mono">{{ publishEventId }}</code>
            </p>
            <p
              v-if="activeCollection"
              class="tw:m-0 tw:text-xs tw:text-muted-foreground"
            >
              Collection pages are read back from external relays; the signed
              event is the authority.
            </p>
          </div>
          <div class="tw:flex tw:justify-end">
            <Button
              size="sm"
              @click="backToBrowse()"
              >Done</Button
            >
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
