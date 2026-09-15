import { ref } from 'vue'
import { describe, expect, it } from 'vitest'

import { useActionRunner } from '@/composables/useActionRunner'
import { useNotifications } from '@/composables/useNotifications'

describe('useActionRunner', () => {
  it('sets busy to the given value while the action runs, then resets to idle', async () => {
    const busy = ref('')
    const { run } = useActionRunner(busy, '')

    let sawBusyDuringAction = ''
    await run(
      'save',
      async () => {
        sawBusyDuringAction = busy.value
      },
      'Could not save.',
    )

    expect(sawBusyDuringAction).toBe('save')
    expect(busy.value).toBe('')
  })

  it('notifies danger with the fallback message on failure, and still resets busy', async () => {
    const busy = ref('')
    const { run } = useActionRunner(busy, '')
    const { notifications } = useNotifications()

    await run(
      'save',
      async () => {
        throw new Error('boom')
      },
      'Could not save.',
    )

    expect(busy.value).toBe('')
    const last = notifications[notifications.length - 1]
    expect(last.variant).toBe('danger')
    expect(last.message).toBe('boom')
  })

  it('falls back to the given error message for a non-Error throw', async () => {
    const busy = ref('')
    const { run } = useActionRunner(busy, '')
    const { notifications } = useNotifications()

    await run(
      'save',
      async () => {
        throw 'not an error'
      },
      'Could not save.',
    )

    const last = notifications[notifications.length - 1]
    expect(last.message).toBe('Could not save.')
  })

  it('routes the failure through a custom handler when given a function', async () => {
    const busy = ref('')
    const { run } = useActionRunner(busy, '')

    let handled: unknown
    await run(
      'save',
      async () => {
        throw new Error('boom')
      },
      (cause) => {
        handled = cause
      },
    )

    expect(busy.value).toBe('')
    expect(handled).toBeInstanceOf(Error)
  })

  it('works with a boolean busy ref and a custom idle value', async () => {
    const busy = ref(false)
    const { run } = useActionRunner(busy, false)

    let sawBusyDuringAction = false
    await run(
      true,
      async () => {
        sawBusyDuringAction = busy.value
      },
      'Could not run.',
    )

    expect(sawBusyDuringAction).toBe(true)
    expect(busy.value).toBe(false)
  })
})
