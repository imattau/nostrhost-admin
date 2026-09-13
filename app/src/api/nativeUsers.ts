import { request } from '@/api/client'

export type NativeUser = {
  username: string
  fullname?: string
  mail?: string
  mailbox_quota?: { limit: string; use?: string }
  mailalias?: string[]
  mailforward?: string[]
  groups?: string[]
  [field: string]: unknown
}

export type NativeUserList = {
  users: Record<string, NativeUser>
}

export type CreateUserInput = {
  username: string
  domain: string
  password: string
  fullname: string
  mailboxQuota?: string
  admin?: boolean
}

export type UpdateUserInput = {
  username: string
  mail?: string
  changePassword?: string
  addMailforward?: string[]
  removeMailforward?: string[]
  addMailalias?: string[]
  removeMailalias?: string[]
  mailboxQuota?: string
  fullname?: string
}

export type DeleteUserInput = {
  username: string
  purge?: boolean
  force?: boolean
}

export function listUsers() {
  return request<NativeUserList>('/package/user/list', 'GET')
}

export function createUser(input: CreateUserInput) {
  return request<{ username: string; domain: string; admin: boolean }>(
    '/package/user/create',
    'POST',
    JSON.stringify({
      username: input.username,
      domain: input.domain,
      password: input.password,
      fullname: input.fullname,
      mailbox_quota: input.mailboxQuota ?? '0',
      admin: input.admin ?? false,
    }),
  )
}

export function updateUser(input: UpdateUserInput) {
  return request<{ username: string }>(
    '/package/user/update',
    'POST',
    JSON.stringify({
      username: input.username,
      mail: input.mail ?? null,
      change_password: input.changePassword ?? null,
      add_mailforward: input.addMailforward ?? null,
      remove_mailforward: input.removeMailforward ?? null,
      add_mailalias: input.addMailalias ?? null,
      remove_mailalias: input.removeMailalias ?? null,
      mailbox_quota: input.mailboxQuota ?? null,
      fullname: input.fullname ?? null,
    }),
  )
}

export function deleteUser(input: DeleteUserInput) {
  return request<{ username: string; purge: boolean }>(
    '/package/user/delete',
    'POST',
    JSON.stringify({
      username: input.username,
      purge: input.purge ?? false,
      force: input.force ?? false,
    }),
  )
}
