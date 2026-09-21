// Parity test: the client-side manifest builder must agree byte-for-byte with
// the fork's Python `nsites/service.py` (aggregate_hash, plan_digest) — the
// server recomputes the digest from a signed event and rejects a mismatch
// before any broadcast or record. The expected values below are the fork's
// own output for the shared conformance corpus events (computed with
// `nostrhost.nsites.service.plan_digest` / `manifest.aggregate_hash`).

import { describe, expect, it } from 'vitest'

import {
  aggregateHash,
  buildUnsignedManifest,
  buildUnsignedSnapshot,
  compareTuples,
  manifestItems,
  planDigest,
  KIND_NAMED,
  KIND_ROOT,
  KIND_SNAPSHOT,
} from '../manifest'
import type { InventoryItem } from '../inventory'

const ROOT_PATHS: [string, string][] = [
  [
    '/index.html',
    '186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99',
  ],
  [
    '/about.html',
    'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  ],
]
const SERVERS = ['https://blossom.example.com']

const NAMED_PATHS: [string, string][] = [
  [
    '/index.html',
    '186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99',
  ],
  [
    '/post.html',
    'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
  ],
]

describe('aggregateHash parity with the fork', () => {
  it('matches the corpus valid-root aggregate', async () => {
    const result = await aggregateHash(ROOT_PATHS)
    expect(result).toBe(
      '865c10178f4b4d49a65b4e7d945460385a99e243931620e9630c0e6883be4271',
    )
  })
})

describe('planDigest parity with the fork', () => {
  it('root manifest digest', async () => {
    const digest = await planDigest({
      kind: KIND_ROOT,
      d: '',
      paths: ROOT_PATHS.map(([path, sha256]) => ({ path, sha256 })),
      servers: SERVERS,
    })
    expect(digest).toBe(
      '293efea328fb5324b3fac03869de4e836a6ea9b3b38824e08dafa426891a0494',
    )
  })

  it('named manifest digest', async () => {
    const digest = await planDigest({
      kind: KIND_NAMED,
      d: 'blog',
      paths: NAMED_PATHS.map(([path, sha256]) => ({ path, sha256 })),
      servers: SERVERS,
    })
    expect(digest).toBe(
      'be4336c168452fe3552005b1c3453784b501beb1c43476145c34f40c63c43a4f',
    )
  })
})

describe('compareTuples matches Python tuple ordering', () => {
  it('orders by path then hash, like sorted([(p, h), ...])', () => {
    const input: [string, string][] = [
      ['/b.html', 'z'],
      ['/a.html', 'b'],
      ['/a.html', 'a'],
      ['/a-b.html', 'x'],
    ]
    const sorted = [...input].sort(compareTuples)
    expect(sorted).toEqual([
      ['/a-b.html', 'x'], // '-'(0x2D) sorts before '.'(0x2E)
      ['/a.html', 'a'],
      ['/a.html', 'b'],
      ['/b.html', 'z'],
    ])
  })
})

describe('buildUnsignedManifest', () => {
  it('emits d/path/server/x tags in the fork order', async () => {
    const { event, aggregate } = await buildUnsignedManifest({
      pubkey:
        'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732',
      kind: KIND_NAMED,
      d: 'blog',
      items: manifestItems(
        NAMED_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: SERVERS,
    })
    expect(event.kind).toBe(KIND_NAMED)
    expect(event.tags[0]).toEqual(['d', 'blog'])
    expect(event.tags.filter((tag) => tag[0] === 'path')).toHaveLength(2)
    expect(event.tags[event.tags.length - 1]).toEqual([
      'x',
      aggregate,
      'aggregate',
    ])
    expect(aggregate).toBe(
      '11e6ec45320a826dd8ae29a94a897a85c37beda9db642e13cd45839a21394268',
    )
  })

  it('emits the optional app tag (kind-32267 address) after d', async () => {
    const app =
      '32267:b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732:main'
    const { event } = await buildUnsignedManifest({
      pubkey:
        'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732',
      kind: KIND_NAMED,
      d: 'blog',
      items: manifestItems(
        NAMED_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: SERVERS,
      app,
    })
    expect(event.tags[0]).toEqual(['d', 'blog'])
    expect(event.tags[1]).toEqual(['app', app])
    // The app tag carries no content-integrity meaning: the plan digest
    // (which drives the stale-plan check) must be identical with or without it.
    const withApp = await planDigest({
      kind: KIND_NAMED,
      d: 'blog',
      paths: manifestItems(
        NAMED_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: SERVERS,
      relays: ['wss://relay.example.org'],
    })
    const withoutApp = await planDigest({
      kind: KIND_NAMED,
      d: 'blog',
      paths: manifestItems(
        NAMED_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: SERVERS,
      relays: ['wss://relay.example.org'],
    })
    expect(withApp).toBe(withoutApp)
  })
})

describe('buildUnsignedSnapshot', () => {
  it('emits a kind-5128 event with an a tag to the site and the same aggregate', async () => {
    const { event, aggregate } = await buildUnsignedSnapshot({
      pubkey:
        'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732',
      kind: KIND_NAMED,
      d: 'blog',
      items: manifestItems(
        NAMED_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: SERVERS,
    })
    expect(event.kind).toBe(KIND_SNAPSHOT)
    expect(event.tags[0]).toEqual([
      'a',
      `35128:b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732:blog`,
    ])
    expect(event.tags.filter((tag) => tag[0] === 'path')).toHaveLength(2)
    expect(event.tags[event.tags.length - 1]).toEqual([
      'x',
      aggregate,
      'aggregate',
    ])
    // A snapshot of the named site keeps the same aggregate hash as the
    // root/named manifest it derives from (identical path inventory).
    const { aggregate: rootAggregate } = await buildUnsignedManifest({
      pubkey:
        'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732',
      kind: KIND_NAMED,
      d: 'blog',
      items: manifestItems(
        NAMED_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: SERVERS,
    })
    expect(aggregate).toBe(rootAggregate)
    expect(aggregate).toBe(
      '11e6ec45320a826dd8ae29a94a897a85c37beda9db642e13cd45839a21394268',
    )
  })

  it('builds a root-site snapshot a tag with an empty d', async () => {
    const { event } = await buildUnsignedSnapshot({
      pubkey:
        'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732',
      kind: KIND_ROOT,
      d: '',
      items: manifestItems(
        ROOT_PATHS.map(([path, sha256]) => ({ path, sha256, size: 10 })),
      ),
      servers: [],
    })
    expect(event.tags[0]).toEqual([
      'a',
      `15128:b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732:`,
    ])
  })
})

describe('manifestItems', () => {
  it('sorts an inventory by path then hash', () => {
    const items: InventoryItem[] = [
      { path: '/z.html', sha256: 'z', size: 1 },
      { path: '/a.html', sha256: 'b', size: 1 },
      { path: '/a.html', sha256: 'a', size: 1 },
    ]
    const sorted = manifestItems(items)
    expect(sorted.map((item) => item.path)).toEqual([
      '/a.html',
      '/a.html',
      '/z.html',
    ])
    expect(sorted.map((item) => item.sha256)).toEqual(['a', 'b', 'z'])
  })
})
