import { ref } from 'vue'

// A connected NIP-46 bunker/remote signer, so an admin can sign operation
// approvals/rejections (see OperationsView.vue) with their own remote
// signer instead of the server's local admin key. This is a separate
// connection from the portal's (nostr-account.vue): browser localStorage is
// per-origin, so the admin console and the portal each remember their own
// bunker sessions even when they share a login session cookie.
//
// Wraps the same vendored nostr-tools NIP-46 client the portal uses
// (public/nostr/nostr-connect-{vendor,ui}.js) rather than reimplementing the
// protocol here.

type NostrSigner = {
  signEvent(event: Record<string, unknown>): Promise<Record<string, unknown>>
  getPublicKey(): Promise<string>
  close?(): Promise<void>
}

type NostrConnectUIApi = {
  hasSaved(): boolean
  getSavedInfo(): { relays: string[]; remoteNpub: string } | null
  reconnectSaved(permissions?: string[]): Promise<NostrSigner | null>
  connectViaBunkerUri(
    value: string,
    label?: string,
    deferSave?: boolean,
    permissions?: string[],
  ): Promise<NostrSigner>
  clearSaved(): void
}

type NostrConnectVendorApi = {
  QRCode: {
    toDataURL(
      text: string,
      options?: { width?: number; margin?: number },
    ): Promise<string>
  }
}

declare global {
  interface Window {
    NostrConnectUI?: NostrConnectUIApi
    NostrConnectVendor?: NostrConnectVendorApi
  }
}

const publicAsset = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

const SCRIPTS = [
  publicAsset('nostr/nostr-connect-vendor.js'),
  publicAsset('nostr/nostr-connect-ui.js'),
]
const APPROVAL_PERMISSIONS = [
  'get_public_key',
  'sign_event:2201',
  'sign_event:2202',
]

let loadPromise: Promise<void> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      const ready = src.endsWith('nostr-connect-ui.js')
        ? Boolean(window.NostrConnectUI)
        : Boolean(
            (window as Window & { NostrConnectVendor?: unknown })
              .NostrConnectVendor,
          )
      if (ready) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener(
        'error',
        () => reject(new Error(`failed to load ${src}`)),
        { once: true },
      )
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`failed to load ${src}`))
    document.head.appendChild(script)
  })
}

async function ensureLoaded(): Promise<NostrConnectUIApi> {
  if (!loadPromise) {
    loadPromise = SCRIPTS.reduce(
      (chain, src) => chain.then(() => loadScript(src)),
      Promise.resolve(),
    )
  }
  await loadPromise
  if (!window.NostrConnectUI) {
    throw new Error('Remote signer support failed to load.')
  }
  return window.NostrConnectUI
}

// Render a `nostrconnect://` URI (e.g. the node-side pairing URI returned by
// the notify-signers API) as a QR data URL, using the same vendored QR code
// the portal's connect flow uses. Ensures the vendor bundle is loaded first.
export async function renderNostrConnectQr(uri: string): Promise<string> {
  await ensureLoaded()
  const vendor = window.NostrConnectVendor
  if (!vendor?.QRCode) {
    throw new Error('QR code support failed to load.')
  }
  return vendor.QRCode.toDataURL(uri, { width: 240, margin: 1 })
}

// Module-level so every view sees the same connection state.
const connected = ref(false)
const remoteNpub = ref<string | null>(null)
const relays = ref<string[]>([])
const busy = ref(false)
const error = ref('')

let signer: NostrSigner | null = null

function applySavedInfo(ui: NostrConnectUIApi) {
  const info = ui.getSavedInfo()
  connected.value = info !== null
  remoteNpub.value = info?.remoteNpub ?? null
  relays.value = info?.relays ?? []
}

async function tryReconnectSaved() {
  busy.value = true
  error.value = ''
  try {
    const ui = await ensureLoaded()
    if (!ui.hasSaved()) return
    signer = await ui.reconnectSaved(APPROVAL_PERMISSIONS)
    applySavedInfo(ui)
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'Could not reconnect the saved remote signer.'
    signer = null
    connected.value = false
  } finally {
    busy.value = false
  }
}

async function connectBunker(bunkerUriOrNip05: string) {
  busy.value = true
  error.value = ''
  try {
    const ui = await ensureLoaded()
    signer = await ui.connectViaBunkerUri(
      bunkerUriOrNip05,
      undefined,
      false,
      APPROVAL_PERMISSIONS,
    )
    applySavedInfo(ui)
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : 'Could not connect to that remote signer.'
    throw cause
  } finally {
    busy.value = false
  }
}

async function disconnectBunker() {
  try {
    await signer?.close?.()
  } catch {
    // best-effort - forgetting the saved session matters more than a clean close
  }
  signer = null
  const ui = window.NostrConnectUI
  ui?.clearSaved()
  connected.value = false
  remoteNpub.value = null
  relays.value = []
}

// Signs an unsigned approval/rejection template (from the
// GET .../approval-template or .../rejection-template routes) with the
// connected bunker and returns the fully signed event ready to POST back.
async function signTemplate(
  template: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!signer) {
    throw new Error('No remote signer is connected.')
  }
  const expectedPubkey = template.pubkey
  const signed = await signer.signEvent(template)
  if (typeof expectedPubkey === 'string' && signed.pubkey !== expectedPubkey) {
    throw new Error(
      'The remote signer key does not match the Nostr identity authenticated as this admin.',
    )
  }
  return signed
}

export function useBunkerSigner() {
  return {
    connected,
    remoteNpub,
    relays,
    busy,
    error,
    tryReconnectSaved,
    connectBunker,
    disconnectBunker,
    signTemplate,
  }
}
