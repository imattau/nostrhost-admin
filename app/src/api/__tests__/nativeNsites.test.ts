import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import {
  configureNsiteGateway,
  disableNsiteGateway,
  enableNsiteGateway,
  getNsiteGatewayStatus,
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
