<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { decode as decodeNip19 } from 'nostr-tools/nip19'

import {
  announceCatalogueEntry,
  attestCatalogueEntry,
  getCatalogueAnnouncements,
  getCatalogueCandidates,
  getCatalogueHistory,
  getCatalogueList,
  getCatalogueProfile,
  getCatalogueTrust,
  getTrustedPublishers,
  publishTrustedPublishers,
  setCatalogueProfile,
  type AttestationPolicyMode,
  type CatalogueAnnouncement,
  type CatalogueCandidate,
  type CatalogueClaim,
  type CatalogueEntry,
  type CatalogueHistoryRecord,
  type CatalogueProfile,
  type CatalogueTrustEntry,
} from '@/api/nativeCatalog'
import {
  discoverNsites,
  nsiteBlockAdd,
  nsiteBlockList,
  nsiteBlockRemove,
  registerNsite,
  type NsiteDiscoveredSite,
} from '@/api/nativeNsites'
import CollectionsSection from '@/views/native/nsites/CollectionsSection.vue'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { useActionRunner } from '@/composables/useActionRunner'
import { truncatePubkey } from '@/lib/utils'
import EmptyState from '@/components/native/EmptyState.vue'
import AppLogo from '@/components/native/AppLogo.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()
const { success } = useNotifications()

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'attest', label: 'Attest' },
  { id: 'trust', label: 'Trust' },
  { id: 'publishers', label: 'Trusted Publishers' },
  { id: 'profile', label: 'Profile' },
  { id: 'announce', label: 'Announcements' },
] as const
type TabId = (typeof TABS)[number]['id']
const activeTab = ref<TabId>('browse')

const selfPublisher = ref('')

const loading = ref(false)
const { run: runLoading } = useActionRunner(loading, false)

// -- browse ------------------------------------------------------------

const entries = ref<CatalogueEntry[] | null>(null)
const search = ref('')
const category = ref('all')
const browseKind = ref<'all' | 'apps' | 'nsites' | 'collections'>('all')
const KIND_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'apps', label: 'Apps' },
  { id: 'nsites', label: 'Nsites' },
  { id: 'collections', label: 'Collections' },
] as const
const discoveredSites = ref<NsiteDiscoveredSite[] | null>(null)
const sitesLoading = ref(false)
const sitesLoaded = ref(false)
const discoverError = ref('')
const registeringSite = ref('')
const { run: runRegisterSite } = useActionRunner(registeringSite, '')
const forceDiscover = ref(false)

// -- blocked npubs (operator kind-10000 mute list) ------------------------

const blockedPubkeys = ref<string[] | null>(null)
const busyBlockKey = ref('')
const { run: runBusyBlockKey } = useActionRunner(busyBlockKey, '')

const categories = computed(() => {
  const found = new Set<string>()
  for (const entry of entries.value || []) {
    if (entry.declaration.Category) found.add(entry.declaration.Category)
  }
  return Array.from(found).sort()
})

type BrowseCard =
  | { type: 'app'; entry: CatalogueEntry }
  | { type: 'nsite'; site: NsiteDiscoveredSite }

const visibleCards = computed<BrowseCard[]>(() => {
  if (browseKind.value === 'collections') return []
  const needle = search.value.trim().toLocaleLowerCase()
  const cards: BrowseCard[] = []
  if (browseKind.value !== 'nsites') {
    for (const entry of entries.value || []) {
      const matchesCategory =
        category.value === 'all' ||
        entry.declaration.Category === category.value
      const matchesSearch =
        !needle ||
        `${entry.declaration.Name} ${entry.declaration.AppID} ${entry.declaration.Description}`
          .toLocaleLowerCase()
          .includes(needle)
      if (matchesCategory && matchesSearch) {
        cards.push({ type: 'app', entry })
      }
    }
  }
  if (browseKind.value !== 'apps') {
    for (const site of discoveredSites.value || []) {
      const matchesSearch =
        !needle ||
        `${site.label} ${site.pubkey} ${site.title} ${site.d}`
          .toLocaleLowerCase()
          .includes(needle)
      if (matchesSearch) cards.push({ type: 'nsite', site })
    }
  }
  return cards
})

const summaryText = computed(() => {
  if (browseKind.value === 'collections') {
    return 'user-authored curated kind-30004 lists from external relays'
  }
  if (browseKind.value === 'nsites') {
    return `${visibleCards.value.length} of ${discoveredSites.value?.length ?? 0} discovered site(s)`
  }
  if (browseKind.value === 'apps') {
    return `${visibleCards.value.length} of ${entries.value?.length ?? 0} trusted app(s)`
  }
  return `${entries.value?.length ?? 0} app(s) · ${discoveredSites.value?.length ?? 0} site(s)`
})

