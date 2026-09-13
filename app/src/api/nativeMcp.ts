import { request } from '@/api/client'

export type McpEndpoint =
  | { configured: false }
  | { configured: true; domain: string; port: number }

export type McpCaBundle =
  | { available: false }
  | { available: true; pem: string }

// The MCP endpoint's Caddy route (`nostrhost mcp route`) and its CA bundle
// (`nostrhost mcp export-ca`) — read-only: this UI does not configure the
// route itself, only shows what the operator has already set up.
export function getMcpEndpoint() {
  return request<McpEndpoint>('/package/mcp/endpoint', 'GET')
}

export function getMcpCaBundle() {
  return request<McpCaBundle>('/package/mcp/ca-bundle', 'GET')
}
