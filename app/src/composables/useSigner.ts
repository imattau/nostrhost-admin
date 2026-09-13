import { computed, ref } from 'vue'

// Shared module-level state: every caller of `useSigner()` sees the same
// connected signer, so the app shell header and individual views agree on
// whether a NIP-07 signer is connected without prop-drilling.
const publicKey = ref<string | null>(null)
const busy = ref(false)
const error = ref('')

const signerAvailable = computed(() => Boolean(window.nostr))

async function connect() {
  busy.value = true
  error.value = ''
  try {
    const connectedKey = (await window.nostr?.getPublicKey()) ?? null
    if (!connectedKey)
      throw new Error('The signer did not return a public key.')
    publicKey.value = connectedKey
  } catch (cause) {
    publicKey.value = null
    error.value =
      cause instanceof Error ? cause.message : 'Could not connect the signer.'
  } finally {
    busy.value = false
  }
}

// Re-reads the signer's current key and fails loudly if it has changed
// since connect(), so callers never sign a request under the wrong identity.
async function sync() {
  const current = await window.nostr?.getPublicKey()
  if (!current) {
    publicKey.value = null
    throw new Error('The Nostr signer is no longer available.')
  }
  if (publicKey.value && current !== publicKey.value) {
    publicKey.value = current
    throw new Error(
      'The signer account changed. Review the account before continuing.',
    )
  }
  publicKey.value = current
}

export function useSigner() {
  return { publicKey, busy, error, signerAvailable, connect, sync }
}
