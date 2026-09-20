// Curated nsite collection (kind 30004) client-side builder.
//
// Builds the unsigned collection event the wizard reviews and the plan digest
// the curator commits to by signing. Both must agree byte-for-byte with the
// fork's `nsites/collections.py` (`collection_plan_digest`) — the server
// recomputes the digest from the signed event and rejects a mismatch before
// any broadcast (stale-plan rejection).
//
//   plan_digest = sha256 of JSON([pubkey, d, title, description, image,
//                                orderedEntryTags, sortedRelays])
//                 with compact separators (no whitespace). Entry order matters.

import { sha256Hex } from './inventory'
import type { CollectionEntry } from '@/api/nativeNsites'

export const COLLECTION_KIND = 30004

export type UnsignedCollection = {
  kind: number
  pubkey: string
  created_at: number
  tags: string[][]
  content: string
}

export function collectionEntryTag(entry: CollectionEntry): string[] {
  const tag = [entry.kind === 'pinned' ? 'e' : 'a', entry.ref]
  if (entry.relay) tag.push(entry.relay)
  return tag
}

export async function collectionPlanDigest(params: {
  pubkey: string
  d: string
  title: string
  description: string
  image: string
  entries: CollectionEntry[]
  relays: string[]
}): Promise<string> {
  const ordered = params.entries.map(collectionEntryTag)
  const payload: unknown[] = [
    params.pubkey,
    params.d,
    params.title,
    params.description,
    params.image,
    ordered,
    [...new Set(params.relays)].sort(),
  ]
  const encoded = JSON.stringify(payload)
  return sha256Hex(new TextEncoder().encode(encoded))
}

export async function buildUnsignedCollection(params: {
  pubkey: string
  d: string
  title: string
  description: string
  image: string
  entries: CollectionEntry[]
}): Promise<{ event: UnsignedCollection }> {
  const tags: string[][] = [
    ['d', params.d],
    ['t', 'nsite'],
  ]
  if (params.title) tags.push(['title', params.title.slice(0, 120)])
  if (params.description)
    tags.push(['description', params.description.slice(0, 500)])
  if (params.image) tags.push(['image', params.image])
  for (const entry of params.entries) tags.push(collectionEntryTag(entry))
  return {
    event: {
      kind: COLLECTION_KIND,
      pubkey: params.pubkey,
      created_at: 0,
      tags,
      content: '',
    },
  }
}

// Dedupe by coordinate/event id, preserving display order.
export function dedupeEntries(entries: CollectionEntry[]): CollectionEntry[] {
  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.ref)) return false
    seen.add(entry.ref)
    return true
  })
}
