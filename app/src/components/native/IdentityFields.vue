<script setup lang="ts">
import { ref, watch } from 'vue'
import { npubEncode, nsecEncode } from 'nostr-tools/nip19'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'

import type { SignerType } from '@/api/nativeIdentity'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

import { type IdentityMode, type IdentitySelection } from './identitySelection'

// idPrefix keeps element ids unique when this form is rendered more than
// once on a page (the create-user form and each per-user "Link identity"
// row). allowNone hides the "No Nostr identity" toggle for call sites
// where opening this form already implies the operator wants to add one
// (e.g. linking an identity to an existing user) and a plain Cancel button
// covers backing out.
const props = withDefaults(
  defineProps<{ idPrefix: string; allowNone?: boolean }>(),
  { allowNone: true },
)

const model = defineModel<IdentitySelection>({ required: true })

const generatedNpub = ref('')
const generatedNsec = ref('')
const acknowledged = ref(false)
const copied = ref<'npub' | 'nsec' | null>(null)

// The generated key only lives in this component's local state — it is
// never written into `model` (which the parent may log, submit, or hold
// onto) except as the plain pubkey once the operator confirms they saved
// it. Leaving generate mode for any reason (mode switch, or the parent
// resetting the whole selection after a successful submit) drops it.
watch(
  () => model.value.mode,
  (mode) => {
    if (mode !== 'generate') {
      generatedNpub.value = ''
      generatedNsec.value = ''
      acknowledged.value = false
      copied.value = null
    }
  },
)

function patch(partial: Partial<IdentitySelection>) {
  model.value = { ...model.value, ...partial }
}

function setMode(mode: IdentityMode) {
  if (mode === model.value.mode) return
  patch({
    mode,
    pubkeyOrNpub: mode === 'existing' ? model.value.pubkeyOrNpub : '',
    signerType: mode === 'generate' ? 'generated' : 'nip07',
    ready: mode === 'none',
  })
}

function onPubkeyInput(value: string) {
  patch({ pubkeyOrNpub: value, ready: value.trim().length > 0 })
}

function generate() {
  const secretKey = generateSecretKey()
  const pubkeyHex = getPublicKey(secretKey)
  generatedNpub.value = npubEncode(pubkeyHex)
  generatedNsec.value = nsecEncode(secretKey)
  secretKey.fill(0)
  acknowledged.value = false
  patch({ pubkeyOrNpub: pubkeyHex, signerType: 'generated', ready: false })
}

function onAcknowledge(value: boolean) {
  acknowledged.value = value
  patch({ ready: value && generatedNpub.value.length > 0 })
}

async function copy(which: 'npub' | 'nsec') {
  const text = which === 'npub' ? generatedNpub.value : generatedNsec.value
  try {
    await navigator.clipboard.writeText(text)
    copied.value = which
    setTimeout(() => {
      if (copied.value === which) copied.value = null
    }, 2000)
  } catch {
    // Clipboard API unavailable or blocked (e.g. insecure context) — the
    // field itself is still readable and selectable by hand.
  }
}

function selectAll(event: FocusEvent) {
  ;(event.target as HTMLInputElement).select()
}
</script>