const hasBrowseContent = computed(
  () =>
    (entries.value?.length ?? 0) > 0 ||
    (discoveredSites.value?.length ?? 0) > 0,
)

function shortHash(hash: string) {
  return hash ? truncatePubkey(hash, 8, 6) : ''
}

async function loadBrowse() {
  const [list, profile] = await Promise.all([
    getCatalogueList(),
    getCatalogueProfile(),
  ])
  entries.value = list.entries
  selfPublisher.value = profile.self_publisher
  // Non-blocking: the relay scan runs in the background so the Browse tab
  // renders the catalogue immediately, even if a relay is slow/unreachable.
  // A manual Refresh forces a live scan (?refresh=1); otherwise the server's
  // 5-minute cache makes revisits instant.
  const force = forceDiscover.value
  forceDiscover.value = false
  void loadDiscover(force)
}

async function loadDiscover(force = false) {
  if (sitesLoaded.value && !force) return
  if (sitesLoading.value) return
  sitesLoading.value = true
  discoverError.value = ''
  try {
    const result = await discoverNsites(force)
    discoveredSites.value = result.sites
    sitesLoaded.value = true
  } catch (err) {
    // A slow/unreachable relay must not fail the whole Browse tab: keep any
    // previously discovered sites, surface an inline dismissible warning and
    // let Refresh retry (sitesLoaded stays false).
    discoverError.value =
      err instanceof Error ? err.message : 'Site discovery failed.'
  } finally {
    sitesLoading.value = false
  }
}

async function loadBlocked() {
  const result = await nsiteBlockList()
  blockedPubkeys.value = result.pubkeys
}

async function refreshBlocked() {
  blockedPubkeys.value = (await nsiteBlockList()).pubkeys
}

async function blockDiscoveredSite(site: NsiteDiscoveredSite) {
  await runBusyBlockKey(
    site.pubkey,
    async () => {
      await nsiteBlockAdd(site.pubkey)
      success('Blocked.')
      await refreshBlocked()
      // The discover cache stores the full site list and is re-filtered
      // against the blocklist on every read, so the npub's sites disappear
      // from the next (cache-hit) reload instantly - no forced rescan.
      sitesLoaded.value = false
      void loadDiscover()
    },
    'Block failed.',
  )
}

async function unblockPubkey(pubkey: string) {
  await runBusyBlockKey(
    pubkey,
    async () => {
      await nsiteBlockRemove(pubkey)
      success('Unblocked.')
      await refreshBlocked()
      sitesLoaded.value = false
      void loadDiscover()
    },
    'Unblock failed.',
  )
}

function siteKindName(kind: number): string {
  return kind === 35128 ? 'named' : kind === 15128 ? 'root' : String(kind)
}

function formatSiteDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

async function registerDiscoveredSite(site: NsiteDiscoveredSite) {
  await runRegisterSite(
    site.label,
    async () => {
      await registerNsite({
        pubkey: site.pubkey,
        kind: site.kind,
        d: site.d,
        title: site.title || undefined,
      })
      success('Registration submitted for review.')
      await loadDiscover(true)
    },
    'Registration failed.',
  )
}

// -- attest --------------------------------------------------------------

const candidates = ref<CatalogueCandidate[] | null>(null)
const history = ref<CatalogueHistoryRecord[] | null>(null)
const attestTarget = ref<CatalogueCandidate | null>(null)
const attestClaim = ref<CatalogueClaim>('recommend')
const attestComment = ref('')
const attestBusy = ref(false)
const { run: runAttest } = useActionRunner(attestBusy, false)

async function loadAttest() {
  const [candidateResult, historyResult] = await Promise.all([
    getCatalogueCandidates(),
    getCatalogueHistory(),
  ])
  candidates.value = candidateResult.candidates
  history.value = historyResult.history
}

function pickCandidate(candidate: CatalogueCandidate) {
  attestTarget.value = candidate
  attestClaim.value = 'recommend'
  attestComment.value = ''
}

async function submitAttest() {
  const target = attestTarget.value
  if (!target) return
  await runAttest(
    true,
    async () => {
      await attestCatalogueEntry({
        appId: target.app_id,
        publisher: target.publisher,
        claim: attestClaim.value,
        comment: attestComment.value,
      })
      success(`Endorsement published for ${target.app_id}.`)
      attestTarget.value = null
      await loadAttest()
    },
    'Endorsement failed.',
  )
}

// -- trust -----------------------------------------------------------------

