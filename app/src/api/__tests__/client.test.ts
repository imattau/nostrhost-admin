import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/composables/useSigner', () => ({
  refreshSession: vi.fn().mockResolvedValue({
    authenticated: true,
    username: 'alice',
    pubkey: 'abc123',
    admin: true,
    csrf_token: 'test-csrf',
  }),
  csrfToken: { value: 'test-csrf' },
}))

import { refreshSession } from '@/composables/useSigner'
import { ApiError, OperationError, request } from '@/api/client'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('request()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  // Regression test for C1: run_signed_chain returns HTTP 200 with
  // `ok: false` when a write is rejected, failed, or parked for approval.
  // The whole Phase 0 fix hinges on this being thrown, not returned.
  it('throws OperationError when a write resolves ok:false', async () => {
    const rejection = () =>
      jsonResponse({
        ok: false,
        request_id: 'req1',
        state: 'REJECTED',
        reason: 'policy denied',
      })
    vi.mocked(fetch)
      .mockResolvedValueOnce(rejection())
      .mockResolvedValueOnce(rejection())

    await expect(
      request('/package/firewall/open', 'POST', '{}'),
    ).rejects.toThrow(OperationError)
    await expect(
      request('/package/firewall/open', 'POST', '{}'),
    ).rejects.toMatchObject({
      reason: 'policy denied',
      pending_approval: false,
    })
  })

  it('surfaces a pending-approval result distinctly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        request_id: 'req2',
        state: 'REQUESTED',
        pending_approval: true,
      }),
    )

    await expect(
      request('/package/firewall/open', 'POST', '{}'),
    ).rejects.toMatchObject({
      pending_approval: true,
    })
  })

  it('surfaces the execution error from a failed lifecycle write', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({
        ok: false,
        request_id: 'req-failed',
        state: 'FAILED',
        error: 'DuckDNS returned KO; check the token and subname.',
      }),
    )

    await expect(
      request('/package/domain/add', 'POST', '{}'),
    ).rejects.toMatchObject({
      message: 'DuckDNS returned KO; check the token and subname.',
      error: 'DuckDNS returned KO; check the token and subname.',
      state: 'FAILED',
    })
  })

  it('does not throw OperationError for a successful write', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ ok: true, request_id: 'req3' }),
    )

    await expect(
      request('/package/firewall/open', 'POST', '{}'),
    ).resolves.toEqual({
      ok: true,
      request_id: 'req3',
    })
  })

  it('does not require an ok field on plain GET reads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ authenticated: true }),
    )

    await expect(request('/package/session', 'GET')).resolves.toEqual({
      authenticated: true,
    })
  })

  it('throws a typed ApiError with status and backend code on HTTP failure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'not authorized', code: 'not_authorized' }, 403),
    )

    await expect(
      request('/package/power/reboot', 'POST', '{}'),
    ).rejects.toMatchObject({
      status: 403,
      code: 'not_authorized',
    })
    expect(ApiError).toBeDefined()
  })

  it('force-refreshes the session on a 401', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'expired' }, 401),
    )

    await expect(
      request('/package/power/reboot', 'POST', '{}'),
    ).rejects.toMatchObject({
      status: 401,
    })
    expect(refreshSession).toHaveBeenCalledWith(true)
  })
})
