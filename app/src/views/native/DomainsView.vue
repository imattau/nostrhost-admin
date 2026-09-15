<script setup lang="ts">
import { computed, ref } from 'vue'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useNotifications } from '@/composables/useNotifications'
import { toErrorMessage } from '@/utils/errors'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success, danger } = useNotifications()

const domains = ref<string[]>([])
const selectedDomain = ref<string | null>(null)
const inspect = ref<DomainInspect | null>(null)
const credentials = ref<CredentialRef[]>([])
const subscriptions = ref<FreeHostnameSubscription[]>([])
const publicIp = ref<PublicIp | null>(null)
const dnsWatch = ref<DnsWatchStatus | null>(null)

const inspectLoading = ref(false)
const busy = ref('')

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
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
}, 'Failed to load domains.')

async function selectDomain(domain: string) {
  selectedDomain.value = domain
  inspect.value = null
  inspectLoading.value = true
  try {
    await sync()
    inspect.value = await getDomainInspect(domain)
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to inspect ${domain}.`))
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
  confirmingAdd.value = true
}

async function confirmAdd() {
  confirmingAdd.value = false
  busy.value = 'add'
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
    success(`Domain registration submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`)
    showAddForm.value = false
    resetAddForm()
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to register domain.'))
  } finally {
    busy.value = ''
  }
}

// -- remove / apply / verify -------------------------------------------------

const confirmingRemove = ref<string | null>(null)

function requestRemove(domain: string) {
  confirmingRemove.value = domain
}

async function confirmRemove(domain: string) {
  confirmingRemove.value = null
  busy.value = `remove-${domain}`
  try {
    await sync()
    const result = await removeDomain(domain)
    success(`Removal of ${domain} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`)
    if (selectedDomain.value === domain) {
      selectedDomain.value = null
      inspect.value = null
    }
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to remove ${domain}.`))
  } finally {
    busy.value = ''
  }
}

const confirmingApply = ref<string | null>(null)

function requestApplyDns(domain: string) {
  confirmingApply.value = domain
}

async function confirmApplyDns(domain: string) {
  confirmingApply.value = null
  busy.value = `apply-${domain}`
  try {
    await sync()
    const result = await applyDns(domain)
    success(`DNS apply for ${domain} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`)
    if (selectedDomain.value === domain) await selectDomain(domain)
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to apply DNS for ${domain}.`))
  } finally {
    busy.value = ''
  }
}

async function runVerify(domain: string) {
  busy.value = `verify-${domain}`
  try {
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
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to verify ${domain}.`))
  } finally {
    busy.value = ''
  }
}

// -- free hostname subscriptions ---------------------------------------------

const showClaimForm = ref(false)
const claimHostname = ref('')

async function submitClaim() {
  if (!claimHostname.value.trim()) {
    danger('Enter a hostname label.')
    return
  }
  busy.value = 'claim'
  try {
    await sync()
    const result = await subscribeFreeHostname(claimHostname.value.trim())
    success(`Free-hostname claim submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`)
    claimHostname.value = ''
    showClaimForm.value = false
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to claim hostname.'))
  } finally {
    busy.value = ''
  }
}

const confirmingUnsubscribe = ref<string | null>(null)

function requestUnsubscribe(hostname: string) {
  confirmingUnsubscribe.value = hostname
}

async function confirmUnsubscribe(hostname: string) {
  confirmingUnsubscribe.value = null
  busy.value = `unsubscribe-${hostname}`
  try {
    await sync()
    const result = await unsubscribeFreeHostname(hostname)
    success(`Released ${hostname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`)
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to release ${hostname}.`))
  } finally {
    busy.value = ''
  }
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
  busy.value = 'credential-set'
  try {
    await sync()
    await setCredential(
      credentialProvider.value,
      credentialName.value.trim(),
      credentialValue.value.trim(),
    )
    success(`Stored credential ${credentialProvider.value}/${credentialName.value.trim()}.`)
    credentialName.value = ''
    credentialValue.value = ''
    showCredentialForm.value = false
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Failed to store credential.'))
  } finally {
    busy.value = ''
  }
}

const confirmingRemoveCredential = ref<string | null>(null)

function requestRemoveCredential(ref: string) {
  confirmingRemoveCredential.value = ref
}

async function confirmRemoveCredential(ref: string) {
  confirmingRemoveCredential.value = null
  const { provider, name } = parseCredentialRef(ref)
  busy.value = `credential-remove-${ref}`
  try {
    await sync()
    await removeCredential(provider, name)
    success(`Removed credential ${provider}/${name}.`)
    await load()
  } catch (cause) {
    danger(toErrorMessage(cause, `Failed to remove ${ref}.`))
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
        </CardContent>
      </Card>

      <Card v-if="selectedDomain">
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
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
              <Button
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
            <div class="tw:flex tw:justify-end">
              <Button size="sm" :disabled="busy !== ''" @click="submitClaim">{{
                busy === 'claim' ? 'Claiming…' : 'Claim'
              }}</Button>
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
