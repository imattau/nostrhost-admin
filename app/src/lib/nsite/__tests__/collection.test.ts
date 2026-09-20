// Parity test: the client-side collection builder must agree byte-for-byte
// with the fork's Python `nsites/collections.py` (`collection_plan_digest`) —
// the server recomputes the digest from a signed event and rejects a mismatch
// before any broadcast. The expected values below are the fork's own output.

import { describe, expect, it } from 'vitest'

import {
  buildUnsignedCollection,
  collectionEntryTag,
  collectionPlanDigest,
  dedupeEntries,
  COLLECTION_KIND,
} from '../collection'
import type { CollectionEntry } from '@/api/nativeNsites'

const PUBKEY =
  'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732'
const SITE_PUBKEY =
  '266815e0c9210dfa324c6cba3573b14bee49da4209a9456f9484e5106cd408a5'
const SNAP_ID =
  '5c8ed07b8c33b5d1e2d1c1dcec4d1d1a1e1f1a1b1c1d1e1f2021222324252627'

const ENTRIES: CollectionEntry[] = [
  { kind: 'live-root', ref: `15128:${SITE_PUBKEY}:`, relay: 'wss://nos.lol' },
  { kind: 'pinned', ref: SNAP_ID, relay: '' },
]

describe('collectionPlanDigest parity with the fork', () => {
  it('matches the Python collection_plan_digest output', async () => {
    const digest = await collectionPlanDigest({
      pubkey: PUBKEY,
      d: 'indie-web',
      title: 'Small independent sites',
      description: 'Personal sites.',
      image: 'https://cdn.example/a.webp',
      entries: ENTRIES,
      relays: ['wss://nos.lol'],
    })
    expect(digest).toBe(
      '5fb7343abad6e5284af7e33202ef943fb641f60c22d600f45cbbfb22c6114afa',
    )
  })

  it('is insensitive to relay order but sensitive to entry order', async () => {
    const base = {
      pubkey: PUBKEY,
      d: 'indie-web',
      title: 't',
      description: '',
      image: '',
      entries: ENTRIES,
      relays: ['wss://nos.lol', 'wss://relay.damus.io'],
    }
    const a = await collectionPlanDigest(base)
    const b = await collectionPlanDigest({
      ...base,
      relays: ['wss://relay.damus.io', 'wss://nos.lol'],
    })
    expect(b).toBe(a)
    const c = await collectionPlanDigest({
      ...base,
      entries: [...ENTRIES].reverse(),
    })
    expect(c).not.toBe(a) // display order matters
  })

  it('keeps parity with the fork for non-ASCII metadata (raw UTF-8)', async () => {
    // JSON.stringify emits raw UTF-8; the fork must hash the identical bytes
    // (ensure_ascii=False). Expected value is the fork's own output.
    const digest = await collectionPlanDigest({
      pubkey: PUBKEY,
      d: 'indie-web',
      title: 'Café ☕ 独立',
      description: 'Émoticônes 😀 et accents.',
      image: 'https://cdn.example/a.webp',
      entries: ENTRIES,
      relays: ['wss://nos.lol'],
    })
    expect(digest).toBe(
      '6cbde45e5b8629bfc9b9e6c6a007e5436bea8c7925b6442af4435fc52f24df66',
    )
  })
})

describe('buildUnsignedCollection', () => {
  it('emits d/t/metadata/a/e tags in the fork order', async () => {
    const { event } = await buildUnsignedCollection({
      pubkey: PUBKEY,
      d: 'indie-web',
      title: 'Small independent sites',
      description: 'Personal sites.',
      image: 'https://cdn.example/a.webp',
      entries: ENTRIES,
    })
    expect(event.kind).toBe(COLLECTION_KIND)
    expect(event.created_at).toBe(0)
    expect(event.tags[0]).toEqual(['d', 'indie-web'])
    expect(event.tags[1]).toEqual(['t', 'nsite'])
    expect(event.tags[2]).toEqual(['title', 'Small independent sites'])
    expect(event.tags[3]).toEqual(['description', 'Personal sites.'])
    expect(event.tags[4]).toEqual(['image', 'https://cdn.example/a.webp'])
    expect(event.tags[5]).toEqual([
      'a',
      `15128:${SITE_PUBKEY}:`,
      'wss://nos.lol',
    ])
    expect(event.tags[6]).toEqual(['e', SNAP_ID])
  })
})

describe('collectionEntryTag / dedupeEntries', () => {
  it('maps live/pinned kinds to a/e tags', () => {
    expect(
      collectionEntryTag({
        kind: 'live-named',
        ref: `35128:${SITE_PUBKEY}:blog`,
        relay: '',
      }),
    ).toEqual(['a', `35128:${SITE_PUBKEY}:blog`])
    expect(
      collectionEntryTag({ kind: 'pinned', ref: SNAP_ID, relay: 'wss://x' }),
    ).toEqual(['e', SNAP_ID, 'wss://x'])
  })

  it('dedupes by ref preserving order', () => {
    const dup = dedupeEntries([
      { kind: 'live-root', ref: 'a', relay: '' },
      { kind: 'pinned', ref: 'b', relay: '' },
      { kind: 'live-root', ref: 'a', relay: '' },
    ])
    expect(dup.map((e) => e.ref)).toEqual(['a', 'b'])
  })
})
