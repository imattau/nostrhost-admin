<script setup lang="ts">
import { computed, onMounted, ref, watch as watchRef } from 'vue'

import {
  DNS_PROVIDER_TYPES,
  addDomain,
  applyDns,
  getCredentials,
  getDnsWatch,
  getDomainInspect,
  getDomains,
  getFreeHostnameSubscriptions,
  getPublicIp,
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
} from '@/api/nativeDomains'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()

const domains = ref<string[]>([])
const selectedDomain = ref<string | null>(null)
const inspect = ref<DomainInspect | null>(null)
const credentials = ref<CredentialRef[]>([])
const subscriptions = ref<FreeHostnameSubscription[]>([])
const publicIp = ref<PublicIp | null>(null)
const dnsWatch = ref<DnsWatchStatus | null>(null)

const loading = ref(false)
const inspectLoading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [
      domainResult,
      credentialResult,
      subscriptionResult,
      ipResult,
      watchResult,
    ] = await Promise.all([
      getDomains(),
      getCredentials(),
      getFreeHostnameSubscriptions(),
      getPublicIp(),
      getDnsWatch(),
    ])
    domains.value = domainResult.domains
    credentials.value = credentialResult.credentials
    subscriptions.value = subscriptionResult.subscriptions
    publicIp.value = ipResult
    dnsWatch.value = watchResult
    if (selectedDomain.value && !domains.value.includes(selectedDomain.value)) {
      selectedDomain.value = null
      inspect.value = null
    }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load domains.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watchRef(publicKey, (key) => {
  if (key) load()
})

async function selectDomain(domain: string) {
  selectedDomain.value = domain
  inspect.value = null
  inspectLoading.value = true
  error.value = ''
  try {
    await sync()
    inspect.value = await getDomainInspect(domain)
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to inspect ${domain}.`
  } finally {
    inspectLoading.value = false
  }
}

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
const confirmingAdd = ref(false)
const addError = ref('')

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
  addError.value = ''
}

function requestAdd() {
  if (!addDomainName.value.trim()) {
    addError.value = 'Enter a domain name.'
    return
  }
  addError.value = ''
  confirmingAdd.value = true
}

async function confirmAdd() {
  confirmingAdd.value = false
  busy.value = 'add'
  addError.value = ''
  notice.value = ''
  try {
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
    notice.value = `Domain registration submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    showAddForm.value = false
    resetAddForm()
    await load()
  } catch (cause) {
    addError.value =
      cause instanceof Error ? cause.message : 'Failed to register domain.'
  } finally {
    busy.value = ''
  }
}

// -- remove / apply / verify -------------------------------------------------

const confirmingRemove = ref<string | null>(null)

function requestRemove(domain: string) {
  notice.value = ''
  error.value = ''
  confirmingRemove.value = domain
}

async function confirmRemove(domain: string) {
  confirmingRemove.value = null
  busy.value = `remove-${domain}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await removeDomain(domain)
    notice.value = `Removal of ${domain} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    if (selectedDomain.value === domain) {
      selectedDomain.value = null
      inspect.value = null
    }
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to remove ${domain}.`
  } finally {
    busy.value = ''
  }
}

const confirmingApply = ref<string | null>(null)

function requestApplyDns(domain: string) {
  notice.value = ''
  error.value = ''
  confirmingApply.value = domain
}

async function confirmApplyDns(domain: string) {
  confirmingApply.value = null
  busy.value = `apply-${domain}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await applyDns(domain)
    notice.value = `DNS apply for ${domain} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    if (selectedDomain.value === domain) await selectDomain(domain)
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to apply DNS for ${domain}.`
  } finally {
    busy.value = ''
  }
}

async function runVerify(domain: string) {
  busy.value = `verify-${domain}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await verifyDns(domain)
    const failing = result.verify.filter(
      (row) =>
        typeof row === 'object' &&
        row !== null &&
        (row as { ok?: boolean }).ok === false,
    ).length
    notice.value =
      failing === 0
        ? `${domain}: all DNS records verified.`
        : `${domain}: ${failing} record(s) did not verify.`
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to verify ${domain}.`
  } finally {
    busy.value = ''
  }
}

// -- free hostname subscriptions ---------------------------------------------

const showClaimForm = ref(false)
const claimHostname = ref('')
const claimError = ref('')

async function submitClaim() {
  if (!claimHostname.value.trim()) {
    claimError.value = 'Enter a hostname label.'
    return
  }
  claimError.value = ''
  busy.value = 'claim'
  notice.value = ''
  try {
    await sync()
    const result = await subscribeFreeHostname(claimHostname.value.trim())
    notice.value = `Free-hostname claim submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    claimHostname.value = ''
    showClaimForm.value = false
    await load()
  } catch (cause) {
    claimError.value =
      cause instanceof Error ? cause.message : 'Failed to claim hostname.'
  } finally {
    busy.value = ''
  }
}

const confirmingUnsubscribe = ref<string | null>(null)

function requestUnsubscribe(hostname: string) {
  notice.value = ''
  error.value = ''
  confirmingUnsubscribe.value = hostname
}

async function confirmUnsubscribe(hostname: string) {
  confirmingUnsubscribe.value = null
  busy.value = `unsubscribe-${hostname}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await unsubscribeFreeHostname(hostname)
    notice.value = `Released ${hostname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to release ${hostname}.`
  } finally {
    busy.value = ''
  }
}

