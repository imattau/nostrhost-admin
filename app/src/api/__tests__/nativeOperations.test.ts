import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import {
  approveOperation,
  getApprovalTemplate,
  getRejectionTemplate,
  rejectOperation,
} from '@/api/nativeOperations'

vi.mock('@/api/client', () => ({
  request: vi.fn(),
}))

describe('getApprovalTemplate', () => {
  it('omits the query string when no note is given', async () => {
    vi.mocked(request).mockResolvedValueOnce({})
    await getApprovalTemplate('a'.repeat(64))
    expect(request).toHaveBeenCalledWith(
      `/package/operations/${'a'.repeat(64)}/approval-template`,
      'GET',
    )
  })

  it('url-encodes a note into the query string', async () => {
    vi.mocked(request).mockResolvedValueOnce({})
    await getApprovalTemplate('a'.repeat(64), 'looks fine')
    expect(request).toHaveBeenCalledWith(
      `/package/operations/${'a'.repeat(64)}/approval-template?note=looks%20fine`,
      'GET',
    )
  })
})

describe('getRejectionTemplate', () => {
  it('url-encodes a reason into the query string', async () => {
    vi.mocked(request).mockResolvedValueOnce({})
    await getRejectionTemplate('a'.repeat(64), 'not authorized')
    expect(request).toHaveBeenCalledWith(
      `/package/operations/${'a'.repeat(64)}/rejection-template?reason=not%20authorized`,
      'GET',
    )
  })
})

describe('approveOperation', () => {
  it('sends no event field when approving without a bunker', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'x' })
    await approveOperation('x')
    const [, , body] = vi.mocked(request).mock.calls[0]
    expect(JSON.parse(body as string)).toEqual({
      note: undefined,
      event: undefined,
    })
  })

  it('forwards a bunker-signed event when given one', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'x' })
    const signed = {
      id: 'e'.repeat(64),
      pubkey: 'admin',
      created_at: 1,
      kind: 2201,
      tags: [],
      content: '',
      sig: 's'.repeat(128),
    }
    await approveOperation('x', undefined, signed)
    const [, , body] = vi.mocked(request).mock.calls[0]
    expect(JSON.parse(body as string).event).toEqual(signed)
  })
})

describe('rejectOperation', () => {
  it('forwards a reason', async () => {
    vi.mocked(request).mockResolvedValueOnce({ ok: true, request_id: 'x' })
    await rejectOperation('x', 'no thanks')
    const [, , body] = vi.mocked(request).mock.calls[0]
    expect(JSON.parse(body as string).reason).toBe('no thanks')
  })
})
