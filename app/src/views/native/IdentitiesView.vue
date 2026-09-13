<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import {
  linkIdentity,
  revokeIdentity,
  type SignerType,
} from '@/api/nativeIdentity'
import { getIdentities, type Identity } from '@/api/nativeSystem'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const identities = ref<Identity[] | null>(null)
const error = ref('')
const loading = ref(false)

const username = ref('')
const pubkeyOrNpub = ref('')
const signerType = ref<SignerType>('nip07')
const label = ref('')
const linking = ref(false)
const linkError = ref('')

const revokePending = ref<string | null>(null)
const revoking = ref(false)
const revokeError = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    identities.value = await getIdentities()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load identities.'
  } finally {
    loading.value = false
  }
}

async function submitLink() {
  linking.value = true
  linkError.value = ''
  try {
    await sync()
    await linkIdentity({
      username: username.value.trim(),
      pubkeyOrNpub: pubkeyOrNpub.value.trim(),
      signerType: signerType.value,
      label: label.value.trim(),
    })
    username.value = ''
    pubkeyOrNpub.value = ''
    label.value = ''
    signerType.value = 'nip07'
    await load()
  } catch (cause) {
    linkError.value =
      cause instanceof Error ? cause.message : 'Failed to link identity.'
  } finally {
    linking.value = false
  }
}

function askRevoke(pubkey: string) {
  revokeError.value = ''
  revokePending.value = pubkey
}

function cancelRevoke() {
  revokePending.value = null
}

async function confirmRevoke(pubkey: string) {
  revoking.value = true
  revokeError.value = ''
  try {
    await sync()
    await revokeIdentity(pubkey)
    revokePending.value = null
    await load()
  } catch (cause) {
    revokeError.value =
      cause instanceof Error ? cause.message : 'Failed to revoke identity.'
  } finally {
    revoking.value = false
  }
}

function shortenKey(key: string) {
  return `${key.slice(0, 12)}…${key.slice(-8)}`
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        Nostr identity administration
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Identities
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Link a signer's public key to a YunoHost admin account, or revoke a
        linked identity. Linking and revoking publish signed events to the
        control relay; there is no password store.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      A NIP-07 browser signer is required. Enable a signer extension, then
      reload this page.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Connect your signer above to manage identities.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Link an identity</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="tw:grid tw:gap-4" @submit.prevent="submitLink">
          <div class="tw:grid tw:gap-1.5">
            <Label for="link-username">YunoHost username</Label>
            <Input
              id="link-username"
              v-model="username"
              required
              autocomplete="off"
            />
          </div>
          <div class="tw:grid tw:gap-1.5">
            <Label for="link-pubkey">Public key or npub</Label>
            <Input
              id="link-pubkey"
              v-model="pubkeyOrNpub"
              required
              spellcheck="false"
              autocomplete="off"
              placeholder="npub1… or 64-char hex"
            />
          </div>
          <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="link-signer-type">Signer type</Label>
              <Select id="link-signer-type" v-model="signerType">
                <option value="nip07">nip07</option>
                <option value="nip46">nip46</option>
                <option value="passkey">passkey</option>
                <option value="unknown">unknown</option>
              </Select>
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="link-label">Label (optional)</Label>
              <Input id="link-label" v-model="label" autocomplete="off" />
            </div>
          </div>
          <Alert v-if="linkError" variant="danger" role="alert">{{
            linkError
          }}</Alert>
          <div>
            <Button type="submit" variant="primary" :disabled="linking">{{
              linking ? 'Linking…' : 'Link identity'
            }}</Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Linked identities</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="load"
            >{{ loading ? 'Refreshing…' : 'Refresh' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert v-if="revokeError" variant="danger" role="alert">{{
          revokeError
        }}</Alert>
        <ul v-if="identities && identities.length" class="tw:grid tw:gap-2">
          <li
            v-for="identity in identities"
            :key="identity.pubkey"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <strong class="tw:text-sm tw:text-foreground">{{
                identity.username
              }}</strong>
              <Badge :variant="identity.enabled ? 'success' : 'neutral'">
                {{ identity.enabled ? 'Enabled' : 'Disabled' }}
              </Badge>
            </div>
            <code class="tw:font-mono tw:text-xs tw:text-muted-foreground">{{
              shortenKey(identity.pubkey)
            }}</code>
            <span class="tw:text-xs tw:text-muted-foreground"
              >{{ identity.signer_type
              }}<template v-if="identity.label">
                · {{ identity.label }}</template
              ></span
            >
            <div class="tw:flex tw:justify-end tw:gap-2">
              <template v-if="revokePending === identity.pubkey">
                <span class="tw:text-xs tw:text-muted-foreground tw:self-center"
                  >Revoke this identity?</span
                >
                <Button variant="outline" size="sm" @click="cancelRevoke"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="revoking"
                  @click="confirmRevoke(identity.pubkey)"
                  >{{ revoking ? 'Revoking…' : 'Confirm revoke' }}</Button
                >
              </template>
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="!identity.enabled"
                @click="askRevoke(identity.pubkey)"
                >Revoke</Button
              >
            </div>
          </li>
        </ul>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Loading…' : 'No linked identities yet.' }}
        </p>
      </CardContent>
    </Card>
  </section>
</template>