// -- DNS provider credentials -------------------------------------------------

const showCredentialForm = ref(false)
const credentialProvider = ref<DnsProviderType>('cloudflare')
const credentialName = ref('')
const credentialValue = ref('')
const credentialError = ref('')

function parseCredentialRef(ref: string): { provider: string; name: string } {
  const match = ref.match(/^secret:dns\/([^/]+)\/(.+)$/)
  return match
    ? { provider: match[1], name: match[2] }
    : { provider: '', name: ref }
}

async function submitCredential() {
  if (!credentialName.value.trim() || !credentialValue.value.trim()) {
    credentialError.value = 'Enter a name and a token value.'
    return
  }
  credentialError.value = ''
  busy.value = 'credential-set'
  notice.value = ''
  try {
    await sync()
    await setCredential(
      credentialProvider.value,
      credentialName.value.trim(),
      credentialValue.value.trim(),
    )
    notice.value = `Stored credential ${credentialProvider.value}/${credentialName.value.trim()}.`
    credentialName.value = ''
    credentialValue.value = ''
    showCredentialForm.value = false
    await load()
  } catch (cause) {
    credentialError.value =
      cause instanceof Error ? cause.message : 'Failed to store credential.'
  } finally {
    busy.value = ''
  }
}

const confirmingRemoveCredential = ref<string | null>(null)

function requestRemoveCredential(ref: string) {
  notice.value = ''
  error.value = ''
  confirmingRemoveCredential.value = ref
}

async function confirmRemoveCredential(ref: string) {
  confirmingRemoveCredential.value = null
  const { provider, name } = parseCredentialRef(ref)
  busy.value = `credential-remove-${ref}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    await removeCredential(provider, name)
    notice.value = `Removed credential ${provider}/${name}.`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to remove ${ref}.`
  } finally {
    busy.value = ''
  }
}

