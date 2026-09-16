import { request } from '@/api/client'

export type PackageOperation = {
  name: string
  resource: string
  risk?: 'low' | 'medium' | 'high'
  reversible?: boolean
  reverse?: string | null
  summary: string
  args?: Record<string, unknown>
  [field: string]: unknown
}

export type PackagePlan = {
  schema: number
  manifest_sha256: string
  plan_sha256: string
  package: { id: string; version: string }
  operations: PackageOperation[]
  settings_diff?: Array<{ key: string; old: unknown; new: unknown }>
}

export type AppManagementEntry = {
  id: string
  name: string
  description: string
  category: string
  catalogue_version: string | null
  installed_version?: string | null
  installed: boolean
  status: 'available' | 'installed' | 'version-differs' | 'installed-unlisted'
  installation?: { native: boolean; source?: string; legacy: boolean }
  movable?: boolean
  catalogue?: {
    publisher?: string
    repository?: string
    revision?: string
    manifest_sha256?: string
    content_sha256?: string
    package_path?: string
    event_id?: string
  } | null
}

export type AppManagement = {
  apps: AppManagementEntry[]
  catalogue_error?: string
}

export type NativeSettingField = {
  key: string
  type: 'string' | 'integer' | 'number' | 'boolean' | 'enum'
  label?: string | null
  description?: string
  group?: string | null
  default?: unknown
  choices?: string[]
  secret?: boolean
}

export type NativeAppSettings = {
  app: { id: string; version?: string }
  fields: NativeSettingField[]
  values: Record<string, unknown>
}

export function planPackageManifest(packageData: Record<string, unknown>) {
  return request<PackagePlan>(
    '/package/plan',
    'POST',
    JSON.stringify({ package: packageData }),
  )
}

export type ManifestDiagnostic = {
  code: string
  path: Array<string | number>
  message: string
  hint?: string
}

export type FetchedManifest = {
  package: Record<string, unknown>
  valid: boolean
  diagnostics: ManifestDiagnostic[]
  commit: string
}

export function fetchManifestFromRepository(
  repository: string,
  options: { revision?: string; packagePath?: string } = {},
) {
  return request<FetchedManifest>(
    '/package/authoring/fetch_manifest',
    'POST',
    JSON.stringify({
      repository,
      revision: options.revision || '',
      package_path: options.packagePath || '',
    }),
  )
}

export function getAppManagement() {
  return request<AppManagement>('/package/app/management', 'GET')
}

export function getNativeAppSettings(appId: string) {
  return request<NativeAppSettings>(
    `/package/app/${encodeURIComponent(appId)}/settings`,
    'GET',
  )
}

export function planNativeAppSettings(
  appId: string,
  values: Record<string, unknown>,
) {
  return request<PackagePlan>(
    `/package/app/${encodeURIComponent(appId)}/settings/plan`,
    'POST',
    JSON.stringify({ values }),
  )
}

export function applyNativeAppSettings(
  appId: string,
  plan: PackagePlan,
  values: Record<string, unknown>,
) {
  return request<{
    operation: { ok: boolean; request_id?: string; result?: unknown }
    settings_diff: PackagePlan['settings_diff']
  }>(
    `/package/app/${encodeURIComponent(appId)}/settings/apply`,
    'POST',
    JSON.stringify({ values, plan_sha256: plan.plan_sha256 }),
  )
}

export type ChangeUrlPlan = PackagePlan & {
  url_diff: {
    old: { domain: string; path: string }
    new: { domain: string; path: string }
  }
}

export function planChangeUrl(appId: string, domain: string, path: string) {
  return request<ChangeUrlPlan>(
    `/package/app/${encodeURIComponent(appId)}/change-url/plan`,
    'POST',
    JSON.stringify({ domain, path }),
  )
}

export function applyChangeUrl(
  appId: string,
  domain: string,
  path: string,
  plan: ChangeUrlPlan,
) {
  return request<{
    operation: { ok: boolean; request_id?: string; result?: unknown }
    action: string
    url_diff: ChangeUrlPlan['url_diff']
  }>(
    `/package/app/${encodeURIComponent(appId)}/change-url/apply`,
    'POST',
    JSON.stringify({ domain, path, plan_sha256: plan.plan_sha256 }),
  )
}

export function planCatalogueApp(
  appId: string,
  action: 'install' | 'upgrade' | 'remove',
) {
  if (action === 'remove') {
    return request<PackagePlan>(
      `/package/app/${encodeURIComponent(appId)}/remove/plan`,
      'POST',
      '{}',
    )
  }
  return request<PackagePlan>(
    `/package/app/${encodeURIComponent(appId)}/${action}/plan`,
    'POST',
    '{}',
  )
}

export function applyCatalogueApp(
  appId: string,
  action: 'install' | 'upgrade' | 'remove',
  plan: PackagePlan,
) {
  return request<{
    operation: { ok: boolean; request_id?: string; result?: unknown }
    action: string
    package: PackagePlan['package']
  }>(
    `/package/app/${encodeURIComponent(appId)}/${action}/apply`,
    'POST',
    JSON.stringify({ plan_sha256: plan.plan_sha256 }),
  )
}
