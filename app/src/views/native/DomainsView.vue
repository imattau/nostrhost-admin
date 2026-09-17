<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  DNS_PROVIDER_TYPES,
  addDomain,
  applyPrimaryDomain,
  applyDns,
  getCredentials,
  getDnsWatch,
  getDomainInspect,
  getDomains,
  getFreeHostnameSubscriptions,
  getPublicIp,
  getPrimaryDomain,
  planPrimaryDomain,
  removeCredential,
  removeDomain,
  setCredential,
  subscribeFreeHostname,
  unsubscribeFreeHostname,
  verifyDns,
  type CredentialRef,
  type DnsProviderType,
  type DnsWatchStatus,
  type DomainInspect,
  type FreeHostnameSubscription,
  type PublicIp,
  type PrimaryDomainPlan,
  type PrimaryDomainStatus,
} from '@/api/nativeDomains'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import ChangeLedger from '@/components/native/ChangeLedger.vue'

const { success, danger } = useNotifications()
const route = useRoute()
const router = useRouter()

const domains = ref<string[]>([])
const selectedDomain = ref<string | null>(null)
const inspect = ref<DomainInspect | null>(null)
const credentials = ref<CredentialRef[]>([])
const subscriptions = ref<FreeHostnameSubscription[]>([])
const publicIp = ref<PublicIp | null>(null)
const dnsWatch = ref<DnsWatchStatus | null>(null)
const primaryDomain = ref('')
const primaryCandidates = ref<PrimaryDomainStatus['candidates']>([])
const primaryPlan = ref<PrimaryDomainPlan | null>(null)

const inspectLoading = ref(false)
const busy = ref('')
const { run } = useActionRunner(busy, '')
const { run: runInspect } = useActionRunner(inspectLoading, false)

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  const [
    domainResult,
    credentialResult,
    subscriptionResult,
    ipResult,
    watchResult,
    primaryResult,
  ] = await Promise.all([
    getDomains(),
    getCredentials(),
    getFreeHostnameSubscriptions(),
    getPublicIp(),
    getDnsWatch(),
    getPrimaryDomain(),
  ])
  domains.value = domainResult.domains
  credentials.value = credentialResult.credentials
  subscriptions.value = subscriptionResult.subscriptions
  publicIp.value = ipResult
  dnsWatch.value = watchResult
  primaryDomain.value = primaryResult.current
  primaryCandidates.value = primaryResult.candidates
  if (selectedDomain.value && !domains.value.includes(selectedDomain.value)) {
    selectedDomain.value = null
    inspect.value = null
  }
  const requested = route.query.domain
  if (
    !selectedDomain.value &&
    typeof requested === 'string' &&
    domains.value.includes(requested)
  ) {
    await selectDomain(requested)
  }
}, 'Failed to load domains.')

async function selectDomain(domain: string) {
  if (route.query.domain !== domain) {
    await router.replace({ query: { ...route.query, domain } })
  }
  selectedDomain.value = domain
  inspect.value = null
  await runInspect(
    true,
    async () => {
      await sync()
      inspect.value = await getDomainInspect(domain)
    },
    `Failed to inspect ${domain}.`,
  )
}

async function reviewServerAddress(domain: string) {
  await run(
    `primary-plan-${domain}`,
    async () => {
      await sync()
      primaryPlan.value = await planPrimaryDomain(domain)
    },
    `Could not prepare the server address change.`,
  )
}

async function applyServerAddress() {
  if (!primaryPlan.value) return
  const reviewed = primaryPlan.value
  await run(
    `primary-apply-${reviewed.target_domain}`,
    async () => {
      await sync()
      const result = await applyPrimaryDomain(
        reviewed.target_domain,
        reviewed.plan_sha256,
      )
      success(
        `Server address changed to ${reviewed.target_domain}. Redirecting…`,
      )
      window.setTimeout(() => window.location.assign(result.admin_url), 1500)
    },
    `Could not change the server address.`,
  )
}

watch(
  () => route.query.domain,
  async (domain) => {
    if (typeof domain !== 'string' || selectedDomain.value === domain) return
    if (domains.value.includes(domain)) await selectDomain(domain)
  },
)

const providerCredentials = computed(() =>
  credentials.value.filter((credential) =>
    credential.ref.startsWith(`secret:dns/${addProviderType.value}/`),
  ),
)