<template>
  <div class="tw:grid tw:gap-3">
    <div class="tw:flex tw:flex-wrap tw:gap-2">
      <Button
        v-if="props.allowNone"
        type="button"
        size="sm"
        :variant="model.mode === 'none' ? 'secondary' : 'outline'"
        :aria-pressed="model.mode === 'none'"
        @click="setMode('none')"
        >No Nostr identity</Button
      >
      <Button
        type="button"
        size="sm"
        :variant="model.mode === 'existing' ? 'secondary' : 'outline'"
        :aria-pressed="model.mode === 'existing'"
        @click="setMode('existing')"
        >Link existing pubkey</Button
      >
      <Button
        type="button"
        size="sm"
        :variant="model.mode === 'generate' ? 'secondary' : 'outline'"
        :aria-pressed="model.mode === 'generate'"
        @click="setMode('generate')"
        >Generate a new keypair</Button
      >
    </div>

    <template v-if="model.mode === 'existing'">
      <div class="tw:grid tw:gap-1.5">
        <Label :for="`${props.idPrefix}-pubkey`">Public key or npub</Label>
        <Input
          :id="`${props.idPrefix}-pubkey`"
          :model-value="model.pubkeyOrNpub"
          spellcheck="false"
          autocomplete="off"
          placeholder="npub1… or 64-char hex"
          @update:model-value="onPubkeyInput($event as string)"
        />
      </div>
      <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
        <div class="tw:grid tw:gap-1.5">
          <Label :for="`${props.idPrefix}-signer-type`">Signer type</Label>
          <Select
            :id="`${props.idPrefix}-signer-type`"
            :model-value="model.signerType"
            @update:model-value="patch({ signerType: $event as SignerType })"
          >
            <option value="nip07">nip07</option>
            <option value="nip46">nip46</option>
            <option value="passkey">passkey</option>
            <option value="unknown">unknown</option>
          </Select>
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label :for="`${props.idPrefix}-label`">Label (optional)</Label>
          <Input
            :id="`${props.idPrefix}-label`"
            :model-value="model.label"
            autocomplete="off"
            @update:model-value="patch({ label: $event as string })"
          />
        </div>
      </div>
    </template>

    <template v-else-if="model.mode === 'generate'">
      <div
        v-if="!generatedNpub"
        class="tw:flex tw:flex-col tw:gap-3 tw:rounded-lg tw:bg-surface-muted tw:p-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between"
      >
        <p class="tw:m-0 tw:max-w-md tw:text-xs tw:text-muted-foreground">
          Generates a new Nostr keypair in your browser. The private key is
          shown once, is never sent to the server, and cannot be recovered if
          lost.
        </p>
        <Button type="button" size="sm" class="tw:shrink-0" @click="generate"
          >Generate keypair</Button
        >
      </div>
      <div v-else class="tw:grid tw:gap-3">
        <Alert variant="warning">
          Save the private key now. NostrHost does not store it and cannot show
          it again.
        </Alert>
        <div class="tw:grid tw:gap-1.5">
          <Label :for="`${props.idPrefix}-npub`">Public key (npub)</Label>
          <div class="tw:flex tw:gap-2">
            <Input
              :id="`${props.idPrefix}-npub`"
              :model-value="generatedNpub"
              readonly
              class="tw:font-mono tw:text-xs"
              @focus="selectAll"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="tw:shrink-0"
              @click="copy('npub')"
              >{{ copied === 'npub' ? 'Copied' : 'Copy' }}</Button
            >
          </div>
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label :for="`${props.idPrefix}-nsec`">Private key (nsec)</Label>
          <div class="tw:flex tw:gap-2">
            <Input
              :id="`${props.idPrefix}-nsec`"
              :model-value="generatedNsec"
              readonly
              class="tw:font-mono tw:text-xs"
              @focus="selectAll"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              class="tw:shrink-0"
              @click="copy('nsec')"
              >{{ copied === 'nsec' ? 'Copied' : 'Copy' }}</Button
            >
          </div>
        </div>
        <div class="tw:grid tw:gap-1.5">
          <Label :for="`${props.idPrefix}-label`">Label (optional)</Label>
          <Input
            :id="`${props.idPrefix}-label`"
            :model-value="model.label"
            autocomplete="off"
            @update:model-value="patch({ label: $event as string })"
          />
        </div>
        <label
          class="tw:flex tw:items-start tw:gap-2 tw:text-xs tw:text-muted-foreground"
        >
          <input
            type="checkbox"
            class="tw:mt-0.5"
            :checked="acknowledged"
            @change="onAcknowledge(($event.target as HTMLInputElement).checked)"
          />
          I have securely saved this private key.
        </label>
        <div>
          <Button type="button" variant="outline" size="sm" @click="generate"
            >Regenerate</Button
          >
        </div>
      </div>
    </template>
  </div>
</template>