const trustEntries = ref<CatalogueTrustEntry[] | null>(null)
const trustPolicy = ref<AttestationPolicyMode>('off')
const trustMinAttestations = ref('1')
const trustBusy = ref(false)
const { run: runTrust } = useActionRunner(trustBusy, false)

async function loadTrust() {
  await runTrust(
    true,
    async () => {
      const result = await getCatalogueTrust({
        mode: trustPolicy.value,
        minAttestations: Number(trustMinAttestations.value) || undefined,
      })
      trustEntries.value = result.entries
    },
    'Failed to load trust dashboard.',
  )
}

// -- trusted publishers ------------------------------------------------------
// WP4 operator people-set that gates which npack publishers this node will
// install .npk releases from (nostrhost.native_ops.trusted_publisher_list).
// An empty list means "trust this node's own publisher key only" - adding
// entries here is how you allow another publisher's .npk releases.

const HEX_PUBKEY = /^[0-9a-f]{64}$/i

// Accepts either a raw hex pubkey or an npub; always stores/compares hex.
function resolvePubkeyInput(value: string): string {
  const trimmed = value.trim()
  if (trimmed.toLowerCase().startsWith('npub1')) {
    let decoded
    try {
      decoded = decodeNip19(trimmed)
    } catch {
      throw new Error('Invalid npub.')
    }
    if (decoded.type !== 'npub') {
      throw new Error('Invalid npub.')
    }
    return decoded.data
  }
  const hex = trimmed.toLowerCase()
  if (!HEX_PUBKEY.test(hex)) {
    throw new Error('Enter a 64-character hex pubkey or an npub.')
  }
  return hex
}

const trustedPublishers = ref<string[] | null>(null)
const newPublisherPubkey = ref('')
const publishersBusy = ref(false)
const { run: runPublishers } = useActionRunner(publishersBusy, false)
const removeBusyPubkey = ref('')
const { run: runRemovePublisher } = useActionRunner(removeBusyPubkey, '')

async function loadTrustedPublishers() {
  const result = await getTrustedPublishers()
  trustedPublishers.value = result.entries
}

async function addTrustedPublisher() {
  await runPublishers(
    true,
    async () => {
      const pubkey = resolvePubkeyInput(newPublisherPubkey.value)
      const current = trustedPublishers.value || []
      if (current.includes(pubkey)) {
        newPublisherPubkey.value = ''
        return
      }
      await publishTrustedPublishers([...current, pubkey])
      newPublisherPubkey.value = ''
      success('Trusted publisher added.')
      await loadTrustedPublishers()
    },
    'Failed to add trusted publisher.',
  )
}

async function removeTrustedPublisher(pubkey: string) {
  const current = trustedPublishers.value || []
  await runRemovePublisher(
    pubkey,
    async () => {
      await publishTrustedPublishers(current.filter((p) => p !== pubkey))
      success('Trusted publisher removed.')
      await loadTrustedPublishers()
    },
    'Failed to remove trusted publisher.',
  )
}

// -- profile -----------------------------------------------------------------

const profileForm = ref<CatalogueProfile>({})
const profileBusy = ref(false)
const { run: runProfile } = useActionRunner(profileBusy, false)

async function loadProfile() {
  const result = await getCatalogueProfile()
  profileForm.value = { ...result.profile }
  selfPublisher.value = result.self_publisher
}

async function submitProfile() {
  await runProfile(
    true,
    async () => {
      await setCatalogueProfile(profileForm.value)
      success('Profile published.')
    },
    'Publishing the profile failed.',
  )
}

// -- announcements -----------------------------------------------------------

const announcements = ref<CatalogueAnnouncement[] | null>(null)
const ownEntries = computed(() =>
  (entries.value || []).filter(
    (entry) => entry.declaration.Publisher === selfPublisher.value,
  ),
)
const announceBusyAppId = ref('')
const { run: runAnnounceBusyAppId } = useActionRunner(announceBusyAppId, '')

async function loadAnnounce() {
  const [announcementResult] = await Promise.all([
    getCatalogueAnnouncements(),
    entries.value ? Promise.resolve() : loadBrowse(),
  ])
  announcements.value = announcementResult.announcements
}

function alreadyAnnounced(appId: string, commit: string) {
  return (announcements.value || []).some(
    (item) => item.app_id === appId && item.commit === commit,
  )
}

async function announceEntry(appId: string) {
  await runAnnounceBusyAppId(
    appId,
    async () => {
      await announceCatalogueEntry(appId)
      success(`Announced ${appId}.`)
      await loadAnnounce()
    },
    'Announcement failed.',
  )
}

// -- tab loading ---------------------------------------------------------