// -- add domain -------------------------------------------------------------

const showAddForm = ref(false)
const addDomainName = ref('')
const addProviderType = ref<DnsProviderType>('manual')
const addProviderZone = ref('')
const addCredential = ref('')
const addPrimary = ref(false)
const addIpv4 = ref(true)
const addIpv6 = ref(true)
const addWildcard = ref(true)
const addNip05 = ref(false)
const { pending: confirmingAdd, request: requestAddConfirm } = useConfirm(false)

function resetAddForm() {
  addDomainName.value = ''
  addProviderType.value = 'manual'
  addProviderZone.value = ''
  addCredential.value = ''
  addPrimary.value = false
  addIpv4.value = true
  addIpv6.value = true
  addWildcard.value = true
  addNip05.value = false
  confirmingAdd.value = false
}

function requestAdd() {
  if (!addDomainName.value.trim()) {
    danger('Enter a domain name.')
    return
  }
  requestAddConfirm(true)
}

async function confirmAdd() {
  confirmingAdd.value = false
  await run(
    'add',
    async () => {
      await sync()
      const result = await addDomain({
        domain: addDomainName.value.trim(),
        provider_type: addProviderType.value,
        provider_zone: addProviderZone.value.trim() || null,
        credential: addCredential.value.trim() || null,
        primary: addPrimary.value,
        ipv4: addIpv4.value,
        ipv6: addIpv6.value,
        wildcard: addWildcard.value,
        nip05: addNip05.value,
      })
      success(
        `Domain registration submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      showAddForm.value = false
      resetAddForm()
      await load()
    },
    'Failed to register domain.',
  )
}

// -- remove / apply / verify -------------------------------------------------

const { pending: confirmingRemove, request: requestRemoveConfirm } = useConfirm<
  string | null
>(null)

function requestRemove(domain: string) {
  requestRemoveConfirm(domain)
}

async function confirmRemove(domain: string) {
  confirmingRemove.value = null
  await run(
    `remove-${domain}`,
    async () => {
      await sync()
      const result = await removeDomain(domain)
      success(
        `Removal of ${domain} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      if (selectedDomain.value === domain) {
        selectedDomain.value = null
        inspect.value = null
      }
      await load()
    },
    `Failed to remove ${domain}.`,
  )
}

const { pending: confirmingApply, request: requestApplyDnsConfirm } =
  useConfirm<string | null>(null)

function requestApplyDns(domain: string) {
  requestApplyDnsConfirm(domain)
}

async function confirmApplyDns(domain: string) {
  confirmingApply.value = null
  await run(
    `apply-${domain}`,
    async () => {
      await sync()
      const result = await applyDns(domain)
      success(
        `DNS apply for ${domain} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      if (selectedDomain.value === domain) await selectDomain(domain)
    },
    `Failed to apply DNS for ${domain}.`,
  )
}

async function runVerify(domain: string) {
  await run(
    `verify-${domain}`,
    async () => {
      await sync()
      const result = await verifyDns(domain)
      const failing = result.verify.filter(
        (row) =>
          typeof row === 'object' &&
          row !== null &&
          (row as { ok?: boolean }).ok === false,
      ).length
      if (failing === 0) {
        success(`${domain}: all DNS records verified.`)
      } else {
        danger(`${domain}: ${failing} record(s) did not verify.`)
      }
    },
    `Failed to verify ${domain}.`,
  )
}

// -- free hostname subscriptions ---------------------------------------------

const showClaimForm = ref(false)
const claimHostname = ref('')

async function submitClaim() {
  if (!claimHostname.value.trim()) {
    danger('Enter a hostname label.')
    return
  }
  await run(
    'claim',
    async () => {
      await sync()
      const result = await subscribeFreeHostname(claimHostname.value.trim())
      success(
        `Free-hostname claim submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      claimHostname.value = ''
      showClaimForm.value = false
      await load()
    },
    'Failed to claim hostname.',
  )
}

const { pending: confirmingUnsubscribe, request: requestUnsubscribeConfirm } =
  useConfirm<string | null>(null)

function requestUnsubscribe(hostname: string) {
  requestUnsubscribeConfirm(hostname)
}

async function confirmUnsubscribe(hostname: string) {
  confirmingUnsubscribe.value = null
  await run(
    `unsubscribe-${hostname}`,
    async () => {
      await sync()
      const result = await unsubscribeFreeHostname(hostname)
      success(
        `Released ${hostname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to release ${hostname}.`,
  )
}

// -- DNS provider credentials -------------------------------------------------

const showCredentialForm = ref(false)
const credentialProvider = ref<DnsProviderType>('cloudflare')
const credentialName = ref('')
const credentialValue = ref('')

function parseCredentialRef(ref: string): { provider: string; name: string } {
  const match = ref.match(/^secret:dns\/([^/]+)\/(.+)$/)
  return match
    ? { provider: match[1], name: match[2] }
    : { provider: '', name: ref }
}

async function submitCredential() {
  if (!credentialName.value.trim() || !credentialValue.value.trim()) {
    danger('Enter a name and a token value.')
    return
  }
  await run(
    'credential-set',
    async () => {
      await sync()
      await setCredential(
        credentialProvider.value,
        credentialName.value.trim(),
        credentialValue.value.trim(),
      )
      success(
        `Stored credential ${credentialProvider.value}/${credentialName.value.trim()}.`,
      )
      credentialName.value = ''
      credentialValue.value = ''
      showCredentialForm.value = false
      await load()
    },
    'Failed to store credential.',
  )
}

const {
  pending: confirmingRemoveCredential,
  request: requestRemoveCredentialConfirm,
} = useConfirm<string | null>(null)

function requestRemoveCredential(ref: string) {
  requestRemoveCredentialConfirm(ref)
}

async function confirmRemoveCredential(ref: string) {
  confirmingRemoveCredential.value = null
  const { provider, name } = parseCredentialRef(ref)
  await run(
    `credential-remove-${ref}`,
    async () => {
      await sync()
      await removeCredential(provider, name)
      success(`Removed credential ${provider}/${name}.`)
      await load()
    },
    `Failed to remove ${ref}.`,
  )
}

const driftBadge = computed(() => {
  const inSync = inspect.value?.drift.in_sync
  if (inSync === true) return { variant: 'success' as const, label: 'In sync' }
  if (inSync === false)
    return { variant: 'warning' as const, label: 'DNS differences' }
  return { variant: 'neutral' as const, label: 'Unknown' }
})

const selectedPrimaryCandidate = computed(() =>
  primaryCandidates.value.find(
    (candidate) => candidate.domain === selectedDomain.value,
  ),
)
</script>

<template>
  <PageLayout width="workspace">
    <PageHeader
      eyebrow="Network"
      title="Domains"
      description="Domains, DNS records and free-hostname claims. Registering, removing or applying DNS for a domain asks for confirmation first."
    />

    <template v-if="publicKey">
      <div
        class="tw:grid tw:items-start tw:gap-8 tw:lg:grid-cols-[minmax(17rem,0.75fr)_minmax(24rem,1.25fr)]"
      >
        <section class="tw:border-t tw:border-border-subtle tw:py-5">
          <header class="tw:mb-4">
            <h2 class="tw:flex tw:items-center tw:justify-between tw:gap-2">
              <span>Registered domains</span>
              <Button
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="showAddForm = !showAddForm"
                >{{ showAddForm ? 'Cancel' : 'Add domain' }}</Button
              >
            </h2>
          </header>
          <div class="tw:grid tw:gap-4">
            <div
              v-if="showAddForm"
              class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
                <div class="tw:grid tw:gap-1.5">
                  <Label for="add-domain-name">Domain name</Label>
                  <Input
                    id="add-domain-name"
                    v-model="addDomainName"
                    :placeholder="
                      addProviderType === 'duckdns'
                        ? 'mybox or mybox.duckdns.org'
                        : 'example.com'
                    "
                    spellcheck="false"
                    autocomplete="off"
                  />
                  <p
                    v-if="addProviderType === 'duckdns'"
                    class="tw:m-0 tw:text-xs tw:text-muted-foreground"
                  >
                    Enter the DuckDNS subname or full hostname. The server will
                    store it as subname.duckdns.org.
                  </p>
                </div>
                <div class="tw:grid tw:gap-1.5">
                  <Label for="add-domain-provider">DNS provider</Label>
                  <Select id="add-domain-provider" v-model="addProviderType">
                    <option
                      v-for="type in DNS_PROVIDER_TYPES"
                      :key="type"
                      :value="type"
                    >
                      {{ type }}
                    </option>
                  </Select>
                </div>
              </div>
              <div
                v-if="addProviderType !== 'manual'"
                class="tw:grid tw:gap-4 tw:sm:grid-cols-2"
              >
                <div class="tw:grid tw:gap-1.5">
                  <Label for="add-domain-zone">Provider zone (optional)</Label>
                  <Input
                    id="add-domain-zone"
                    v-model="addProviderZone"
                    autocomplete="off"
                  />
                </div>
                <div class="tw:grid tw:gap-1.5">
                  <Label for="add-domain-credential">Provider credential</Label>
                  <Select id="add-domain-credential" v-model="addCredential">
                    <option value="">Choose a stored credential…</option>
                    <option
                      v-for="credential in providerCredentials"
                      :key="credential.ref"
                      :value="credential.ref"
                    >
                      {{
                        credential.ref.replace(
                          `secret:dns/${addProviderType}/`,
                          '',
                        )
                      }}
                    </option>
                  </Select>
                  <p
                    v-if="providerCredentials.length === 0"
                    class="tw:m-0 tw:text-xs tw:text-muted-foreground"
                  >
                    Add a {{ addProviderType }} credential under Advanced first.
                  </p>
                  <p
                    v-else-if="addProviderType === 'duckdns'"
                    class="tw:m-0 tw:text-xs tw:text-muted-foreground"
                  >
                    The credential must contain the raw account token from
                    DuckDNS, not an update URL or credential reference.
                  </p>
                </div>
              </div>
              <div class="tw:flex tw:flex-wrap tw:gap-4 tw:text-sm">
                <label class="tw:flex tw:items-center tw:gap-2">
                  <input
                    v-model="addPrimary"
                    type="checkbox"
                    class="tw:size-4 tw:accent-brand-500"
                  />
                  Server address
                </label>
                <label class="tw:flex tw:items-center tw:gap-2">
                  <input
                    v-model="addIpv4"
                    type="checkbox"
                    class="tw:size-4 tw:accent-brand-500"
                  />
                  IPv4
                </label>
                <label class="tw:flex tw:items-center tw:gap-2">
                  <input
                    v-model="addIpv6"
                    type="checkbox"
                    class="tw:size-4 tw:accent-brand-500"
                  />
                  IPv6
                </label>
                <label class="tw:flex tw:items-center tw:gap-2">
                  <input
                    v-model="addWildcard"
                    type="checkbox"
                    class="tw:size-4 tw:accent-brand-500"
                  />
                  Wildcard
                </label>
                <label class="tw:flex tw:items-center tw:gap-2">
                  <input
                    v-model="addNip05"
                    type="checkbox"
                    class="tw:size-4 tw:accent-brand-500"
                  />
                  NIP-05
                </label>
              </div>
              <div class="tw:flex tw:justify-end">
                <Button size="sm" :disabled="busy !== ''" @click="requestAdd">{{
                  busy === 'add' ? 'Registering…' : 'Register domain'
                }}</Button>
              </div>
            </div>

            <EmptyState
              v-if="!loading && domains.length === 0"
              title="No domains registered yet"
              description="Register a domain above to start provisioning apps and sites on it."
            />
            <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
              Loading…
            </p>
            <ul
              v-else
              class="tw:m-0 tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle tw:pl-0"
            >
              <li
                v-for="domain in domains"
                :key="domain"
                class="tw:border-l-2 tw:px-3 tw:py-3"
                :class="
                  selectedDomain === domain
                    ? 'tw:border-signature tw:bg-selection'
                    : 'tw:border-transparent'
                "
              >
                <div
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3"
                >
                  <button
                    type="button"
                    class="tw:m-0 tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:font-mono tw:text-sm tw:text-foreground"
                    @click="selectDomain(domain)"
                  >
                    {{ domain }}
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="requestRemove(domain)"
                    >{{
                      busy === `remove-${domain}` ? 'Removing…' : 'Remove'
                    }}</Button
                  >
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section
          v-if="selectedDomain"
          class="tw:border-t tw:border-border-subtle tw:bg-workbench tw:px-5 tw:py-5 tw:lg:border-l tw:lg:border-t-0"
        >
          <header class="tw:mb-4">
            <h2 class="tw:flex tw:items-center tw:justify-between tw:gap-2">
              <span class="tw:font-mono">{{ selectedDomain }}</span>
              <span class="tw:flex tw:items-center tw:gap-2">
                <RouterLink
                  :to="{ name: 'native-nsites' }"
                  class="tw:text-xs tw:font-medium tw:text-brand-500 tw:no-underline tw:hover:underline"
                  >View sites →</RouterLink
                >
                <Badge v-if="inspect" :variant="driftBadge.variant">{{
                  driftBadge.label
                }}</Badge>
              </span>
            </h2>
          </header>
          <div class="tw:grid tw:gap-4">
            <p
              v-if="inspectLoading"
              class="tw:text-sm tw:text-muted-foreground"
            >
              Loading…
            </p>
            <template v-else-if="inspect">
              <div class="tw:grid tw:gap-1 tw:text-sm">
                <p class="tw:m-0">
                  Provider
                  <code class="tw:font-mono">{{ inspect.provider.type }}</code>
                  · mode
                  <code class="tw:font-mono">{{ inspect.mode }}</code>
                  <template v-if="inspect.domain.primary">
                    · <Badge variant="neutral">server address</Badge>
                  </template>
                </p>
                <p
                  v-if="inspect.drift.note"
                  class="tw:m-0 tw:text-xs tw:text-muted-foreground"
                >
                  {{ inspect.drift.note }}
                </p>
              </div>

              <div v-if="inspect.plan.changes?.length" class="tw:grid tw:gap-1">
                <p
                  class="tw:m-0 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-muted-foreground"
                >
                  Pending DNS changes
                </p>
                <ul class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
                  <li
                    v-for="(change, index) in inspect.plan.changes"
                    :key="index"
                    class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:text-sm"
                  >
                    <code class="tw:font-mono"
                      >{{ change.record.type }}
                      {{ change.record.name ?? '' }}</code
                    >
                    <Badge variant="warning">{{ change.action }}</Badge>
                  </li>
                </ul>
              </div>
              <p v-else class="tw:m-0 tw:text-sm tw:text-muted-foreground">
                No pending DNS changes.
              </p>

              <div
                v-if="
                  selectedDomain !== primaryDomain &&
                  selectedPrimaryCandidate &&
                  !selectedPrimaryCandidate.ready
                "
                class="tw:border-l-2 tw:border-warning tw:pl-3 tw:text-sm"
                role="status"
              >
                <p class="tw:m-0 tw:font-medium">
                  This domain is not ready to become the server address.
                </p>
                <ul class="tw:mb-0 tw:mt-1 tw:pl-5 tw:text-muted-foreground">
                  <li
                    v-for="reason in selectedPrimaryCandidate.reasons"
                    :key="reason"
                  >
                    {{ reason }}
                  </li>
                </ul>
              </div>

              <div
                class="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2"
              >
                <Button
                  v-if="selectedDomain !== primaryDomain"
                  variant="ghost"
                  size="sm"
                  :disabled="
                    busy !== '' ||
                    inspect.drift.in_sync === false ||
                    selectedPrimaryCandidate?.ready === false
                  "
                  @click="reviewServerAddress(selectedDomain)"
                  >Use as server address</Button
                >
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="runVerify(selectedDomain)"
                  >{{
                    busy === `verify-${selectedDomain}`
                      ? 'Verifying…'
                      : 'Verify DNS'
                  }}</Button
                >
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="requestApplyDns(selectedDomain)"
                  >{{
                    busy === `apply-${selectedDomain}`
                      ? 'Applying…'
                      : 'Apply changes'
                  }}</Button
                >
              </div>
              <ChangeLedger
                v-if="primaryPlan?.target_domain === selectedDomain"
                title="Review server address change"
                :digest="primaryPlan.plan_sha256"
                :operations="
                  primaryPlan.changes.map((summary) => ({
                    resource: primaryPlan!.target_domain,
                    summary,
                    risk: 'high',
                    reversible: true,
                  }))
                "
              >
                <p class="tw:text-sm tw:text-muted-foreground">
                  Applications keep their current addresses. You may need to
                  sign in and reconnect your signer at
                  <code class="tw:font-mono tw:text-xs">{{
                    primaryPlan.new_admin_url
                  }}</code
                  >.
                </p>
                <div class="tw:flex tw:justify-end tw:gap-2">
                  <Button variant="ghost" @click="primaryPlan = null"
                    >Cancel</Button
                  >
                  <Button :disabled="busy !== ''" @click="applyServerAddress"
                    >Change server address</Button
                  >
                </div>
              </ChangeLedger>
            </template>
          </div>
        </section>
      </div>
      <details class="tw:border-t tw:border-border-subtle tw:py-5">
        <summary
          class="tw:cursor-pointer tw:text-sm tw:font-semibold tw:text-foreground tw:marker:text-signature"
        >
          Advanced domain tools
          <span class="tw:ml-2 tw:font-normal tw:text-muted-foreground"
            >Free hostnames, credentials, and public IP state</span
          >
        </summary>
        <div class="tw:mt-3">
          <section class="tw:border-t tw:border-border-subtle tw:py-5">
            <header class="tw:mb-4">
              <h2 class="tw:flex tw:items-center tw:justify-between tw:gap-2">
                <span>Free hostname claims</span>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="showClaimForm = !showClaimForm"
                  >{{ showClaimForm ? 'Cancel' : 'Claim hostname' }}</Button
                >
              </h2>
            </header>
            <div class="tw:grid tw:gap-3">
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Free hostnames under nohost.me, noho.st and ynh.fr, claimed and
                signed with this server's Nostr identity.
              </p>
              <div
                v-if="showClaimForm"
                class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
              >
                <div class="tw:grid tw:gap-1.5">
                  <Label for="claim-hostname"
                    >Hostname (e.g. myserver.nohost.me)</Label
                  >
                  <Input
                    id="claim-hostname"
                    v-model="claimHostname"
                    autocomplete="off"
                    spellcheck="false"
                  />
                </div>
                <div class="tw:flex tw:justify-end">
                  <Button
                    size="sm"
                    :disabled="busy !== ''"
                    @click="submitClaim"
                    >{{ busy === 'claim' ? 'Claiming…' : 'Claim' }}</Button
                  >
                </div>
              </div>

              <EmptyState
                v-if="subscriptions.length === 0"
                title="No free-hostname claims yet"
              />
              <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
                <li
                  v-for="sub in subscriptions"
                  :key="sub.hostname"
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
                >
                  <code class="tw:font-mono">{{ sub.hostname }}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="requestUnsubscribe(sub.hostname)"
                    >{{
                      busy === `unsubscribe-${sub.hostname}`
                        ? 'Releasing…'
                        : 'Release'
                    }}</Button
                  >
                </li>
              </ul>
            </div>
          </section>

          <section class="tw:border-t tw:border-border-subtle tw:py-5">
            <header class="tw:mb-4">
              <h2 class="tw:flex tw:items-center tw:justify-between tw:gap-2">
                <span>DNS provider credentials</span>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="showCredentialForm = !showCredentialForm"
                  >{{
                    showCredentialForm ? 'Cancel' : 'Add credential'
                  }}</Button
                >
              </h2>
            </header>
            <div class="tw:grid tw:gap-3">
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Provider API tokens for automated DNS providers. Values are
                write-only — they are never shown again after saving.
              </p>
              <div
                v-if="showCredentialForm"
                class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
              >
                <div class="tw:grid tw:gap-4 tw:sm:grid-cols-3">
                  <div class="tw:grid tw:gap-1.5">
                    <Label for="credential-provider">Provider</Label>
                    <Select
                      id="credential-provider"
                      v-model="credentialProvider"
                    >
                      <option
                        v-for="type in DNS_PROVIDER_TYPES.filter(
                          (t) => t !== 'manual',
                        )"
                        :key="type"
                        :value="type"
                      >
                        {{ type }}
                      </option>
                    </Select>
                  </div>
                  <div class="tw:grid tw:gap-1.5">
                    <Label for="credential-name">Name</Label>
                    <Input
                      id="credential-name"
                      v-model="credentialName"
                      placeholder="primary"
                      autocomplete="off"
                    />
                  </div>
                  <div class="tw:grid tw:gap-1.5">
                    <Label for="credential-value">Token value</Label>
                    <Input
                      id="credential-value"
                      v-model="credentialValue"
                      type="password"
                      autocomplete="off"
                    />
                  </div>
                </div>
                <div class="tw:flex tw:justify-end">
                  <Button
                    size="sm"
                    :disabled="busy !== ''"
                    @click="submitCredential"
                    >{{
                      busy === 'credential-set' ? 'Saving…' : 'Save credential'
                    }}</Button
                  >
                </div>
              </div>

              <EmptyState
                v-if="credentials.length === 0"
                title="No DNS credentials configured"
              />
              <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
                <li
                  v-for="cred in credentials"
                  :key="cred.ref"
                  class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
                >
                  <code class="tw:font-mono">{{ cred.ref }}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="requestRemoveCredential(cred.ref)"
                    >{{
                      busy === `credential-remove-${cred.ref}`
                        ? 'Removing…'
                        : 'Remove'
                    }}</Button
                  >
                </li>
              </ul>
            </div>
          </section>

          <section class="tw:border-t tw:border-border-subtle tw:py-5">
            <header class="tw:mb-4">
              <h2 class="tw:text-base tw:font-semibold">Network</h2>
            </header>
            <div class="tw:grid tw:gap-1 tw:text-sm">
              <p class="tw:m-0">
                Public IPv4:
                <code class="tw:font-mono">{{
                  publicIp?.ipv4 ?? 'unknown'
                }}</code>
              </p>
              <p class="tw:m-0">
                Public IPv6:
                <code class="tw:font-mono">{{
                  publicIp?.ipv6 ?? 'unknown'
                }}</code>
              </p>
              <p
                v-if="dnsWatch && dnsWatch.dynamic_domains.length"
                class="tw:m-0 tw:text-xs tw:text-muted-foreground"
              >
                DDNS watcher tracks
                {{ dnsWatch.dynamic_domains.length }} dynamic-IP domain(s):
                {{ dnsWatch.dynamic_domains.join(', ') }}
              </p>
            </div>
          </section>
        </div>
      </details>
    </template>

    <ConfirmDialog
      :open="confirmingAdd"
      tier="soft"
      title="Register this domain?"
      :description="`Registering ${addDomainName.trim()} applies DNS and stands up routes.`"
      confirm-label="Register"
      :busy="busy === 'add'"
      @confirm="confirmAdd"
      @cancel="confirmingAdd = false"
    />
    <ConfirmDialog
      :open="confirmingRemove !== null"
      tier="destructive"
      title="Remove this domain?"
      description="Every app and permission referencing this domain breaks. This cannot be undone from here."
      confirm-label="Remove"
      :confirm-phrase="confirmingRemove ?? undefined"
      :busy="busy === `remove-${confirmingRemove}`"
      @confirm="confirmRemove(confirmingRemove!)"
      @cancel="confirmingRemove = null"
    />
    <ConfirmDialog
      :open="confirmingApply !== null"
      tier="disruptive"
      title="Apply the DNS plan?"
      description="This updates DNS records at the provider to match the pending plan."
      confirm-label="Apply"
      :busy="busy === `apply-${confirmingApply}`"
      @confirm="confirmApplyDns(confirmingApply!)"
      @cancel="confirmingApply = null"
    />
    <ConfirmDialog
      :open="confirmingUnsubscribe !== null"
      tier="disruptive"
      title="Release this hostname?"
      description="The free-hostname claim is released and stops resolving to this server."
      confirm-label="Release"
      :busy="busy === `unsubscribe-${confirmingUnsubscribe}`"
      @confirm="confirmUnsubscribe(confirmingUnsubscribe!)"
      @cancel="confirmingUnsubscribe = null"
    />
    <ConfirmDialog
      :open="confirmingRemoveCredential !== null"
      tier="disruptive"
      title="Remove this credential?"
      description="Any domain relying on it for automated DNS provisioning will need a replacement."
      confirm-label="Remove"
      :busy="busy === `credential-remove-${confirmingRemoveCredential}`"
      @confirm="confirmRemoveCredential(confirmingRemoveCredential!)"
      @cancel="confirmingRemoveCredential = null"
    />
  </PageLayout>
</template>
