import { describe, expect, it } from 'vitest'

import { useBusyAction } from '@/composables/useBusyAction'

describe('useBusyAction', () => {
  it('reports not busy until run() is called, and busy with the given key while running', async () => {
    const { isBusy, run } = useBusyAction()
    expect(isBusy()).toBe(false)

    let sawBusyDuringAction = false
    await run('save', async () => {
      sawBusyDuringAction = isBusy('save')
    })

    expect(sawBusyDuringAction).toBe(true)
    expect(isBusy()).toBe(false)
    expect(isBusy('save')).toBe(false)
  })

  it('clears busy state after the action throws', async () => {
    const { isBusy, run } = useBusyAction()

    await expect(
      run('save', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(isBusy()).toBe(false)
  })

  it('refuses a second action while one is already in flight', async () => {
    const { isBusy, run } = useBusyAction()

    let releaseFirst: () => void = () => {}
    const first = run('save', () => new Promise<void>((resolve) => (releaseFirst = resolve)))

    expect(isBusy('save')).toBe(true)
    const second = await run('other', async () => 'second result')
    expect(second).toBeUndefined()

    releaseFirst()
    await first
    expect(isBusy()).toBe(false)
  })
})
