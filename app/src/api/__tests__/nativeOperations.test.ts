import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import {
  approveOperation,
  getApprovalTemplate,
  getNotifySignerPairing,
  getRejectionTemplate,
  listNotifySigners,
  registerNotifySigner,
  rejectOperation,
  removeNotifySigner,
  startNotifySignerPairing,
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

describe('listNotifySigners', () => {
  it('reads the node signer fan-out status', async () => {
    const payload = { remote: true, this_admin: false, targets: [] }
    vi.mocked(request).mockResolvedValueOnce(payload)
    await expect(listNotifySigners()).resolves.toEqual(payload)
    expect(request).toHaveBeenCalledWith('/package/notify/signers', 'GET')
  })
})

describe('registerNotifySigner', () => {
  it('posts the bunker uri and label', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      remote: true,
      this_admin: true,
      targets: [],
    })
    await registerNotifySigner('bunker://abc?relay=wss', 'phone')
    const [path, method, body] = vi.mocked(request).mock.calls[0]
    expect(path).toBe('/package/notify/signers')
    expect(method).toBe('POST')
    expect(JSON.parse(body as string)).toEqual({
      bunker_uri: 'bunker://abc?relay=wss',
      label: 'phone',
    })
  })
})

describe('removeNotifySigner', () => {
  it('deletes by url-encoded pubkey', async () => {
    vi.mocked(request).mockResolvedValueOnce({ removed: true })
    await removeNotifySigner('ab'.repeat(32))
    expect(request).toHaveBeenCalledWith(
      `/package/notify/signers/${'ab'.repeat(32)}`,
      'DELETE',
    )
  })
})

describe('startNotifySignerPairing', () => {
  it('posts the optional relays and label', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      pairing_id: 'p',
      status: 'pending',
      uri: 'nostrconnect://x',
    })
    await startNotifySignerPairing(['wss://relay.example'], 'phone')
    const [path, method, body] = vi.mocked(request).mock.calls[0]
    expect(path).toBe('/package/notify/signers/pair')
    expect(method).toBe('POST')
    expect(JSON.parse(body as string)).toEqual({
      relays: ['wss://relay.example'],
      label: 'phone',
    })
  })
})

describe('getNotifySignerPairing', () => {
  it('polls a pairing by id', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      pairing_id: 'p',
      status: 'paired',
    })
    await getNotifySignerPairing('p')
    expect(request).toHaveBeenCalledWith(
      '/package/notify/signers/pair/p',
      'GET',
    )
  })
})
