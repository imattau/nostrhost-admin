// Shared options shape for the Orval-generated client's custom mutator. Orval
// emits (url, options) with a standard RequestInit-like body (method, headers,
// body already JSON-stringified); orvalRequest maps that onto the authenticated
// request() wrapper.
export type RequestConfig = {
  method?: string
  headers?: HeadersInit | Record<string, string>
  body?: unknown
  [key: string]: unknown
}