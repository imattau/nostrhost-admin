import { request } from '@/api/client'

export type McpEndpoint =
  | { configured: false }
  | { configured: true; domain: string; port: number }

export type McpCaBundle =
  | { available: false }
  | { available: true; pem: string }

// The MCP endpoint's Caddy route (`nostrhost mcp route`) and its CA bundle
// (`nostrhost mcp export-ca`).
export function getMcpEndpoint() {
  return request<McpEndpoint>('/package/mcp/endpoint', 'GET')
}

export function setMcpEndpoint(domain: string) {
  return request<McpEndpoint>(
    '/package/mcp/endpoint',
    'POST',
    JSON.stringify({ domain }),
  )
}

export function getMcpCaBundle() {
  return request<McpCaBundle>('/package/mcp/ca-bundle', 'GET')
}
