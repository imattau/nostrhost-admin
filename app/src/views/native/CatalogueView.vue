<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  announceCatalogueEntry,
  attestCatalogueEntry,
  getCatalogueAnnouncements,
  getCatalogueCandidates,
  getCatalogueHistory,
  getCatalogueList,
  getCatalogueProfile,
  getCatalogueTrust,
  publishCatalogueEntry,
  reverifyCatalogueEntry,
  setCatalogueProfile,
  verifyCatalogueEvent,
  type AttestationPolicyMode,
  type CatalogueAnnouncement,
  type CatalogueCandidate,
  type CatalogueClaim,
  type CatalogueEntry,
  type CatalogueHistoryRecord,
  type CatalogueProfile,
  type CatalogueReverifyResult,
  type CatalogueTrustEntry,
} from '@/api/nativeCatalog'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'attest', label: 'Attest' },
  { id: 'trust', label: 'Trust' },
  { id: 'profile', label: 'Profile' },
  { id: 'announce', label: 'Announcements' },
  { id: 'verify', label: 'Verify' },
] as const
type TabId = (typeof TABS)[number]['id']
const activeTab = ref<TabId>('browse')

const selfPublisher = ref('')

const error = ref('')
const loading = ref(false)

// -- browse ------------------------------------------------------------

const entries = ref<CatalogueEntry[] | null>(null)
const search = ref('')
const category = ref('all')
const busyAppId = ref('')
const actionNotice = ref('')
const actionError = ref('')

const categories = computed(() => {
  const found = new Set<string>()
  for (const entry of entries.value || []) {
    if (entry.declaration.Category) found.add(entry.declaration.Category)
  }
  return Array.from(found).sort()
})

const visibleEntries = computed(() =>
  (entries.value || []).filter((entry) => {
    const matchesCategory =
      category.value === 'all' || entry.declaration.Category === category.value
    const needle = search.value.trim().toLocaleLowerCase()
    const matchesSearch =
      !needle ||
      `${entry.declaration.Name} ${entry.declaration.AppID} ${entry.declaration.Description}`
        .toLocaleLowerCase()
        .includes(needle)
    return matchesCategory && matchesSearch
  }),
)

function shortHash(hash: string) {
  if (!hash) return ''
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

async function loadBrowse() {
  const [list, profile] = await Promise.all([
    getCatalogueList(),
    getCatalogueProfile(),
  ])
  entries.value = list.entries
  selfPublisher.value = profile.self_publisher
}

async function publishUnderMyKey(appId: string) {
  busyAppId.value = appId
  actionError.value = ''
  actionNotice.value = ''
  try {
    await publishCatalogueEntry(appId)
    actionNotice.value = `Published ${appId} under this node's publisher key.`
    await loadBrowse()
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'Publish failed.'
  } finally {
    busyAppId.value = ''
  }
}

const reverifyResult = ref<CatalogueReverifyResult | null>(null)

async function reverifyEntry(appId: string) {
  busyAppId.value = appId
  actionError.value = ''
  actionNotice.value = ''
  reverifyResult.value = null
  try {
    reverifyResult.value = await reverifyCatalogueEntry(appId)
    actionNotice.value = reverifyResult.value.ok
      ? `${appId} reverified: repository and hashes match the declaration.`
      : `${appId} reverify failed: ${reverifyResult.value.error}`
  } catch (cause) {
    actionError.value =
      cause instanceof Error ? cause.message : 'Reverify failed.'
  } finally {
    busyAppId.value = ''
  }
}

// -- attest --------------------------------------------------------------

const candidates = ref<CatalogueCandidate[] | null>(null)
const history = ref<CatalogueHistoryRecord[] | null>(null)
const attestTarget = ref<CatalogueCandidate | null>(null)
const attestClaim = ref<CatalogueClaim>('recommend')
const attestComment = ref('')
const attestBusy = ref(false)
const attestNotice = ref('')
const attestError = ref('')

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
  attestNotice.value = ''
  attestError.value = ''
}

