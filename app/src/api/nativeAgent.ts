import { request } from '@/api/client'

export type AgentStatus = {
  installed: boolean
  configured: boolean
  service_enabled: boolean
  service_active: boolean
}

export type AgentInitResult = {
  configured: boolean
  service_enabled: boolean
  policy: string
  config_path: string
  agent_pubkey: string
  agent_npub: string
  relay_scopes: string[]
  next: string
}

export type AgentServiceResult = {
  service: string
  action: 'enable' | 'disable'
  config_path: string
}

export function getAgentStatus() {
  return request<AgentStatus>('/package/agent/status', 'GET')
}

export function initAgent() {
  return request<AgentInitResult>('/package/agent/init', 'POST')
}

export function enableAgent() {
  return request<AgentServiceResult>('/package/agent/enable', 'POST')
}

export function disableAgent() {
  return request<AgentServiceResult>('/package/agent/disable', 'POST')
}
