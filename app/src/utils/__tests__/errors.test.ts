import { describe, expect, it } from 'vitest'

import { toErrorMessage } from '@/utils/errors'

describe('toErrorMessage', () => {
  it('returns the Error message when the cause is an Error', () => {
    expect(toErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('returns the fallback for a non-Error cause', () => {
    expect(toErrorMessage('boom', 'fallback')).toBe('fallback')
    expect(toErrorMessage(undefined, 'fallback')).toBe('fallback')
    expect(toErrorMessage({ message: 'boom' }, 'fallback')).toBe('fallback')
  })
})
