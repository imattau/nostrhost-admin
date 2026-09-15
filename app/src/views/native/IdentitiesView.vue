<script setup lang="ts">
import { ref } from 'vue'

import {
  linkIdentity,
  revokeIdentity,
  type SignerType,
} from '@/api/nativeIdentity'
import { getIdentities, type Identity } from '@/api/nativeSystem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useActionRunner } from '@/composables/useActionRunner'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useNotifications } from '@/composables/useNotifications'
import { shortenKey } from '@/lib/utils'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success } = useNotifications()

const identities = ref<Identity[] | null>(null)

const username = ref('')
const pubkeyOrNpub = ref('')
const signerType = ref<SignerType>('nip07')
const label = ref('')
const linking = ref(false)
const { run: runLink } = useActionRunner(linking, false)

const revokePending = ref<string | null>(null)
const revoking = ref(false)
const { run: runRevoke } = useActionRunner(revoking, false)

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  identities.value = await getIdentities()
}, 'Failed to load identities.')

async function submitLink() {
  await runLink(
    true,
    async () => {
      await sync()
      await linkIdentity({
        username: username.value.trim(),
        pubkeyOrNpub: pubkeyOrNpub.value.trim(),
        signerType: signerType.value,
        label: label.value.trim(),
      })
      success(`Linked an identity to ${username.value.trim()}.`)
      username.value = ''
      pubkeyOrNpub.value = ''
      label.value = ''
      signerType.value = 'nip07'
      await load()
    },
    'Failed to link identity.',
  )
}

function askRevoke(pubkey: string) {
  revokePending.value = pubkey
}

function cancelRevoke() {
  revokePending.value = null
}

async function confirmRevoke(pubkey: string) {
  await runRevoke(
    true,
    async () => {
      await sync()
      await revokeIdentity(pubkey)
      revokePending.value = null
      success('Revoked the identity.')
      await load()
    },
    'Failed to revoke identity.',
  )
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Nostr identity administration"
      title="Identities"
      description="Link a signer's public key to a YunoHost admin account, or revoke a linked identity. Linking and revoking publish signed events to the control relay; there is no password store."
    />

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
                <option value="generated">generated</option>
                <option value="unknown">unknown</option>
              </Select>
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="link-label">Label (optional)</Label>
              <Input id="link-label" v-model="label" autocomplete="off" />
            </div>
          </div>
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
              <Button
                variant="outline"
                size="sm"
                :disabled="!identity.enabled"
                @click="askRevoke(identity.pubkey)"
                >Revoke</Button
              >
            </div>
          </li>
        </ul>
        <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
          Loading…
        </p>
        <EmptyState v-else title="No linked identities yet" />
      </CardContent>
    </Card>

    <ConfirmDialog
      :open="revokePending !== null"
      tier="disruptive"
      title="Revoke this identity?"
      description="The linked pubkey loses access to this account. It can be re-linked later."
      confirm-label="Revoke"
      :busy="revoking"
      @confirm="confirmRevoke(revokePending!)"
      @cancel="cancelRevoke"
    />
  </PageLayout>
</template>
