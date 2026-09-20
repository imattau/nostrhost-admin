import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import {
  configureNsiteGateway,
  disableNsiteGateway,
  discoverCollections,
  enableNsiteGateway,
  getCollection,
  getCollectionPlan,
  getNsiteGatewayStatus,
  getNsiteInspect,
  getNsiteList,
  nsiteBlockAdd,
  nsiteBlockList,
  nsiteBlockRemove,
  planNsitePublish,
  publishCollection,
  publishNsite,
  registerNsite,
  unregisterNsite,
  validateCollection,
} from '@/api/nativeNsites'

vi.mock('@/api/client', () => ({
  request: vi.fn(),
}))

const statusEnvelope = {
  gateway: {
    enabled: true,
    domain: 'sites.example.org',
    mode: 'hosted',
    service_active: true,
    config_path: '/etc/nostrhost/nsite.toml',
    config_exists: true,
    health: 'ok',
    health_detail: 'unit active',
    sites: 0,
    config: {
      domain: 'sites.example.org',
      relays: { lookup: ['wss://purplepag.es'], extra: [] },
      blossom: {
        fallback_servers: ['https://blossom.primal.net'],
        allow_http: false,
      },
      limits: { max_blob_bytes: 33554432, cache_quota_bytes: 2147483648 },
    },
    internal: { status: 'ok', body: '{}' },
  },
}

describe('getNsiteGatewayStatus', () => {
  it('returns the gateway status envelope from /package/nsite/gateway/status', async () => {
    vi.mocked(request).mockResolvedValueOnce(statusEnvelope)
    const result = await getNsiteGatewayStatus()
    expect(result.gateway.enabled).toBe(true)
    expect(result.gateway.domain).toBe('sites.example.org')
    expect(request).toHaveBeenCalledWith('/package/nsite/gateway/status', 'GET')
  })
})

describe('gateway lifecycle writes', () => {
  it('enable posts the gateway input as JSON', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true })
    const input = {
      domain: 'sites.example.org',
      allow_http: true,
      max_blob_bytes: 16777216,
    }
    await enableNsiteGateway(input)
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/gateway/enable',
      'POST',
      JSON.stringify(input),
    )
  })

  it('disable posts an empty object (registry requires an input model)', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true })
    await disableNsiteGateway()
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/gateway/disable',
      'POST',
      JSON.stringify({}),
    )
  })

  it('configure posts the partial config', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true })
    const input = { domain: 'sites.example.org', cache_quota_bytes: 1073741824 }
    await configureNsiteGateway(input)
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/gateway/configure',
      'POST',
      JSON.stringify(input),
    )
  })
})

describe('Phase 3a site registry + publish client', () => {
  it('list hits /package/nsite/list', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      mode: 'hosted',
      sites: [],
      count: 0,
    })
    await getNsiteList()
    expect(request).toHaveBeenCalledWith('/package/nsite/list', 'GET')
  })

  it('inspect passes pubkey and d as query params', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      site: { pubkey: 'pk', kind: 35128, d: 'blog' },
    })
    await getNsiteInspect({ pubkey: 'pk', d: 'blog' })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/inspect?pubkey=pk&d=blog',
      'GET',
    )
  })

  it('plan posts the inventory as JSON', async () => {
    vi.mocked(request).mockResolvedValueOnce({ plan: { plan_sha256: 'd' } })
    const input = {
      pubkey: 'pk',
      kind: 15128,
      d: '',
      items: [{ path: '/i.html', sha256: 'a'.repeat(64) }],
    }
    await planNsitePublish(input)
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/publish/plan',
      'POST',
      JSON.stringify(input),
    )
  })

  it('register posts pubkey/kind/d/title', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true })
    const input = { pubkey: 'pk', kind: 35128, d: 'blog', title: 'Blog' }
    await registerNsite(input)
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/register',
      'POST',
      JSON.stringify(input),
    )
  })

  it('unregister posts pubkey and d', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true })
    await unregisterNsite({ pubkey: 'pk', d: 'blog' })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/unregister',
      'POST',
      JSON.stringify({ pubkey: 'pk', d: 'blog' }),
    )
  })

  it('publish posts the signed event + plan digest + relays', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true })
    const event = { id: 'evt', sig: 'sig' }
    await publishNsite({
      event,
      plan_sha256: 'digest',
      relays: ['wss://relay.test'],
    })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/publish',
      'POST',
      JSON.stringify({
        event,
        plan_sha256: 'digest',
        relays: ['wss://relay.test'],
      }),
    )
  })
})

