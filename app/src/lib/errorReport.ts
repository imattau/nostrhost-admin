// Client-side error reporting for the admin SPA: capture window errors,
// unhandled rejections and Vue render/component errors and post them
// (batched, bounded) to the portal-api report endpoint, which lands them in
// the structured problem log (kind=client) for logs.problems. Never throws.
import type { App } from 'vue'
import type { Router } from 'vue-router'

const ENDPOINT = '/nostrhost/portalapi/report'

type ClientEvent = {
  message: string
  stack?: string
  route?: string
  app: 'admin'
}

let queue: ClientEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let currentRoute = () => window.location.pathname + window.location.search

function enqueue(event: ClientEvent): void {
  if (queue.length >= 20) return // drop when the backlog is huge
  queue.push(event)
  if (timer) return
  timer = setTimeout(() => {
    void flush()
  }, 2000)
}

async function flush(): Promise<void> {
  timer = null
  if (queue.length === 0) return
  const batch = queue
  queue = []
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    })
  } catch {
    // diagnostics must never affect the UI
  }
}

function normalize(value: unknown): string {
  if (value instanceof Error) return value.message || value.name
  return String(value)
}

export function installErrorReporting(router: Router): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    enqueue({
      message: event.message || 'window error',
      stack: (event.error as Error | undefined)?.stack,
      route: currentRoute(),
      app: 'admin',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    enqueue({
      message: normalize(event.reason),
      stack: event.reason instanceof Error ? event.reason.stack : undefined,
      route: currentRoute(),
      app: 'admin',
    })
  })

  router.afterEach((to) => {
    currentRoute = () => to.fullPath
  })

  window.addEventListener('pagehide', () => {
    void flush()
  })
}

export function installVueErrorHandler(app: App): void {
  app.config.errorHandler = (err, _instance, info) => {
    enqueue({
      message: `${normalize(err)}${info ? ` (${info})` : ''}`,
      stack: err instanceof Error ? err.stack : undefined,
      route: currentRoute(),
      app: 'admin',
    })
  }
}
