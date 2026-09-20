import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'

vi.mock('@/composables/useSigner', () => ({
  useSigner: () => ({ publicKey: ref(null), sync: vi.fn().mockResolvedValue(undefined) }),
  refreshSession: vi.fn().mockResolvedValue({ authenticated: true }),
  csrfToken: { value: 'test-csrf' },
}))

vi.mock('@/composables/useNotifications', () => ({
  useNotifications: () => ({
    danger: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    notifications: [],
  }),
}))

vi.mock('@/api/nativeOperations', () => ({
  listOperations: vi.fn(),
}))

import { listOperations } from '@/api/nativeOperations'
import { useOperationsList } from '@/composables/useOperationsList'

// Mount a tiny component inside a real Vue app so Vue Query's plugin is
// installed (hooks need an injection context + the default client).
function mountHook(setup: () => unknown) {
  let exposed: unknown
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(
    defineComponent({
      setup() {
        exposed = setup()
        return () => null
      },
    }),
  )
  app.use(VueQueryPlugin, {
    queryClientConfig: {
      defaultOptions: {
        queries: { retry: 1, staleTime: 5_000 },
        mutations: { retry: 0 },
      },
    },
  })
  app.mount(host)
  return {
    exposed: () => exposed as any,
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

describe('useOperationsList (A2 polling server-state)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(listOperations).mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('fetches through the API adapter and returns the data', async () => {
    const sample = [{ id: 'op1' }]
    vi.mocked(listOperations).mockResolvedValue(sample as never)

    const hook = mountHook(() => useOperationsList({ refetchInterval: false }))
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()

    const { operations, loading } = hook.exposed()
    expect(vi.mocked(listOperations)).toHaveBeenCalledWith(200)
    expect(loading.value).toBe(false)
    expect(operations.value).toEqual(sample)
    hook.unmount()
  })

  it('schedules a refetch on the interval when enabled', async () => {
    const hook = mountHook(() => useOperationsList({ refetchInterval: 5_000 }))
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.mocked(listOperations)).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(vi.mocked(listOperations)).toHaveBeenCalledTimes(2)
    hook.unmount()
  })

  it('surfaces a failed read as isError (reads retry once, mutations retry zero)', async () => {
    vi.mocked(listOperations).mockRejectedValue(new Error('boom'))
    const hook = mountHook(() => useOperationsList({ refetchInterval: false }))
    await vi.advanceTimersByTimeAsync(0)
    // read retries once with backoff; advance far enough for retry+error to land
    await vi.advanceTimersByTimeAsync(10_000)
    await nextTick()
    expect(hook.exposed().isError.value).toBe(true)
    hook.unmount()
  })
})