describe('discoverNsites', () => {
  it('returns the discovery envelope from /package/nsite/discover', async () => {
    const envelope = {
      sites: [
        {
          label: 'npub1test',
          pubkey: 'pk',
          kind: 15128,
          d: '',
          title: 'Test site',
          servers: ['https://blossom.example.com'],
          relays: [],
          event_id: 'evt',
          created_at: 1750000000,
          paths_count: 2,
          app: '',
          registered: false,
          blobs_ok: true,
          blobs_checked: 1,
        },
      ],
      relays_queried: ['wss://nos.lol'],
      count: 1,
      truncated: false,
      blob_check: {
        checked: 1,
        ok: 1,
        unknown: 0,
        excluded: 0,
        blocked: 0,
        truncated: false,
      },
      cached: false,
      cached_at: null,
    }
    vi.mocked(request).mockResolvedValueOnce(envelope)
    const { discoverNsites } = await import('@/api/nativeNsites')
    const result = await discoverNsites()
    expect(result.count).toBe(1)
    expect(result.sites[0].label).toBe('npub1test')
    expect(request).toHaveBeenCalledWith('/package/nsite/discover', 'GET')
  })

  it('forces a live scan with refresh=1', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      sites: [],
      relays_queried: [],
      count: 0,
      truncated: false,
      blob_check: {
        checked: 0,
        ok: 0,
        unknown: 0,
        excluded: 0,
        blocked: 0,
        truncated: false,
      },
      cached: false,
      cached_at: null,
    })
    const { discoverNsites } = await import('@/api/nativeNsites')
    await discoverNsites(true)
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/discover?refresh=1',
      'GET',
    )
  })
})

describe('nsite blocklist', () => {
  it('lists the operator mute list from /package/nsite/block/list', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      pubkeys: ['pk1', 'pk2'],
      count: 2,
    })
    const result = await nsiteBlockList()
    expect(result.count).toBe(2)
    expect(request).toHaveBeenCalledWith('/package/nsite/block/list', 'GET')
  })

  it('adds a pubkey via POST /package/nsite/block/add', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, result: {} })
    await nsiteBlockAdd('pk1')
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/block/add',
      'POST',
      JSON.stringify({ pubkey: 'pk1' }),
    )
  })

  it('removes a pubkey via POST /package/nsite/block/remove', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, result: {} })
    await nsiteBlockRemove('pk1')
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/block/remove',
      'POST',
      JSON.stringify({ pubkey: 'pk1' }),
    )
  })
})

describe('curated collection client (kind 30004)', () => {
  it('discovers collections via GET /package/nsite/collection/discover', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      collections: [],
      relays_queried: ['wss://x'],
      count: 0,
      truncated: false,
      cached: false,
      cached_at: null,
    })
    await discoverCollections(true)
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/collection/discover?refresh=1',
      'GET',
    )
  })

  it('resolves one coordinate with relay hints', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      found: true,
      relays_queried: ['wss://a'],
      entries: [],
    })
    await getCollection({
      coordinate: '30004:pk:indie-web',
      relays: ['wss://a', 'wss://b'],
    })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/collection/get?coordinate=30004%3Apk%3Aindie-web&relays=wss%3A%2F%2Fa%2Cwss%3A%2F%2Fb',
      'GET',
    )
  })

  it('validates a collection event via POST', async () => {
    vi.mocked(request).mockResolvedValueOnce({ valid: true, errors: [] })
    await validateCollection({ kind: 30004 })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/collection/validate',
      'POST',
      JSON.stringify({ event: { kind: 30004 } }),
    )
  })

  it('builds a collection plan via POST /package/nsite/collection/publish/plan', async () => {
    vi.mocked(request).mockResolvedValueOnce({ plan: { plan_sha256: 'd' } })
    await getCollectionPlan({
      pubkey: 'pk',
      d: 'indie-web',
      title: 't',
      entries: [{ kind: 'live-root', ref: '15128:pk:', relay: '' }],
    })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/collection/publish/plan',
      'POST',
      JSON.stringify({
        pubkey: 'pk',
        d: 'indie-web',
        title: 't',
        description: undefined,
        image: undefined,
        entries: [{ kind: 'live-root', ref: '15128:pk:', relay: '' }],
        relays: undefined,
        copy_of: undefined,
      }),
    )
  })

  it('publishes a signed collection via POST', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, result: {} })
    await publishCollection({ event: { kind: 30004 }, plan_sha256: 'd' })
    expect(request).toHaveBeenCalledWith(
      '/package/nsite/collection/publish',
      'POST',
      JSON.stringify({
        event: { kind: 30004 },
        plan_sha256: 'd',
        relays: undefined,
      }),
    )
  })
})
