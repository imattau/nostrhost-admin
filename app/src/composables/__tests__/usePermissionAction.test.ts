import { describe, expect, it } from 'vitest'

import { usePermissionAction } from '@/composables/usePermissionAction'
import { useNotifications } from '@/composables/useNotifications'
import type { LifecycleOperation } from '@/api/nativeGroupsPermissions'

describe('usePermissionAction', () => {
  it('notifies success and returns the result on the happy path', async () => {
    const { perform } = usePermissionAction()
    const { notifications } = useNotifications()
    const result: LifecycleOperation = { ok: true, request_id: 'op-1' }

    let settled = false
    const returned = await perform(
      'grant-alice',
      async () => result,
      {
        successMessage: (r) => `Granted alice access. Operation ${r.request_id}`,
        failureFallback: 'Could not grant access.',
      },
      () => {
        settled = true
      },
    )

    expect(returned).toEqual(result)
    expect(settled).toBe(true)
    const last = notifications[notifications.length - 1]
    expect(last.variant).toBe('success')
    expect(last.message).toBe('Granted alice access. Operation op-1')
  })

  it('notifies failure, still runs onSettled, and does not throw', async () => {
    const { perform } = usePermissionAction()
    const { notifications } = useNotifications()

    let settled = false
    const returned = await perform(
      'revoke-bob',
      async () => {
        throw new Error('permission denied')
      },
      {
        successMessage: () => 'unused',
        failureFallback: 'Could not revoke access.',
      },
      () => {
        settled = true
      },
    )

    expect(returned).toBeUndefined()
    expect(settled).toBe(true)
    const last = notifications[notifications.length - 1]
    expect(last.variant).toBe('danger')
    expect(last.message).toBe('permission denied')
  })

  it('refuses a second concurrent action under the same busy tracker', async () => {
    const { perform, isBusy } = usePermissionAction()

    let releaseFirst: () => void = () => {}
    const first = perform(
      'grant-alice',
      () => new Promise<LifecycleOperation>((resolve) => (releaseFirst = () => resolve({ ok: true }))),
      { successMessage: () => 'done', failureFallback: 'failed' },
    )

    expect(isBusy('grant-alice')).toBe(true)
    const second = await perform('grant-carol', async () => ({ ok: true }), {
      successMessage: () => 'done',
      failureFallback: 'failed',
    })
    expect(second).toBeUndefined()

    releaseFirst()
    await first
  })
})
