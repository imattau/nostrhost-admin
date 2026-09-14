// Phase 3a Blossom upload client (implementation plan §6, BUD-01/02/03).
//
// Uploads blob bytes straight from the browser to the user's Blossom servers
// (BUD-01 requires `Access-Control-Allow-Origin: *`, so the server never
// proxies uploads — no quota/temp-storage surface). One kind-24242 auth
// event covers a batch of up to 20 blobs via multiple `x` tags (decision
// record D6), signed with the NIP-07 extension. A 200 on `HEAD /<sha256>`
// skips an already-present blob; a failed PUT is retried once by hash.

import { sha256Hex } from './inventory'
import type { ManifestItem } from './manifest'

export const BUD_AUTH_KIND = 24242
export const BATCH_SIZE = 20
export const SKIP_HEAD_TIMEOUT_MS = 8000
export const PUT_TIMEOUT_MS = 120_000

export type BlossomResult = {
  server: string
  ok: boolean
  uploaded: string[] // hashes
  skipped: string[] // hashes already present
  failed: string[] // hashes that never uploaded
  errors: Record<string, string>
}

export class BlossomError extends Error {}

export function encodeAuthHeader(event: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(event))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function withTimeout(ms: number, signal?: AbortSignal): AbortController {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  const timer = setTimeout(() => controller.abort(), ms)
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onAbort)
  }
  controller.signal.addEventListener('abort', () => clearTimeout(timer), {
    once: true,
  })
  return controller
}

async function headPresent(
  server: string,
  hash: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const controller = withTimeout(SKIP_HEAD_TIMEOUT_MS, signal)
  try {
    const response = await fetch(`${server}/${hash}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    controller.abort()
  }
}

async function putBlob(
  server: string,
  hash: string,
  bytes: Uint8Array,
  authEvent: object,
  signal?: AbortSignal,
): Promise<void> {
  const controller = withTimeout(PUT_TIMEOUT_MS, signal)
  try {
    const response = await fetch(`${server}/upload?sha256=${hash}`, {
      method: 'PUT',
      headers: {
        Authorization: `Nostr ${encodeAuthHeader(authEvent)}`,
        'Content-Type': 'application/octet-stream',
      },
      body: bytes,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')) || response.status
      throw new BlossomError(`PUT /upload failed (${detail})`)
    }
  } finally {
    controller.abort()
  }
}

export async function uploadToBlossom(
  server: string,
  items: ManifestItem[],
  blobBytes: (path: string) => Promise<Uint8Array | null>,
  options: {
    pubkey: string
    signEvent: (event: {
      pubkey: string
      created_at: number
      kind: number
      tags: string[][]
      content: string
    }) => Promise<{ id: string; sig: string }>
    onProgress?: (uploaded: number, total: number, path: string) => void
    signal?: AbortSignal
  },
): Promise<BlossomResult> {
  const serverBase = server.replace(/\/+$/, '')
  const result: BlossomResult = {
    server,
    ok: true,
    uploaded: [],
    skipped: [],
    failed: [],
    errors: {},
  }

  const toUpload = new Map<string, ManifestItem>()
  for (const item of items) {
    if (await headPresent(serverBase, item.sha256, options.signal)) {
      result.skipped.push(item.sha256)
      continue
    }
    toUpload.set(item.sha256, item)
  }

  const hashes = [...toUpload.keys()]
  for (let start = 0; start < hashes.length; start += BATCH_SIZE) {
    const batch = hashes.slice(start, start + BATCH_SIZE)
    if (options.signal?.aborted) break
    const authEvent = await options.signEvent({
      pubkey: options.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: BUD_AUTH_KIND,
      tags: batch.map((hash) => ['x', hash]),
      content: '',
    })
    for (const hash of batch) {
      if (options.signal?.aborted) break
      const item = toUpload.get(hash)!
      const bytes = await blobBytes(item.path)
      if (!bytes) {
        result.failed.push(hash)
        result.errors[hash] = 'cannot read local file'
        continue
      }
      let ok = false
      for (let attempt = 0; attempt < 2 && !ok; attempt++) {
        try {
          await putBlob(serverBase, hash, bytes, authEvent, options.signal)
          ok = true
        } catch (cause) {
          result.errors[hash] =
            cause instanceof Error ? cause.message : String(cause)
        }
      }
      if (ok) {
        result.uploaded.push(hash)
        options.onProgress?.(result.uploaded.length, hashes.length, item.path)
      } else {
        result.failed.push(hash)
      }
    }
  }

  if (result.failed.length) {
    result.ok = false
  } else if (!hashes.length) {
    // Nothing needed uploading on this server; still report success.
    result.ok = true
  }
  return result
}

export async function blobBytesOfFile(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

// Convenience: hash + upload one file's bytes, used by tests and the wizard.
export { sha256Hex }
