import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import {
  applyConnectivity,
  checkConnectivity,
  planConnectivity,
  type ConnectivityConfiguration,
} from '@/api/nativeConnectivity'

vi.mock('@/api/client', () => ({ request: vi.fn() }))

const configuration: ConnectivityConfiguration = {
  version: 1,
  default_relays: ['wss://relay.example'],
  default_blossom_servers: ['https://blossom.example'],
  additional_discovery_relays: [],
  overrides: { lookup: null, publish: null, catalogue: null, nsite: null },
}

describe('Nostr connectivity API', () => {
  it('checks only the supplied public destinations', async () => {
    vi.mocked(request).mockResolvedValueOnce({ relays: [], servers: [] })
    await checkConnectivity(
      configuration.default_relays,
      configuration.default_blossom_servers,
    )
    expect(request).toHaveBeenCalledWith(
      '/package/nostr/connectivity/check',
      'POST',
      JSON.stringify({
        relays: configuration.default_relays,
        blossom_servers: configuration.default_blossom_servers,
      }),
    )
  })

  it('sends the same configuration and reviewed fingerprint when applying', async () => {
    vi.mocked(request).mockResolvedValue({})
    await planConnectivity(configuration)
    await applyConnectivity(configuration, 'abc123')
    expect(request).toHaveBeenLastCalledWith(
      '/package/nostr/connectivity/apply',
      'POST',
      JSON.stringify({ configuration, plan_sha256: 'abc123' }),
    )
  })
})
