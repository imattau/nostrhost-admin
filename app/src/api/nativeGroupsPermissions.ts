import { request } from '@/api/client'

export type UserGroup = {
  members: string[]
  [field: string]: unknown
}

export type UserGroupList = Record<string, UserGroup>

export type PermissionInfo = {
  label: string
  url?: string | null
  additional_urls?: string[]
  show_tile?: boolean | null
  protected?: boolean
  allowed: string[]
  corresponding_users?: string[]
  [field: string]: unknown
}

export type PermissionList = {
  permissions: Record<string, PermissionInfo>
}

export type LifecycleOperation = {
  ok: boolean
  request_id?: string
  result?: unknown
  [field: string]: unknown
}

export function getGroups() {
  return request<UserGroupList>('/package/user/group/list', 'GET')
}

export function createGroup(groupname: string, gid?: string) {
  return request<LifecycleOperation>(
    '/package/user/group/create',
    'POST',
    JSON.stringify({ groupname, gid }),
  )
}

export function updateGroup(
  groupname: string,
  options: { add?: string[]; remove?: string[] },
) {
  return request<LifecycleOperation>(
    '/package/user/group/update',
    'POST',
    JSON.stringify({
      groupname,
      add: options.add,
      remove: options.remove,
    }),
  )
}

export function deleteGroup(groupname: string, force = false) {
  return request<LifecycleOperation>(
    '/package/user/group/delete',
    'POST',
    JSON.stringify({ groupname, force }),
  )
}

export function getPermissions(full = true) {
  return request<PermissionList>(
    `/package/user/permission/list${full ? '?full=true' : ''}`,
    'GET',
  )
}

export function getPermissionInfo(permission: string) {
  return request<PermissionInfo>(
    `/package/user/permission/info/${encodeURIComponent(permission)}`,
    'GET',
  )
}

export function addPermission(permission: string, names: string[]) {
  return request<LifecycleOperation>(
    '/package/user/permission/add',
    'POST',
    JSON.stringify({ permission, names }),
  )
}

export function removePermission(permission: string, names: string[]) {
  return request<LifecycleOperation>(
    '/package/user/permission/remove',
    'POST',
    JSON.stringify({ permission, names }),
  )
}

export function updatePermission(
  permission: string,
  options: { label?: string; show_tile?: boolean },
) {
  return request<LifecycleOperation>(
    '/package/user/permission/update',
    'POST',
    JSON.stringify({
      permission,
      label: options.label,
      show_tile: options.show_tile,
    }),
  )
}
