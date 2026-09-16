import { describe, expect, it, vi } from 'vitest'

import { signAndSubmit } from '../publish'
import { KIND_ROOT } from '../manifest'
import { reviewDigest } from '../publish'

const ITEMS = [
  {
    path: '/index.html',
    sha256: '186ea5fd14e88fd1ac49351759e7ab906fa94892002b60bf7f5a428f28ca1c99',
  },
  {
    path: '/about.html',
    sha256: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  },
]
const SERVERS = ['https://blossom.example.com']
const RELAYS = ['wss://relay.test']

describe('signAndSubmit', () => {
  it('signs the manifest with a real created_at and submits with the plan digest', async () => {
    const signEvent = vi.fn(
      async (event: {
        pubkey: string
        created_at: number
        kind: number
        tags: string[][]
        content: string
      }) => ({ id: 'evt', sig: 'sig', ...event }),
    )
    const submit = vi.fn(async (args: unknown) => ({ ok: true, result: args }))

    const outcome = await signAndSubmit({
      pubkey:
        'b6c048759734c1ef1b3ba0acfd1cd862b394eaab1bc15b7bf6c7f357986d9732',
      kind: KIND_ROOT,
      d: '',
      items: ITEMS,
      servers: SERVERS,
      relays: RELAYS,
      signEvent,
      submit,
    })

    expect(outcome.ok).toBe(true)
    const signed = signEvent.mock.calls[0][0]
    expect(signed.kind).toBe(KIND_ROOT)
    expect(signed.created_at).toBeGreaterThan(1_700_000_000)

    const args = (submit.mock.calls[0][0] as { plan_sha256: string })
      .plan_sha256
    expect(args).toBe(
      '3719e74f6dd6fdee3e1c21cfe69f8f044865dbb8b37a95156929f4869c8f3507',
    )
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ relays: RELAYS }),
    )
  })

  it('reviewDigest exposes the exact digest the signer commits to', async () => {
    const digest = await reviewDigest({
      kind: KIND_ROOT,
      d: '',
      items: ITEMS,
      servers: SERVERS,
    })
    expect(digest).toBe(
      '293efea328fb5324b3fac03869de4e836a6ea9b3b38824e08dafa426891a0494',
    )
  })
})
