import { request } from '@/api/client'

export type GpuProfile = {
  name: string
  memory_total_bytes: number
  memory_free_bytes: number
}

export type HostCapabilities = {
  os: string
  architecture: string
  logical_cpus: number
  cpu_features?: string[]
  memory_total_bytes: number
  memory_available_bytes: number
  model_dir_free_bytes: number
  nvidia_gpus?: GpuProfile[]
  gpu_probe: string
}

export type ModelArtifact = {
  id: string
  name: string
  repository: string
  revision: string
  filename: string
  size_bytes: number
  sha256: string
  license: string
  quantization: string
  evaluation_status: string
  evaluation_note: string
  deployment_eligible: boolean
}

export type ModelAssessment = {
  model_id: string
  resource_compatible: boolean
  deployment_eligible: boolean
  reasons: string[]
}

export type ModelRecommendation = {
  model: ModelArtifact
  assessment: ModelAssessment
}

export type ModelRecommendResult = {
  catalog_version: number
  profile: HostCapabilities
  models: ModelRecommendation[]
}

export type ModelDownloadResult = {
  model_id: string
  path: string
  sha256: string
  message: string
}

export type ModelSelectResult = {
  model_id: string
  deployment_eligible: boolean
  evaluation_status: string
  llm_service: string
}

export type ModelStatus = {
  selected_model: string | null
  llm_service_enabled: boolean
  llm_service_active: boolean
}

export type AgentModeLevel = 'observe' | 'assist' | 'maintain' | 'autonomous'

export type AgentMode = { level: AgentModeLevel }

export type ExportCycleSummary = {
  cycle_id: string
  finished_at: string
  cycle_result: string
  decision: string
}

export type ExportCandidate = {
  schema_version: string
  candidate_id: string
  candidate_file_id: string
  review_status: string
  redactions_applied: number
  planner_input: unknown
  observed_decision: unknown
  outcome: unknown
  review_warning: string
}

export type ContributionSettings = {
  enabled: boolean
  dataset_repo: string
  token_configured: boolean
}

export type ContributionSubmitResult = {
  uploaded: boolean
  repo: string
  path: string
  revision: string
  message: string
}

export function getModelProfile() {
  return request<HostCapabilities>('/package/agent/models/profile', 'GET')
}

export function getModelRecommendations() {
  return request<ModelRecommendResult>('/package/agent/models/recommend', 'GET')
}

export function downloadModel(modelId: string, evaluationOnly: boolean) {
  return request<ModelDownloadResult>(
    '/package/agent/models/download',
    'POST',
    JSON.stringify({ model_id: modelId, evaluation_only: evaluationOnly }),
  )
}

export function selectModel(modelId: string) {
  return request<ModelSelectResult>(
    '/package/agent/models/select',
    'POST',
    JSON.stringify({ model_id: modelId }),
  )
}

export function getModelStatus() {
  return request<ModelStatus>('/package/agent/models/status', 'GET')
}

export function getAgentMode() {
  return request<AgentMode>('/package/agent/mode', 'GET')
}

export function setAgentMode(level: AgentModeLevel, confirm: boolean) {
  return request<AgentMode>(
    '/package/agent/mode',
    'POST',
    JSON.stringify({ level, confirm }),
  )
}

export function listExportableCycles() {
  return request<ExportCycleSummary[]>('/package/agent/export/list', 'GET')
}

export function runExport(cycleId: string) {
  return request<ExportCandidate>(
    '/package/agent/export/run',
    'POST',
    JSON.stringify({ cycle_id: cycleId }),
  )
}

export function getExportCandidate(candidateFileId: string) {
  return request<ExportCandidate>(
    `/package/agent/export/${encodeURIComponent(candidateFileId)}`,
    'GET',
  )
}

export function getContributionSettings() {
  return request<ContributionSettings>('/package/agent/contribution/settings', 'GET')
}

// token is only ever sent, never returned — the GET result only reports
// token_configured: boolean.
export function setContributionSettings(
  enabled: boolean,
  datasetRepo: string,
  token?: string,
) {
  return request<ContributionSettings>(
    '/package/agent/contribution/settings',
    'POST',
    JSON.stringify({ enabled, dataset_repo: datasetRepo, token: token || undefined }),
  )
}

// Uploads exactly the one locally-redacted candidate file chosen — nothing
// else on the node is ever read or transmitted, and nothing is automatic.
export function submitContribution(candidateFileId: string) {
  return request<ContributionSubmitResult>(
    '/package/agent/contribution/submit',
    'POST',
    JSON.stringify({ candidate_file_id: candidateFileId }),
  )
}
