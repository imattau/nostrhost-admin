import { onUnmounted, ref, shallowRef } from 'vue'

export type OperationEventState = 'connecting' | 'open' | 'closed' | 'error'

// Subscribes to /package/events/<request_id> (SSE) for one operation's live
// chain events — the durable, reconnectable progress feed the plan calls
// for (feature matrix: "durable operation ID, reconnectable progress").
// Session-cookie auth rides along automatically: EventSource sends
// same-origin cookies without needing withCredentials.
export function useOperation(requestId: string) {
  const state = shallowRef<OperationEventState>('connecting')
  const events = ref<Record<string, unknown>[]>([])
  const lastEvent = shallowRef<Record<string, unknown> | null>(null)

  let source: EventSource | null = null
  let retryDelay = 1000
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let closedByCaller = false

  function connect() {
    state.value = 'connecting'
    source = new EventSource(`/package/events/${encodeURIComponent(requestId)}`)
    source.onopen = () => {
      state.value = 'open'
      retryDelay = 1000
    }
    source.onmessage = (message) => {
      try {
        const parsed = JSON.parse(message.data) as Record<string, unknown>
        events.value.push(parsed)
        lastEvent.value = parsed
      } catch {
        // Not JSON (e.g. a stray comment frame) — ignore.
      }
    }
    source.onerror = () => {
      source?.close()
      state.value = 'error'
      if (closedByCaller) return
      retryTimer = setTimeout(() => {
        retryDelay = Math.min(retryDelay * 2, 15_000)
        connect()
      }, retryDelay)
    }
  }

  function close() {
    closedByCaller = true
    if (retryTimer) clearTimeout(retryTimer)
    source?.close()
    state.value = 'closed'
  }

  connect()
  onUnmounted(close)

  return { state, events, lastEvent, close }
}
