import { afterEach, describe, expect, it, vi } from 'vitest'

import { refreshSession, useSigner } from '@/composables/useSigner'

describe('refreshSession()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('reports a routing error when /package/session is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('nostrhost domain app.example', {
          status: 200,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      ),
    )

    const session = await refreshSession(true)

    expect(session.authenticated).toBe(false)
    expect(useSigner().error.value).toContain(
      'admin API is not available on this domain',
    )
  })
})
