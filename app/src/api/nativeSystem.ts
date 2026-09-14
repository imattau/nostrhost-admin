import { request } from '@/api/client'

export type Health = {
  ok: boolean
  version: number
}

export type PackageVersion = {
  version?: string
  repo?: string
  [field: string]: unknown
}

// Keyed by package name (yunohost, yunohost-admin, moulinette, ssowat, ...).
export type SystemVersions = Record<string, PackageVersion>

export type Identity = {
  pubkey: string
  username: string
  signer_type: string
  label: string | null
  enabled: boolean
  created_at: number
  last_used: number
}

export function getHealth() {
  return request<Health>('/package/healthz', 'GET')
}

export function getSystemVersions() {
  return request<SystemVersions>('/package/system/version', 'GET')
}

export type SystemStatus = {
  versions: SystemVersions
  platform: string
  hostname: string
  loadavg: [number, number, number] | null
}

export function getSystemStatus() {
  return request<SystemStatus>('/package/system/status', 'GET')
}

export async function getIdentities() {
  const { identities } = await request<{ identities: Identity[] }>(
    '/package/identity/list',
    'GET',
  )
  return identities
}
