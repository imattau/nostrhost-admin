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
  return request<OperationEntry>(
    `/package/operations/${encodeURIComponent(requestId)}`,
    'GET',
  )
}

export type NotifySignerTarget = {
  signer_pubkey: string
  relays: string[]
  label: string | null
  paired: boolean
}

export type NotifySigners = {
  remote: boolean
  this_admin: boolean
  targets: NotifySignerTarget[]
}

// Whether the node pushes parked approvals to a remote signer, and whether
// this admin's own identity is one of them (see `nostrhost notify signer`).
export function listNotifySigners() {
  return request<NotifySigners>('/package/notify/signers', 'GET')
}

// Register the node (not this browser) with the admin's own remote signer
// from a `bunker://` URI, so parked approvals reach it without a browser
// session. Only the authenticated admin's own identity may be registered.
export function registerNotifySigner(bunkerUri: string, label?: string) {
  return request<NotifySigners>(
    '/package/notify/signers',
    'POST',
    JSON.stringify({ bunker_uri: bunkerUri, label: label ?? null }),
  )
}

export function removeNotifySigner(signerPubkey: string) {
  return request<{ removed: boolean } & NotifySigners>(
    `/package/notify/signers/${encodeURIComponent(signerPubkey)}`,
    'DELETE',
  )
}

export type NotifySignerPairing = {
  pairing_id: string
  status: 'pending' | 'paired' | 'failed' | 'expired'
  uri: string
  relays: string[]
  expires_at: number
  signer_pubkey: string | null
  error: string | null
}

// Node-initiated pairing: the server returns a `nostrconnect://` URI to show
// as a QR; poll the pairing until it reports `paired`.
export function startNotifySignerPairing(relays?: string[], label?: string) {
  return request<NotifySignerPairing>(
    '/package/notify/signers/pair',
    'POST',
    JSON.stringify({ relays: relays ?? null, label: label ?? null }),
  )
}

export function getNotifySignerPairing(pairingId: string) {
  return request<NotifySignerPairing & Partial<NotifySigners>>(
    `/package/notify/signers/pair/${encodeURIComponent(pairingId)}`,
    'GET',
  )
}

export type SignedEvent = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

// The exact unsigned event a connected NIP-46 bunker must sign to approve or
// reject an operation - fetched fresh per action so its created_at/id can't
// go stale, then handed to useBunkerSigner's signTemplate().
export function getApprovalTemplate(requestId: string, note?: string) {
  const query = note ? `?note=${encodeURIComponent(note)}` : ''
  return request<Record<string, unknown>>(
    `/package/operations/${encodeURIComponent(requestId)}/approval-template${query}`,
    'GET',
  )
}

export function getRejectionTemplate(requestId: string, reason?: string) {
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : ''
  return request<Record<string, unknown>>(
    `/package/operations/${encodeURIComponent(requestId)}/rejection-template${query}`,
    'GET',
  )
}

// `event` is a bunker-signed approval/rejection template (see above); when
// omitted, the server signs with its own admin/operator key instead - the
// same fallback nostr-opctl approve/reject already uses.
export function approveOperation(
  requestId: string,
  note?: string,
  event?: SignedEvent,
) {
  return request<{
    ok: boolean
    status: 'submitted'
    request_id: string
    event_id?: string
  }>(
    `/package/operations/${encodeURIComponent(requestId)}/approve`,
    'POST',
    JSON.stringify({ note, event }),
  )
}

export function rejectOperation(
  requestId: string,
  reason?: string,
  event?: SignedEvent,
) {
  return request<{
    ok: boolean
    status: 'submitted'
    request_id: string
    event_id?: string
  }>(
    `/package/operations/${encodeURIComponent(requestId)}/reject`,
    'POST',
    JSON.stringify({ reason, event }),
  )
}