const driftBadge = computed(() => {
  const inSync = inspect.value?.drift.in_sync
  if (inSync === true) return { variant: 'success' as const, label: 'In sync' }
  if (inSync === false) return { variant: 'warning' as const, label: 'Drifted' }
  return { variant: 'neutral' as const, label: 'Unknown' }
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Network"
      title="Domains"
      description="Domains, DNS records and free-hostname claims. Registering, removing or applying DNS for a domain asks for confirmation first."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Registered domains</span>
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="showAddForm = !showAddForm"
              >{{ showAddForm ? 'Cancel' : 'Add domain' }}</Button
            >
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
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
                  placeholder="example.com"
                  spellcheck="false"
                  autocomplete="off"
                />
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
                <Label for="add-domain-credential"
                  >Credential ref (secret:dns/{{
                    addProviderType
                  }}/&lt;name&gt;)</Label
                >
                <Input
                  id="add-domain-credential"
                  v-model="addCredential"
                  :placeholder="`secret:dns/${addProviderType}/primary`"
                  autocomplete="off"
                />
              </div>
            </div>
            <div class="tw:flex tw:flex-wrap tw:gap-4 tw:text-sm">
              <label class="tw:flex tw:items-center tw:gap-2">
                <input
                  v-model="addPrimary"
                  type="checkbox"
                  class="tw:size-4 tw:accent-brand-500"
                />
                Primary domain
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
            <Alert v-if="addError" variant="danger">{{ addError }}</Alert>
            <div
              v-if="confirmingAdd"
              class="tw:flex tw:items-center tw:justify-end tw:gap-2"
            >
              <span class="tw:text-xs tw:text-muted-foreground"
                >Register {{ addDomainName.trim() }}? This applies DNS and
                stands up routes.</span
              >
              <Button variant="outline" size="sm" @click="confirmingAdd = false"
                >Cancel</Button
              >
              <Button
                variant="danger"
                size="sm"
                :disabled="busy !== ''"
                @click="confirmAdd"
                >Confirm</Button
              >
            </div>
            <div v-else class="tw:flex tw:justify-end">
              <Button size="sm" :disabled="busy !== ''" @click="requestAdd">{{
                busy === 'add' ? 'Registering…' : 'Register domain'
              }}</Button>
            </div>
          </div>

          <p
            v-if="!loading && domains.length === 0"
            class="tw:text-sm tw:text-muted-foreground"
          >
            No domains registered yet.
          </p>
          <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
            Loading…
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
            <li
              v-for="domain in domains"
              :key="domain"
              class="tw:rounded-lg tw:border tw:p-3"
              :class="
                selectedDomain === domain
                  ? 'tw:border-brand-500 tw:bg-brand-500/5'
                  : 'tw:border-border-subtle'
              "
            >
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <button
                  type="button"
                  class="tw:m-0 tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:font-mono tw:text-sm tw:text-foreground"
                  @click="selectDomain(domain)"
                >
                  {{ domain }}
                </button>
                <template v-if="confirmingRemove === domain">
                  <span class="tw:flex tw:items-center tw:gap-2">
                    <span class="tw:text-xs tw:text-muted-foreground"
                      >Remove?</span
                    >
                    <Button
                      variant="outline"
                      size="sm"
                      @click="confirmingRemove = null"
                      >Cancel</Button
                    >
                    <Button
                      variant="danger"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="confirmRemove(domain)"
                      >Confirm</Button
                    >
                  </span>
                </template>
                <Button
                  v-else
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
        </CardContent>
      </Card>

      <Card v-if="selectedDomain">
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span class="tw:font-mono">{{ selectedDomain }}</span>
            <Badge v-if="inspect" :variant="driftBadge.variant">{{
              driftBadge.label
            }}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
          <p v-if="inspectLoading" class="tw:text-sm tw:text-muted-foreground">
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
                  · <Badge variant="neutral">primary</Badge>
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
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-end tw:gap-2"
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
              <template v-if="confirmingApply === selectedDomain">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Apply DNS plan?</span
                >
                <Button
                  variant="outline"
                  size="sm"
                  @click="confirmingApply = null"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmApplyDns(selectedDomain)"
                  >Confirm</Button
                >
              </template>
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="busy !== ''"
                @click="requestApplyDns(selectedDomain)"
                >{{
                  busy === `apply-${selectedDomain}` ? 'Applying…' : 'Apply DNS'
                }}</Button
              >
            </div>
          </template>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Free hostname claims</span>
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="showClaimForm = !showClaimForm"
              >{{ showClaimForm ? 'Cancel' : 'Claim hostname' }}</Button
            >
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
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
            <Alert v-if="claimError" variant="danger">{{ claimError }}</Alert>
            <div class="tw:flex tw:justify-end">
              <Button size="sm" :disabled="busy !== ''" @click="submitClaim">{{
                busy === 'claim' ? 'Claiming…' : 'Claim'
              }}</Button>
            </div>
          </div>

          <p
            v-if="subscriptions.length === 0"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            No free-hostname claims yet.
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
            <li
              v-for="sub in subscriptions"
              :key="sub.hostname"
              class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
            >
              <code class="tw:font-mono">{{ sub.hostname }}</code>
              <template v-if="confirmingUnsubscribe === sub.hostname">
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >Release?</span
                  >
                  <Button
                    variant="outline"
                    size="sm"
                    @click="confirmingUnsubscribe = null"
                    >Cancel</Button
                  >
                  <Button
                    variant="danger"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="confirmUnsubscribe(sub.hostname)"
                    >Confirm</Button
                  >
                </span>
              </template>
              <Button
                v-else
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>DNS provider credentials</span>
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="showCredentialForm = !showCredentialForm"
              >{{ showCredentialForm ? 'Cancel' : 'Add credential' }}</Button
            >
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
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
                <Select id="credential-provider" v-model="credentialProvider">
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
            <Alert v-if="credentialError" variant="danger">{{
              credentialError
            }}</Alert>
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

          <p
            v-if="credentials.length === 0"
            class="tw:m-0 tw:text-sm tw:text-muted-foreground"
          >
            No DNS credentials configured.
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-1 tw:pl-0">
            <li
              v-for="cred in credentials"
              :key="cred.ref"
              class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3 tw:text-sm"
            >
              <code class="tw:font-mono">{{ cred.ref }}</code>
              <template v-if="confirmingRemoveCredential === cred.ref">
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span class="tw:text-xs tw:text-muted-foreground"
                    >Remove?</span
                  >
                  <Button
                    variant="outline"
                    size="sm"
                    @click="confirmingRemoveCredential = null"
                    >Cancel</Button
                  >
                  <Button
                    variant="danger"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="confirmRemoveCredential(cred.ref)"
                    >Confirm</Button
                  >
                </span>
              </template>
              <Button
                v-else
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Network</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-1 tw:text-sm">
          <p class="tw:m-0">
            Public IPv4:
            <code class="tw:font-mono">{{ publicIp?.ipv4 ?? 'unknown' }}</code>
          </p>
          <p class="tw:m-0">
            Public IPv6:
            <code class="tw:font-mono">{{ publicIp?.ipv6 ?? 'unknown' }}</code>
          </p>
          <p
            v-if="dnsWatch && dnsWatch.dynamic_domains.length"
            class="tw:m-0 tw:text-xs tw:text-muted-foreground"
          >
            DDNS watcher tracks {{ dnsWatch.dynamic_domains.length }} dynamic-IP
            domain(s): {{ dnsWatch.dynamic_domains.join(', ') }}
          </p>
        </CardContent>
      </Card>
    </template>
  </PageLayout>
</template>
