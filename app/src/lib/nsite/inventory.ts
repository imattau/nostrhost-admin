// Phase 3a client-side publish inventory (implementation plan §6).
//
// Walks a `webkitdirectory` FileList, rejects symlink-like / path-traversal
// and oversize entries, hashes every blob with Web Crypto, and returns the
// sorted inventory the publish wizard shows (step 2) and the plan is built
// from. Nothing here touches the network.

export type InventoryItem = {
  path: string
  sha256: string
  size: number
}

export const DEFAULT_MAX_BLOB_BYTES = 32 * 1024 * 1024 // 32 MiB

export class InventoryError extends Error {}

function badPath(path: string): boolean {
  // Mirrors the validator's `_path_is_bad`: reject control chars, backslash,
  // and any `..` substring (which would let an upload escape its site dir).
  if (/[\u0000-\u001f\u007f]/.test(path)) return true
  if (path.includes('\\')) return true
  for (const segment of path.split('/')) {
    if (segment.includes('..')) return true
  }
  return false
}

function normalizePath(relative: string): string {
  const parts = relative.split('/').filter(Boolean)
  // `webkitdirectory` selections always share the selected folder as their
  // first segment; that folder is the site root, so the published NIP-5A
  // paths are relative to it (mysite/index.html -> /index.html).
  const rooted = parts.length > 1 ? parts.slice(1) : parts
  return '/' + rooted.join('/')
}

export async function sha256Hex(
  bytes: ArrayBuffer | Uint8Array,
): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

export async function inventoryFromFiles(
  files: File[],
  options: { maxBlobBytes?: number } = {},
): Promise<InventoryItem[]> {
  const maxBlobBytes = options.maxBlobBytes ?? DEFAULT_MAX_BLOB_BYTES
  const items: InventoryItem[] = []
  for (const file of files) {
    const relative = file.webkitRelativePath || file.name
    if (!relative) continue
    if (badPath(relative)) {
      throw new InventoryError(`rejected unsafe path: ${relative}`)
    }
    if (file.size > maxBlobBytes) {
      throw new InventoryError(
        `file exceeds the ${maxBlobBytes} byte limit: ${relative}`,
      )
    }
    const path = normalizePath(relative)
    if (file.size === 0) continue // NIP-5A has no empty-blob concept; skip
    const sha256 = await sha256Hex(await file.arrayBuffer())
    items.push({ path, sha256, size: file.size })
  }
  if (!items.length) {
    throw new InventoryError('no files selected')
  }
  items.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return items
}

export function aggregateSize(items: InventoryItem[]): number {
  return items.reduce((sum, item) => sum + item.size, 0)
}
