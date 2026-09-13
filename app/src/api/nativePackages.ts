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

export function getAppManagement() {
  return request<AppManagement>('/package/app/management', 'GET')
}

export function getNativeAppSettings(appId: string) {
  return request<NativeAppSettings>(
    `/app/${encodeURIComponent(appId)}/settings`,
    'GET',
  )
}

export function planNativeAppSettings(
  appId: string,
  values: Record<string, unknown>,
) {
  return request<PackagePlan>(
    `/app/${encodeURIComponent(appId)}/settings/plan`,
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
    `/app/${encodeURIComponent(appId)}/settings/apply`,
    'POST',
    JSON.stringify({ values, plan_sha256: plan.plan_sha256 }),
  )
}

export function planCatalogueApp(
  appId: string,
  action: 'install' | 'upgrade' | 'remove',
) {
  if (action === 'remove') {
    return request<PackagePlan>(
      `/app/${encodeURIComponent(appId)}/remove/plan`,
      'POST',
      '{}',
    )
  }
  return request<PackagePlan>(
    `/app/${encodeURIComponent(appId)}/${action}/plan`,
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
    `/app/${encodeURIComponent(appId)}/${action}/apply`,
    'POST',
    JSON.stringify({ plan_sha256: plan.plan_sha256 }),
  )
}