async function submitAttest() {
  if (!attestTarget.value) return
  attestBusy.value = true
  attestError.value = ''
  attestNotice.value = ''
  try {
    await attestCatalogueEntry({
      appId: attestTarget.value.app_id,
      publisher: attestTarget.value.publisher,
      claim: attestClaim.value,
      comment: attestComment.value,
    })
    attestNotice.value = `Endorsement published for ${attestTarget.value.app_id}.`
    attestTarget.value = null
    await loadAttest()
  } catch (cause) {
    attestError.value =
      cause instanceof Error ? cause.message : 'Endorsement failed.'
  } finally {
    attestBusy.value = false
  }
}

// -- trust -----------------------------------------------------------------

const trustEntries = ref<CatalogueTrustEntry[] | null>(null)
const trustPolicy = ref<AttestationPolicyMode>('off')
const trustMinAttestations = ref('1')
const trustBusy = ref(false)
const trustError = ref('')

async function loadTrust() {
  trustBusy.value = true
  trustError.value = ''
  try {
    const result = await getCatalogueTrust({
      mode: trustPolicy.value,
      minAttestations: Number(trustMinAttestations.value) || undefined,
    })
    trustEntries.value = result.entries
  } catch (cause) {
    trustError.value =
      cause instanceof Error ? cause.message : 'Failed to load trust dashboard.'
  } finally {
    trustBusy.value = false
  }
}

// -- profile -----------------------------------------------------------------

const profileForm = ref<CatalogueProfile>({})
const profileBusy = ref(false)
const profileNotice = ref('')
const profileError = ref('')

async function loadProfile() {
  const result = await getCatalogueProfile()
  profileForm.value = { ...result.profile }
  selfPublisher.value = result.self_publisher
}

async function submitProfile() {
  profileBusy.value = true
  profileError.value = ''
  profileNotice.value = ''
  try {
    await setCatalogueProfile(profileForm.value)
    profileNotice.value = 'Profile published.'
  } catch (cause) {
    profileError.value =
      cause instanceof Error ? cause.message : 'Publishing the profile failed.'
  } finally {
    profileBusy.value = false
  }
}

// -- announcements -----------------------------------------------------------

const announcements = ref<CatalogueAnnouncement[] | null>(null)
const ownEntries = computed(() =>
  (entries.value || []).filter(
    (entry) => entry.declaration.Publisher === selfPublisher.value,
  ),
)
const announceBusyAppId = ref('')
const announceNotice = ref('')
const announceError = ref('')

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
  announceBusyAppId.value = appId
  announceError.value = ''
  announceNotice.value = ''
  try {
    await announceCatalogueEntry(appId)
    announceNotice.value = `Announced ${appId}.`
    await loadAnnounce()
  } catch (cause) {
    announceError.value =
      cause instanceof Error ? cause.message : 'Announcement failed.'
  } finally {
    announceBusyAppId.value = ''
  }
}

// -- verify ------------------------------------------------------------------

const verifyInput = ref('')
const verifyBusy = ref(false)
const verifyResult = ref<{
  valid: boolean
  publisher: string
  app_id: string
  event_id: string
} | null>(null)
const verifyError = ref('')

async function submitVerify() {
  verifyBusy.value = true
  verifyError.value = ''
  verifyResult.value = null
  try {
    verifyResult.value = await verifyCatalogueEvent(verifyInput.value)
  } catch (cause) {
    verifyError.value =
      cause instanceof Error ? cause.message : 'Verification failed.'
  } finally {
    verifyBusy.value = false
  }
}

// -- tab loading ---------------------------------------------------------

const tabLoaders: Record<TabId, () => Promise<void>> = {
  browse: loadBrowse,
  attest: loadAttest,
  trust: loadTrust,
  profile: loadProfile,
  announce: loadAnnounce,
  verify: async () => {},
}
const loadedTabs = new Set<TabId>()

async function loadTab(tab: TabId) {
  loading.value = true
  error.value = ''
  try {
    await tabLoaders[tab]()
    loadedTabs.add(tab)
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load this tab.'
  } finally {
    loading.value = false
  }
}

function selectTab(tab: TabId) {
  activeTab.value = tab
  if (!loadedTabs.has(tab)) loadTab(tab)
}

async function refreshCurrentTab() {
  loadedTabs.delete(activeTab.value)
  await loadTab(activeTab.value)
}

