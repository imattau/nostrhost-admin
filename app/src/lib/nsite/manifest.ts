// Phase 3a client-side manifest builder (implementation plan §6, D7).
//
// Builds the unsigned NIP-5A manifest the wizard reviews (step 5) and the
// plan digest the user commits to by signing. Both must agree byte-for-byte
// with the fork's `nsites/service.py` (`aggregate_hash`, `plan_digest`) —
// the server recomputes the digest from the signed event and rejects a
// mismatch before any broadcast or record (stale-plan rejection).
//
// Canonical forms shared with the fork:
//   aggregate_hash(paths)   = sha256 of the sorted `<hash> <path>\n` lines
//   plan_digest             = sha256 of JSON([kind, d, sortedPaths, sortedServers])
//                             with compact separators (no whitespace).

import { sha256Hex, type InventoryItem } from './inventory'

export const KIND_ROOT = 15128
export const KIND_NAMED = 35128

export type ManifestItem = { path: string; sha256: string }

export type UnsignedManifest = {
  kind: number
  pubkey: string
  created_at: number
  tags: string[][]
  content: string
}

// Python's `sorted([(path, sha), ...])` compares tuples element-wise, which
// is NOT what Array.prototype.sort() does (it stringifies whole arrays). Use
// an explicit tuple comparator so the digest matches the fork exactly.
export function compareTuples(
  a: readonly (string | number)[],
  b: readonly (string | number)[],
): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const av = String(a[i])
    const bv = String(b[i])
    if (av < bv) return -1
    if (av > bv) return 1
  }
  return a.length - b.length
}

export async function aggregateHash(
  paths: ReadonlyArray<readonly [string, string]>,
): Promise<string> {
  const lines = paths.map(([path, hash]) => `${hash} ${path}\n`)
  lines.sort()
  return sha256Hex(new TextEncoder().encode(lines.join('')))
}

export function manifestItems(items: InventoryItem[]): ManifestItem[] {
  return items
    .map((item) => ({ path: item.path, sha256: item.sha256 }))
    .sort((a, b) => compareTuples([a.path, a.sha256], [b.path, b.sha256]))
}

export async function planDigest(params: {
  kind: number
  d: string
  paths: ManifestItem[]
  servers: string[]
}): Promise<string> {
  const sortedPaths = params.paths
    .map((p) => [p.path, p.sha256])
    .sort(compareTuples)
  const sortedServers = [...new Set(params.servers)].sort()
  const payload = JSON.stringify([
    params.kind,
    params.d,
    sortedPaths,
    sortedServers,
  ])
  return sha256Hex(new TextEncoder().encode(payload))
}

export async function buildUnsignedManifest(params: {
  pubkey: string
  kind: number
  d: string
  items: ManifestItem[]
  servers: string[]
}): Promise<{ event: UnsignedManifest; aggregate: string }> {
  const sortedPaths = [...params.items]
    .map((item) => [item.path, item.sha256] as const)
    .sort(compareTuples)
  const tags: string[][] = []
  if (params.kind === KIND_NAMED) {
    tags.push(['d', params.d])
  }
  for (const [path, hash] of sortedPaths) {
    tags.push(['path', path, hash])
  }
  for (const server of [...new Set(params.servers)].sort()) {
    tags.push(['server', server])
  }
  const aggregate = await aggregateHash(
    sortedPaths.map(([path, hash]) => [path, hash]),
  )
  tags.push(['x', aggregate, 'aggregate'])
  return {
    event: {
      kind: params.kind,
      pubkey: params.pubkey,
      created_at: 0,
      tags,
      content: '',
    },
    aggregate,
  }
}
