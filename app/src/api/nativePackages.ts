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
}

export function planPackageManifest(packageData: Record<string, unknown>) {
  return request<PackagePlan>(
    '/package/plan',
    'POST',
    JSON.stringify({ package: packageData }),
  )
}