async function bootstrap() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    await loadTab('browse')
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load the catalogue.'
  } finally {
    loading.value = false
  }
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
      eyebrow="Trusted native catalogue"
      title="Catalogue"
      description="Browse, publish, endorse and verify signed app declarations this node trusts, synced from the control relay."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

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
          {{
            entries
              ? `${visibleEntries.length} of ${entries.length} trusted app(s)`
              : ''
          }}
        </p>
      </div>

      <Alert v-if="actionError" variant="danger" role="alert">{{
        actionError
      }}</Alert>
      <Alert v-if="actionNotice" variant="success" role="status">{{
        actionNotice
      }}</Alert>
      <Alert
        v-if="reverifyResult && !reverifyResult.ok"
        variant="warning"
        role="status"
      >
        Reverify for {{ reverifyResult.app_id }} did not match:
        {{ reverifyResult.error }}
      </Alert>

      <div
        v-if="entries && entries.length"
        class="tw:flex tw:flex-wrap tw:gap-2"
      >
        <label class="tw:sr-only" for="catalogue-search"
          >Search catalogue</label
        >
        <input
          id="catalogue-search"
          v-model="search"
          class="tw:min-w-48 tw:flex-1 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
          placeholder="Search trusted apps"
        />
        <label class="tw:sr-only" for="catalogue-category"
          >Filter by category</label
        >
        <select
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

      <p
        v-if="entries && entries.length === 0"
        class="tw:text-sm tw:text-muted-foreground"
      >
        No trusted apps in the catalogue yet.
      </p>
      <p
        v-else-if="entries && visibleEntries.length === 0"
        class="tw:text-sm tw:text-muted-foreground"
      >
        No trusted apps match this search or category.
      </p>

      <div
        v-if="visibleEntries.length"
        class="tw:grid tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-3"
      >
        <Card v-for="entry in visibleEntries" :key="entry.event_id">
          <CardHeader>
            <CardTitle
              class="tw:flex tw:items-center tw:justify-between tw:gap-2"
            >
              <span class="tw:truncate">{{
                entry.declaration.Name || entry.declaration.AppID
              }}</span>
              <Badge variant="brand">v{{ entry.declaration.Version }}</Badge>
            </CardTitle>
            <p class="tw:font-mono tw:text-xs tw:text-muted-foreground">
              {{ entry.declaration.AppID }}
              <span v-if="entry.declaration.Category"
                >· {{ entry.declaration.Category }}</span
              >
              <Badge
                v-if="entry.declaration.Publisher === selfPublisher"
                variant="neutral"
                class="tw:ml-1"
                >mine</Badge
              >
            </p>
          </CardHeader>
          <CardContent>
            <p
              v-if="entry.declaration.Description"
              class="tw:mb-3 tw:line-clamp-2 tw:text-xs tw:text-muted-foreground"
            >
              {{ entry.declaration.Description }}
            </p>
            <dl class="tw:grid tw:gap-1.5 tw:text-xs">
              <div class="tw:grid tw:gap-0.5">
                <dt class="tw:text-muted-foreground">Repository</dt>
                <dd class="tw:truncate tw:font-mono tw:text-foreground">
                  {{ entry.declaration.Repository }}
                </dd>
              </div>
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <dt class="tw:text-muted-foreground">Commit</dt>
                <dd class="tw:font-mono tw:text-foreground">
                  {{ shortHash(entry.declaration.Commit) }}
                </dd>
              </div>
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <dt class="tw:text-muted-foreground">Manifest hash</dt>
                <dd class="tw:font-mono tw:text-foreground">
                  {{ shortHash(entry.declaration.ManifestHash) }}
                </dd>
              </div>
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <dt class="tw:text-muted-foreground">Content hash</dt>
                <dd class="tw:font-mono tw:text-foreground">
                  {{ shortHash(entry.declaration.ContentHash) }}
                </dd>
              </div>
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <dt class="tw:text-muted-foreground">Architectures</dt>
                <dd class="tw:truncate tw:text-foreground">
                  {{ entry.declaration.Architectures.join(', ') }}
                </dd>
              </div>
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <dt class="tw:text-muted-foreground">Provenance event</dt>
                <dd class="tw:font-mono tw:text-foreground">
                  {{ shortHash(entry.event_id) }}
                </dd>
              </div>
            </dl>
            <div class="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2">
              <a
                v-if="entry.nsite"
                :href="entry.nsite.url"
                target="_blank"
                rel="noreferrer"
                class="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-md tw:bg-brand-500 tw:px-3 tw:py-1.5 tw:text-sm tw:font-medium tw:text-white tw:no-underline hover:tw:bg-brand-600"
                >Open nsite
                <span class="tw:font-mono tw:text-xs"
                  >{{ entry.nsite.label }} ↗</span
                ></a
              >
              <Button
                v-if="entry.declaration.Publisher !== selfPublisher"
                variant="outline"
                size="sm"
                :disabled="busyAppId === entry.declaration.AppID"
                @click="publishUnderMyKey(entry.declaration.AppID)"
                >{{
                  busyAppId === entry.declaration.AppID
                    ? 'Publishing…'
                    : 'Publish under my key'
                }}</Button
              >
              <Button
                variant="outline"
                size="sm"
                :disabled="busyAppId === entry.declaration.AppID"
                @click="reverifyEntry(entry.declaration.AppID)"
                >{{
                  busyAppId === entry.declaration.AppID
                    ? 'Reverifying…'
                    : 'Reverify'
                }}</Button
              >
            </div>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- Attest -->
    <template v-if="publicKey && activeTab === 'attest'">
      <Alert v-if="attestError" variant="danger" role="alert">{{
        attestError
      }}</Alert>
      <Alert v-if="attestNotice" variant="success" role="status">{{
        attestNotice
      }}</Alert>

      <Card>
        <CardHeader>
          <CardTitle>Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            v-if="candidates && candidates.length === 0"
            class="tw:text-sm tw:text-muted-foreground"
          >
            No installed apps from other publishers are waiting for an
            endorsement.
          </p>
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
          <p
            v-if="history && history.length === 0"
            class="tw:text-sm tw:text-muted-foreground"
          >
            This node has not published any endorsements yet.
          </p>
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
      <Alert v-if="trustError" variant="danger" role="alert">{{
        trustError
      }}</Alert>

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

      <div
        v-if="trustEntries && trustEntries.length === 0"
        class="tw:text-sm tw:text-muted-foreground"
      >
        No declarations in the catalogue yet.
      </div>
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

    <!-- Profile -->
    <template v-if="publicKey && activeTab === 'profile'">
      <Alert v-if="profileError" variant="danger" role="alert">{{
        profileError
      }}</Alert>
      <Alert v-if="profileNotice" variant="success" role="status">{{
        profileNotice
      }}</Alert>

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
      <Alert v-if="announceError" variant="danger" role="alert">{{
        announceError
      }}</Alert>
      <Alert v-if="announceNotice" variant="success" role="status">{{
        announceNotice
      }}</Alert>

      <Card>
        <CardHeader>
          <CardTitle>My declarations</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            v-if="ownEntries.length === 0"
            class="tw:text-sm tw:text-muted-foreground"
          >
            This node has no published declarations of its own yet.
          </p>
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
          <p
            v-if="announcements && announcements.length === 0"
            class="tw:text-sm tw:text-muted-foreground"
          >
            No announcements published yet.
          </p>
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

    <!-- Verify -->
    <template v-if="publicKey && activeTab === 'verify'">
      <Alert v-if="verifyError" variant="danger" role="alert">{{
        verifyError
      }}</Alert>

      <Card>
        <CardHeader>
          <CardTitle>Verify a declaration event</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p class="tw:text-sm tw:text-muted-foreground">
            Paste a signed Nostr declaration event (kind 32267 or legacy 30078)
            to check its ID, signature, schema, and trusted-publisher
            membership.
          </p>
          <Textarea
            v-model="verifyInput"
            class="tw:min-h-40"
            placeholder='{"id": "...", "pubkey": "...", "kind": 32267, ...}'
          />
          <Button :disabled="verifyBusy" @click="submitVerify">{{
            verifyBusy ? 'Verifying…' : 'Verify'
          }}</Button>
          <Alert v-if="verifyResult?.valid" variant="success" role="status">
            Valid declaration for {{ verifyResult.app_id }}, published by
            {{ verifyResult.publisher }}.
          </Alert>
        </CardContent>
      </Card>
    </template>
  </PageLayout>
</template>
