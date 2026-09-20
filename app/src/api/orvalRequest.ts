import type { RequestConfig } from './requestConfig'

// Orval-generated client requests funnel through the existing authenticated
// request() wrapper so session-cookie auth, CSRF headers, NIP-98 fallback,
// Idempotency-Key and the OperationError/ApiError mapping are unchanged. The
// generated client passes (url, {method, headers, body}) with body already
// JSON-stringified; we map that onto request()'s (path, method, body) shape.
export const orvalRequest = async <T>(url: string, options: RequestConfig): Promise<T> => {
  const { request } = await import('./client')
  const target = new URL(url, window.location.origin)
  const method = (options.method || 'GET') as 'GET' | 'POST' | 'DELETE'
  const body =
    options.body !== undefined && options.body !== null
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : undefined
  return request<T>(target.pathname + target.search, method, body)
}