import { request } from '@/api/client'

export type OperationState =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'

export type OperationEntry = {
  id: string
  request_id: string
  tool: string | null
  pubkey: string | null
  created_at: number
  state: OperationState
  [field: string]: unknown
}

export async function listOperations(limit?: number) {
  const query = limit ? `?limit=${limit}` : ''
  const { entries } = await request<{ entries: OperationEntry[] }>(
    `/package/operations${query}`,
    'GET',
  )
  return entries
}

export function getOperation(requestId: string) {
  return request<OperationEntry>(`/package/operations/${encodeURIComponent(requestId)}`, 'GET')
}

export function approveOperation(requestId: string, note?: string) {
  return request<{ ok: boolean; request_id: string; event_id?: string }>(
    `/package/operations/${encodeURIComponent(requestId)}/approve`,
    'POST',
    JSON.stringify({ note }),
  )
}

export function rejectOperation(requestId: string, reason?: string) {
  return request<{ ok: boolean; request_id: string; event_id?: string }>(
    `/package/operations/${encodeURIComponent(requestId)}/reject`,
    'POST',
    JSON.stringify({ reason }),
  )
}
