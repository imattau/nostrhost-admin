import { describe, expect, it } from 'vitest'

import { useConfirm } from '@/composables/useConfirm'

describe('useConfirm', () => {
  it('starts at the given idle value', () => {
    const { pending } = useConfirm(false)
    expect(pending.value).toBe(false)
  })

  it('sets pending to the requested value', () => {
    const { pending, request } = useConfirm(false)
    request(true)
    expect(pending.value).toBe(true)
  })

  it('resets pending back to idle on cancel', () => {
    const { pending, request, cancel } = useConfirm(false)
    request(true)
    cancel()
    expect(pending.value).toBe(false)
  })

  it('carries a payload through request/cancel for a null-idle ref', () => {
    const { pending, request, cancel } = useConfirm<string | null>(null)
    expect(pending.value).toBeNull()

    request('user-1')
    expect(pending.value).toBe('user-1')

    cancel()
    expect(pending.value).toBeNull()
  })

  it('works with an object payload', () => {
    const { pending, request } = useConfirm<{
      protocol: string
      port: number
    } | null>(null)

    request({ protocol: 'tcp', port: 22 })
    expect(pending.value).toEqual({ protocol: 'tcp', port: 22 })
  })
})
