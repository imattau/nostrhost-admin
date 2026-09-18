import { describe, expect, it, vi } from 'vitest'

import { request } from '@/api/client'
import { getMcpEndpoint, setMcpEndpoint } from '@/api/nativeMcp'

vi.mock('@/api/client', () => ({ request: vi.fn() }))

describe('MCP endpoint API', () => {
  it('gets the configured endpoint', async () => {
    vi.mocked(request).mockResolvedValueOnce({ configured: false })

    await getMcpEndpoint()

    expect(request).toHaveBeenCalledWith('/package/mcp/endpoint', 'GET')
  })

  it('posts the selected endpoint domain', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      configured: true,
      domain: 'mcp.example.com',
      port: 8930,
    })

    await setMcpEndpoint('mcp.example.com')

    expect(request).toHaveBeenCalledWith(
      '/package/mcp/endpoint',
      'POST',
      JSON.stringify({ domain: 'mcp.example.com' }),
    )
  })
})