const tabLoaders: Record<TabId, () => Promise<void>> = {
  browse: loadBrowse,
  blocked: loadBlocked,
  attest: loadAttest,
  trust: loadTrust,
  publishers: loadTrustedPublishers,
  profile: loadProfile,
  announce: loadAnnounce,
}
const loadedTabs = new Set<TabId>()

async function loadTab(tab: TabId) {
  await runLoading(
    true,
    async () => {
      await tabLoaders[tab]()
      loadedTabs.add(tab)
    },
    'Failed to load this tab.',
  )
}

function selectTab(tab: TabId) {
  activeTab.value = tab
  if (!loadedTabs.has(tab)) loadTab(tab)
}

async function refreshCurrentTab() {
  if (activeTab.value === 'browse') {
    sitesLoaded.value = false
    forceDiscover.value = true
  }
  loadedTabs.delete(activeTab.value)
  await loadTab(activeTab.value)
}

async function bootstrap() {
  await runLoading(
    true,
    async () => {
      await sync()
      await loadTab('browse')
    },
    'Failed to load the catalogue.',
  )
}

onMounted(() => {
  if (publicKey.value) bootstrap()
})
watch(publicKey, (key) => {
  if (key) bootstrap()
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Apps & sites"
      title="Catalogue"
      description="Browse signed app declarations this node trusts and static sites (nsites) discovered on the configured relays. Endorse, publish, verify and manage trust from the other tabs."
    />

    <div
      v-if="publicKey"
      class="tw:flex tw:flex-wrap tw:gap-1 tw:border-b tw:border-border-subtle"
      role="tablist"
    >
      <button
        v-for="tab in TABS"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.id"
        class="tw:rounded-t-md tw:px-3 tw:py-2 tw:text-sm tw:font-medium tw:text-muted-foreground tw:hover:text-foreground"
        :class="
          activeTab === tab.id
            ? 'tw:border-b-2 tw:border-brand-500 tw:text-foreground'
            : ''
        "
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
      <Button
        variant="outline"
        size="sm"
        class="tw:ml-auto tw:self-center"
        :disabled="loading"
        @click="refreshCurrentTab"
        >{{ loading ? 'Refreshing…' : 'Refresh' }}</Button
      >
    </div>

    <!-- Browse -->
    <template v-if="publicKey && activeTab === 'browse'">
      <div
        class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"
      >
        <p class="tw:text-sm tw:text-muted-foreground">
          {{ summaryText }}
          <span v-if="sitesLoading" class="tw:ml-1">· scanning relays…</span>
        </p>
        <div
          class="tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:border tw:border-border-subtle tw:p-0.5"
          role="group"
          aria-label="Catalogue content filter"
        >
          <button
            v-for="option in KIND_FILTERS"
            :key="option.id"
            type="button"
            :aria-pressed="browseKind === option.id"
            class="tw:rounded tw:px-2.5 tw:py-1 tw:text-sm tw:font-medium"
            :class="
              browseKind === option.id
                ? 'tw:bg-brand-500 tw:text-white'
                : 'tw:text-muted-foreground tw:hover:text-foreground'
            "
            @click="browseKind = option.id"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <Alert
        v-if="discoverError"
        variant="warning"
        role="status"
        class="tw:mt-3"
      >
        <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Site discovery failed: {{ discoverError }}</span>
          <button
            type="button"
            class="tw:shrink-0 tw:text-muted-foreground tw:hover:text-foreground"
            aria-label="Dismiss discovery warning"
            @click="discoverError = ''"
          >
            ×
          </button>
        </div>
      </Alert>

      <div
        v-if="hasBrowseContent && browseKind !== 'collections'"
        class="tw:flex tw:flex-wrap tw:gap-2"
      >
        <label class="tw:sr-only" for="catalogue-search"
          >Search catalogue</label
        >
        <input
          id="catalogue-search"
          v-model="search"
          class="tw:min-w-48 tw:flex-1 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
          placeholder="Search apps and sites"
        />
        <label
          v-if="browseKind !== 'nsites'"
          class="tw:sr-only"
          for="catalogue-category"
          >Filter by category</label
        >
        <select
          v-if="browseKind !== 'nsites'"
          id="catalogue-category"
          v-model="category"
          class="tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
        >
          <option value="all">All categories</option>
          <option v-for="item in categories" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
      </div>

      <EmptyState
        v-if="browseKind === 'apps' && entries && entries.length === 0"
        title="No trusted apps in the catalogue yet"
      />
      <EmptyState
        v-else-if="
          browseKind === 'nsites' &&
          discoveredSites &&
          discoveredSites.length === 0
        "
        title="No sites discovered on the relays yet"
        description="nsite.discover scans the configured catalogue + lookup relays for kind-15128/35128 manifests."
      />
      <EmptyState
        v-else-if="visibleCards.length === 0 && hasBrowseContent"
        title="Nothing matches this search or category"
      />

      <CollectionsSection v-if="browseKind === 'collections'" />

      <div
        v-if="visibleCards.length"
        class="tw:grid tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-3"
      >
        <template
          v-for="card in visibleCards"
          :key="card.type === 'app' ? card.entry.event_id : card.site.label"
        >
          <Card v-if="card.type === 'nsite'">
            <CardHeader>
              <CardTitle
                class="tw:flex tw:items-center tw:justify-between tw:gap-2"
              >
                <span class="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
                  <span class="tw:truncate">{{
                    card.site.title || card.site.label
                  }}</span>
                </span>
                <Badge variant="neutral">{{
                  siteKindName(card.site.kind)
                }}</Badge>
                <Badge v-if="card.site.blobs_ok === null" variant="warning"
                  >blobs unverified</Badge
                >
              </CardTitle>
              <p class="tw:font-mono tw:text-xs tw:text-muted-foreground">
                {{ card.site.label }}
                <Badge
                  v-if="card.site.registered"
                  variant="success"
                  class="tw:ml-1"
                  >registered</Badge
                >
              </p>
            </CardHeader>
            <CardContent>
              <dl class="tw:grid tw:gap-1.5 tw:text-xs">
                <div class="tw:grid tw:gap-0.5">
                  <dt class="tw:text-muted-foreground">Pubkey</dt>
                  <dd class="tw:truncate tw:font-mono tw:text-foreground">
                    {{ truncatePubkey(card.site.pubkey) }}
                  </dd>
                </div>
                <div
                  v-if="card.site.d"
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Name</dt>
                  <dd class="tw:font-mono tw:text-foreground">
                    {{ card.site.d }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Paths</dt>
                  <dd class="tw:font-mono tw:text-foreground">
                    {{ card.site.paths_count }}
                  </dd>
                </div>
                <div v-if="card.site.servers.length" class="tw:grid tw:gap-0.5">
                  <dt class="tw:text-muted-foreground">Blossom</dt>
                  <dd class="tw:truncate tw:font-mono tw:text-foreground">
                    {{ card.site.servers.join(', ') }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Updated</dt>
                  <dd class="tw:text-foreground">
                    {{ formatSiteDate(card.site.created_at) }}
                  </dd>
                </div>
              </dl>
              <div class="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
                <Button
                  v-if="!card.site.registered"
                  variant="outline"
                  size="sm"
                  :disabled="registeringSite === card.site.label"
                  @click="registerDiscoveredSite(card.site)"
                  >{{
                    registeringSite === card.site.label
                      ? 'Submitting…'
                      : 'Register'
                  }}</Button
                >
                <Button
                  variant="ghost"
                  size="sm"
                  class="tw:text-destructive-foreground"
                  :disabled="busyBlockKey === card.site.pubkey"
                  @click="blockDiscoveredSite(card.site)"
                  >{{
                    busyBlockKey === card.site.pubkey
                      ? 'Blocking…'
                      : 'Block npub'
                  }}</Button
                >
              </div>
            </CardContent>
          </Card>
          <Card v-else>
            <CardHeader>
              <CardTitle
                class="tw:flex tw:items-center tw:justify-between tw:gap-2"
              >
                <span class="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
                  <AppLogo
                    :name="
                      card.entry.declaration.Name ||
                      card.entry.declaration.AppID
                    "
                    :logo="card.entry.logo"
                    size="sm"
                  />
                  <span class="tw:truncate">{{
                    card.entry.declaration.Name || card.entry.declaration.AppID
                  }}</span>
                </span>
                <Badge variant="brand"
                  >v{{ card.entry.declaration.Version }}</Badge
                >
              </CardTitle>
              <p class="tw:font-mono tw:text-xs tw:text-muted-foreground">
                {{ card.entry.declaration.AppID }}
                <span v-if="card.entry.declaration.Category"
                  >· {{ card.entry.declaration.Category }}</span
                >
                <Badge
                  v-if="card.entry.declaration.Publisher === selfPublisher"
                  variant="neutral"
                  class="tw:ml-1"
                  >mine</Badge
                >
              </p>
            </CardHeader>
            <CardContent>
              <p
                v-if="card.entry.declaration.Description"
                class="tw:mb-3 tw:line-clamp-2 tw:text-xs tw:text-muted-foreground"
              >
                {{ card.entry.declaration.Description }}
              </p>
              <dl class="tw:grid tw:gap-1.5 tw:text-xs">
                <div class="tw:grid tw:gap-0.5">
                  <dt class="tw:text-muted-foreground">Repository</dt>
                  <dd class="tw:truncate tw:font-mono tw:text-foreground">
                    {{ card.entry.declaration.Repository }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Commit</dt>
                  <dd class="tw:font-mono tw:text-foreground">
                    {{ shortHash(card.entry.declaration.Commit) }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Manifest hash</dt>
                  <dd class="tw:font-mono tw:text-foreground">
                    {{ shortHash(card.entry.declaration.ManifestHash) }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Content hash</dt>
                  <dd class="tw:font-mono tw:text-foreground">
                    {{ shortHash(card.entry.declaration.ContentHash) }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Architectures</dt>
                  <dd class="tw:truncate tw:text-foreground">
                    {{
                      (card.entry.declaration.Architectures || []).join(', ')
                    }}
                  </dd>
                </div>
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <dt class="tw:text-muted-foreground">Provenance event</dt>
                  <dd class="tw:font-mono tw:text-foreground">
                    {{ shortHash(card.entry.event_id) }}
                  </dd>
                </div>
              </dl>
              <div class="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
                <RouterLink
                  :to="{
                    name: 'app-management',
                    query: { id: card.entry.declaration.AppID },
                  }"
                  class="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-md tw:bg-brand-500 tw:px-3 tw:py-1.5 tw:text-sm tw:font-medium tw:text-white tw:no-underline hover:tw:bg-brand-600"
                  >Install</RouterLink
                >
                <a
                  v-if="card.entry.nsite"
                  :href="card.entry.nsite.url"
                  target="_blank"
                  rel="noreferrer"
                  class="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-md tw:bg-brand-500 tw:px-3 tw:py-1.5 tw:text-sm tw:font-medium tw:text-white tw:no-underline hover:tw:bg-brand-600"
                  >Open nsite
                  <span class="tw:font-mono tw:text-xs"
                    >{{ card.entry.nsite.label }} ↗</span
                  ></a
                >
              </div>
            </CardContent>
          </Card>
        </template>
      </div>
    </template>

    <!-- Blocked -->
    <template v-if="publicKey && activeTab === 'blocked'">
      <Card>
        <CardHeader>
          <CardTitle>Blocked npubs</CardTitle>
          <p class="tw:text-sm tw:text-muted-foreground">
            The operator's NIP-51 mute list on the control relay. Blocked npubs'
            sites are excluded from the Browse results. Changes flow through the
            approval chain like other admin operations.
          </p>
        </CardHeader>
        <CardContent>
          <p
            v-if="blockedPubkeys === null"
            class="tw:text-sm tw:text-muted-foreground"
          >
            Loading…
          </p>
          <p
            v-else-if="blockedPubkeys.length === 0"
            class="tw:text-sm tw:text-muted-foreground"
          >
            Nothing blocked — every discovered site is shown.
          </p>
          <ul v-else class="tw:grid tw:gap-2">
            <li
              v-for="pubkey in blockedPubkeys"
              :key="pubkey"
              class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-md tw:border tw:border-border-subtle tw:px-3 tw:py-2"
            >
              <span class="tw:truncate tw:font-mono tw:text-sm">{{
                truncatePubkey(pubkey)
              }}</span>
              <Button
                variant="outline"
                size="sm"
                :disabled="busyBlockKey === pubkey"
                @click="unblockPubkey(pubkey)"
                >{{
                  busyBlockKey === pubkey ? 'Unblocking…' : 'Unblock'
                }}</Button
              >
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <!-- Attest -->
    <template v-if="publicKey && activeTab === 'attest'">
      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            v-if="candidates && candidates.length === 0"
            title="No apps waiting for an endorsement"
            description="Installed apps from other publishers appear here once they need review."
          />
          <ul v-else class="tw:grid tw:gap-2">
            <li
              v-for="candidate in candidates || []"
              :key="`${candidate.publisher}:${candidate.app_id}`"
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:border-border-subtle tw:p-2 tw:text-sm"
            >
              <span
                >{{ candidate.name }}
                <span class="tw:font-mono tw:text-xs tw:text-muted-foreground"
                  >({{ candidate.app_id }})</span
                ></span
              >
              <Button
                size="sm"
                variant="outline"
                @click="pickCandidate(candidate)"
                >Endorse</Button
              >
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card v-if="attestTarget">
        <CardHeader>
          <CardTitle>Endorse {{ attestTarget.name }}</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <div class="tw:grid tw:gap-1.5">
            <Label for="attest-claim">Claim</Label>
            <Select id="attest-claim" v-model="attestClaim">
              <option value="recommend">Recommend</option>
              <option value="tested">Tested</option>
            </Select>
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="attest-comment">Comment (optional)</Label>
            <Textarea
              id="attest-comment"
              v-model="attestComment"
              class="tw:min-h-20"
            />
          </div>
          <div class="tw:flex tw:gap-2">
            <Button :disabled="attestBusy" @click="submitAttest">{{
              attestBusy ? 'Publishing…' : 'Publish endorsement'
            }}</Button>
            <Button
              variant="outline"
              :disabled="attestBusy"
              @click="attestTarget = null"
              >Cancel</Button
            >
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            v-if="history && history.length === 0"
            title="No endorsements published yet"
          />
          <div v-else class="tw:overflow-x-auto">
            <table class="tw:w-full tw:text-sm">
              <thead>
                <tr class="tw:text-left tw:text-xs tw:text-muted-foreground">
                  <th class="tw:pb-2">App</th>
                  <th class="tw:pb-2">Claim</th>
                  <th class="tw:pb-2">Comment</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="record in history || []"
                  :key="record.event_id"
                  class="tw:border-t tw:border-border-subtle"
                >
                  <td class="tw:py-1.5 tw:font-mono tw:text-xs">
                    {{ record.app_id }}
                  </td>
                  <td class="tw:py-1.5">
                    <Badge variant="neutral">{{ record.claim }}</Badge>
                  </td>
                  <td class="tw:py-1.5 tw:text-muted-foreground">
                    {{ record.comment }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- Trust -->
    <template v-if="publicKey && activeTab === 'trust'">
      <Card>
        <CardHeader>
          <CardTitle>Attestation policy</CardTitle>
        </CardHeader>
        <CardContent class="tw:flex tw:flex-wrap tw:items-end tw:gap-3">
          <div class="tw:grid tw:gap-1.5">
            <Label for="trust-mode">Mode</Label>
            <Select id="trust-mode" v-model="trustPolicy">
              <option value="off">Off (informational only)</option>
              <option value="prefer">Prefer (mark verified)</option>
              <option value="require">Require (hide unverified)</option>
            </Select>
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="trust-min">Minimum attestations</Label>
            <Input
              id="trust-min"
              v-model="trustMinAttestations"
              class="tw:w-24"
            />
          </div>
          <Button :disabled="trustBusy" @click="loadTrust">{{
            trustBusy ? 'Loading…' : 'Apply'
          }}</Button>
        </CardContent>
      </Card>

      <EmptyState
        v-if="trustEntries && trustEntries.length === 0"
        title="No declarations in the catalogue yet"
      />
      <div v-else class="tw:overflow-x-auto">
        <table class="tw:w-full tw:text-sm">
          <thead>
            <tr class="tw:text-left tw:text-xs tw:text-muted-foreground">
              <th class="tw:pb-2">App</th>
              <th class="tw:pb-2">Attestations</th>
              <th class="tw:pb-2">Verified</th>
              <th class="tw:pb-2">Accepted</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in trustEntries || []"
              :key="item.declaration.AppID + item.declaration.Publisher"
              class="tw:border-t tw:border-border-subtle"
            >
              <td class="tw:py-1.5 tw:font-mono tw:text-xs">
                {{ item.declaration.AppID }}
              </td>
              <td class="tw:py-1.5">{{ item.attestations.length }}</td>
              <td class="tw:py-1.5">
                <Badge :variant="item.verified ? 'success' : 'neutral'">{{
                  item.verified ? 'Verified' : 'Unverified'
                }}</Badge>
              </td>
              <td class="tw:py-1.5">
                <Badge :variant="item.accepted ? 'success' : 'danger'">{{
                  item.accepted ? 'Accepted' : 'Filtered'
                }}</Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Trusted Publishers -->
    <template v-if="publicKey && activeTab === 'publishers'">
      <Card>
        <CardHeader>
          <CardTitle>Trusted publishers</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p class="tw:text-sm tw:text-muted-foreground">
            Publishers whose signed .npk releases this node will resolve and
            install. Your own publisher key is always trusted; add others'
            pubkeys here to allow their releases too.
          </p>
          <div class="tw:flex tw:flex-wrap tw:items-end tw:gap-3">
            <div class="tw:grid tw:flex-1 tw:min-w-64 tw:gap-1.5">
              <Label for="publisher-pubkey">Publisher pubkey (npub or hex)</Label>
              <Input
                id="publisher-pubkey"
                v-model="newPublisherPubkey"
                placeholder="npub1… or 64-character hex pubkey"
                class="tw:font-mono"
                @keyup.enter="addTrustedPublisher"
              />
            </div>
            <Button :disabled="publishersBusy" @click="addTrustedPublisher">{{
              publishersBusy ? 'Adding…' : 'Add publisher'
            }}</Button>
          </div>
        </CardContent>
      </Card>

      <EmptyState
        v-if="trustedPublishers && trustedPublishers.length === 0"
        title="No additional trusted publishers"
        description="This node currently trusts only its own publisher key."
      />
      <Card v-else>
        <CardContent class="tw:p-0">
          <ul>
            <li
              v-for="pubkey in trustedPublishers || []"
              :key="pubkey"
              class="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-b tw:border-border-subtle tw:p-3 tw:text-sm last:tw:border-b-0"
            >
              <span class="tw:flex tw:items-center tw:gap-2">
                <span class="tw:font-mono tw:text-xs">{{
                  truncatePubkey(pubkey)
                }}</span>
                <Badge v-if="pubkey === selfPublisher" variant="success"
                  >You</Badge
                >
              </span>
              <Button
                size="sm"
                variant="outline"
                :disabled="removeBusyPubkey === pubkey"
                @click="removeTrustedPublisher(pubkey)"
                >{{
                  removeBusyPubkey === pubkey ? 'Removing…' : 'Remove'
                }}</Button
              >
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <!-- Profile -->
    <template v-if="publicKey && activeTab === 'profile'">
      <Card>
        <CardHeader>
          <CardTitle>Catalogue publisher profile</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p class="tw:font-mono tw:text-xs tw:text-muted-foreground">
            {{ selfPublisher }}
          </p>
          <div class="tw:grid tw:gap-1.5">
            <Label for="profile-name">Name</Label>
            <Input id="profile-name" v-model="profileForm.name" />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="profile-about">About</Label>
            <Textarea
              id="profile-about"
              v-model="profileForm.about"
              class="tw:min-h-20"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="profile-picture">Picture URL</Label>
            <Input id="profile-picture" v-model="profileForm.picture" />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="profile-nip05">NIP-05</Label>
            <Input id="profile-nip05" v-model="profileForm.nip05" />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="profile-website">Website</Label>
            <Input id="profile-website" v-model="profileForm.website" />
          </div>
          <Button :disabled="profileBusy" @click="submitProfile">{{
            profileBusy ? 'Publishing…' : 'Publish profile'
          }}</Button>
        </CardContent>
      </Card>
    </template>

    <!-- Announcements -->
    <template v-if="publicKey && activeTab === 'announce'">
      <Card>
        <CardHeader>
          <CardTitle>My declarations</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            v-if="ownEntries.length === 0"
            title="No declarations of your own yet"
          />
          <ul v-else class="tw:grid tw:gap-2">
            <li
              v-for="entry in ownEntries"
              :key="entry.event_id"
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2 tw:rounded-md tw:border tw:border-border-subtle tw:p-2 tw:text-sm"
            >
              <span
                >{{ entry.declaration.Name || entry.declaration.AppID }}
                <span class="tw:font-mono tw:text-xs tw:text-muted-foreground"
                  >v{{ entry.declaration.Version }}</span
                ></span
              >
              <Button
                size="sm"
                variant="outline"
                :disabled="
                  announceBusyAppId === entry.declaration.AppID ||
                  alreadyAnnounced(
                    entry.declaration.AppID,
                    entry.declaration.Commit,
                  )
                "
                @click="announceEntry(entry.declaration.AppID)"
                >{{
                  alreadyAnnounced(
                    entry.declaration.AppID,
                    entry.declaration.Commit,
                  )
                    ? 'Already announced'
                    : announceBusyAppId === entry.declaration.AppID
                      ? 'Announcing…'
                      : 'Announce'
                }}</Button
              >
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            v-if="announcements && announcements.length === 0"
            title="No announcements published yet"
          />
          <div v-else class="tw:overflow-x-auto">
            <table class="tw:w-full tw:text-sm">
              <thead>
                <tr class="tw:text-left tw:text-xs tw:text-muted-foreground">
                  <th class="tw:pb-2">App</th>
                  <th class="tw:pb-2">Version</th>
                  <th class="tw:pb-2">Commit</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in announcements || []"
                  :key="item.event_id"
                  class="tw:border-t tw:border-border-subtle"
                >
                  <td class="tw:py-1.5 tw:font-mono tw:text-xs">
                    {{ item.app_id }}
                  </td>
                  <td class="tw:py-1.5">{{ item.version }}</td>
                  <td class="tw:py-1.5 tw:font-mono tw:text-xs">
                    {{ shortHash(item.commit) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </template>
  </PageLayout>
</template>
