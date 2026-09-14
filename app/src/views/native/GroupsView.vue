<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  addPermission,
  createGroup,
  deleteGroup,
  getGroups,
  getPermissions,
  removePermission,
  updateGroup,
  updatePermission,
  type PermissionInfo,
  type UserGroup,
} from '@/api/nativeGroupsPermissions'
import { listUsers } from '@/api/nativeUsers'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useSigner } from '@/composables/useSigner'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()

const CORE_GROUPS = new Set(['all_users', 'visitors', 'admins'])

const groups = ref<Record<string, UserGroup>>({})
const permissions = ref<Record<string, PermissionInfo>>({})
const usernames = ref<string[]>([])

const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

const groupNames = computed(() => Object.keys(groups.value).sort())
const permissionNames = computed(() => Object.keys(permissions.value).sort())

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [groupResult, permissionResult, userResult] = await Promise.all([
      getGroups(),
      getPermissions(true),
      listUsers(),
    ])
    groups.value = groupResult
    permissions.value = permissionResult.permissions
    usernames.value = Object.keys(userResult.users).sort()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load groups.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})

// -- create group -------------------------------------------------------------

const showCreateGroup = ref(false)
const createGroupname = ref('')
const confirmingCreateGroup = ref(false)
const createGroupError = ref('')

function requestCreateGroup() {
  if (!createGroupname.value.trim()) {
    createGroupError.value = 'Enter a group name.'
    return
  }
  createGroupError.value = ''
  confirmingCreateGroup.value = true
}

async function confirmCreateGroup() {
  confirmingCreateGroup.value = false
  busy.value = 'create-group'
  createGroupError.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await createGroup(createGroupname.value.trim())
    notice.value = `Group creation submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    createGroupname.value = ''
    showCreateGroup.value = false
    await load()
  } catch (cause) {
    createGroupError.value =
      cause instanceof Error ? cause.message : 'Failed to create group.'
  } finally {
    busy.value = ''
  }
}

// -- add/remove members ---------------------------------------------------

const memberPicks = ref<Record<string, string>>({})

function availableUsers(groupname: string) {
  const members = new Set(groups.value[groupname]?.members ?? [])
  return usernames.value.filter((name) => !members.has(name))
}

async function addMember(groupname: string) {
  const username = memberPicks.value[groupname]
  if (!username) return
  busy.value = `member-add-${groupname}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await updateGroup(groupname, { add: [username] })
    notice.value = `Added ${username} to ${groupname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    memberPicks.value[groupname] = ''
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to add ${username} to ${groupname}.`
  } finally {
    busy.value = ''
  }
}

const confirmingRemoveMember = ref<string | null>(null)

function memberKey(groupname: string, username: string) {
  return `${groupname}:${username}`
}

function requestRemoveMember(groupname: string, username: string) {
  notice.value = ''
  error.value = ''
  confirmingRemoveMember.value = memberKey(groupname, username)
}

function cancelRemoveMember() {
  confirmingRemoveMember.value = null
}

async function confirmRemoveMember(groupname: string, username: string) {
  confirmingRemoveMember.value = null
  const key = memberKey(groupname, username)
  busy.value = `member-remove-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await updateGroup(groupname, { remove: [username] })
    notice.value = `Removed ${username} from ${groupname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to remove ${username} from ${groupname}.`
  } finally {
    busy.value = ''
  }
}

// -- delete group ---------------------------------------------------------

const confirmingDeleteGroup = ref<string | null>(null)

function requestDeleteGroup(groupname: string) {
  notice.value = ''
  error.value = ''
  confirmingDeleteGroup.value = groupname
}

function cancelDeleteGroup() {
  confirmingDeleteGroup.value = null
}

async function confirmDeleteGroup(groupname: string) {
  confirmingDeleteGroup.value = null
  busy.value = `delete-group-${groupname}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await deleteGroup(groupname)
    notice.value = `Deletion of ${groupname} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to delete ${groupname}.`
  } finally {
    busy.value = ''
  }
}

// -- grant/revoke permission ------------------------------------------------

const grantPicks = ref<Record<string, string>>({})

async function grantPermission(permission: string) {
  const name = grantPicks.value[permission]
  if (!name) return
  busy.value = `permission-add-${permission}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await addPermission(permission, [name])
    notice.value = `Granted ${name} access to ${permission}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    grantPicks.value[permission] = ''
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to grant access to ${permission}.`
  } finally {
    busy.value = ''
  }
}

const confirmingRevoke = ref<string | null>(null)

function revokeKey(permission: string, name: string) {
  return `${permission}:${name}`
}

function requestRevoke(permission: string, name: string) {
  notice.value = ''
  error.value = ''
  confirmingRevoke.value = revokeKey(permission, name)
}

function cancelRevoke() {
  confirmingRevoke.value = null
}

async function confirmRevoke(permission: string, name: string) {
  confirmingRevoke.value = null
  const key = revokeKey(permission, name)
  busy.value = `permission-remove-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await removePermission(permission, [name])
    notice.value = `Revoked ${name} access to ${permission}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Failed to revoke access to ${permission}.`
  } finally {
    busy.value = ''
  }
}

// -- update permission label/tile --------------------------------------------

const editingPermission = ref<string | null>(null)
const editLabel = ref('')
const editShowTile = ref(false)

function startEditPermission(permission: string, info: PermissionInfo) {
  notice.value = ''
  error.value = ''
  editingPermission.value = permission
  editLabel.value = info.label
  editShowTile.value = Boolean(info.show_tile)
}

function cancelEditPermission() {
  editingPermission.value = null
}

async function saveEditPermission(permission: string) {
  busy.value = `permission-update-${permission}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await updatePermission(permission, {
      label: editLabel.value.trim(),
      show_tile: editShowTile.value,
    })
    notice.value = `Updated ${permission}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    editingPermission.value = null
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to update ${permission}.`
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Access control"
      title="Groups &amp; permissions"
      description="User groups and which groups can access each app's permissions. Changes ask for confirmation first."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Groups</span>
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="showCreateGroup = !showCreateGroup"
              >{{ showCreateGroup ? 'Cancel' : 'Create group' }}</Button
            >
          </CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
          <div
            v-if="showCreateGroup"
            class="tw:grid tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:grid tw:gap-1.5">
              <Label for="group-create-name">Group name</Label>
              <Input
                id="group-create-name"
                v-model="createGroupname"
                autocomplete="off"
                spellcheck="false"
              />
            </div>
            <Alert v-if="createGroupError" variant="danger">{{
              createGroupError
            }}</Alert>
            <div
              v-if="confirmingCreateGroup"
              class="tw:flex tw:items-center tw:justify-end tw:gap-2"
            >
              <span class="tw:text-xs tw:text-muted-foreground"
                >Create {{ createGroupname.trim() }}?</span
              >
              <Button
                variant="outline"
                size="sm"
                @click="confirmingCreateGroup = false"
                >Cancel</Button
              >
              <Button
                variant="danger"
                size="sm"
                :disabled="busy !== ''"
                @click="confirmCreateGroup"
                >Confirm</Button
              >
            </div>
            <div v-else class="tw:flex tw:justify-end">
              <Button
                size="sm"
                :disabled="busy !== ''"
                @click="requestCreateGroup"
                >{{
                  busy === 'create-group' ? 'Creating…' : 'Create group'
                }}</Button
              >
            </div>
          </div>

          <p v-if="loading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
            Loading…
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-3 tw:pl-0">
            <li
              v-for="groupname in groupNames"
              :key="groupname"
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <span class="tw:flex tw:items-center tw:gap-2">
                  <code class="tw:font-mono tw:text-sm">{{ groupname }}</code>
                  <Badge v-if="CORE_GROUPS.has(groupname)" variant="neutral"
                    >system</Badge
                  >
                </span>
                <template v-if="!CORE_GROUPS.has(groupname)">
                  <Button
                    variant="outline"
                    size="sm"
                    :disabled="busy !== ''"
                    @click="requestDeleteGroup(groupname)"
                    >{{
                      busy === `delete-group-${groupname}`
                        ? 'Deleting…'
                        : 'Delete'
                    }}</Button
                  >
                </template>
              </div>

              <div class="tw:flex tw:flex-wrap tw:gap-2">
                <Badge
                  v-for="member in groups[groupname]?.members ?? []"
                  :key="member"
                  variant="neutral"
                  class="tw:flex tw:items-center tw:gap-1"
                >
                  {{ member }}
                  <template
                    v-if="
                      confirmingRemoveMember === memberKey(groupname, member)
                    "
                  >
                    <button
                      type="button"
                      class="tw:ml-1 tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs tw:text-red-500"
                      :disabled="busy !== ''"
                      @click="confirmRemoveMember(groupname, member)"
                    >
                      confirm
                    </button>
                    <button
                      type="button"
                      class="tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs"
                      @click="cancelRemoveMember"
                    >
                      ×
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tw:ml-1 tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs tw:text-muted-foreground"
                    :disabled="busy !== ''"
                    @click="requestRemoveMember(groupname, member)"
                  >
                    remove
                  </button>
                </Badge>
              </div>

              <div class="tw:flex tw:items-center tw:gap-2">
                <Select
                  v-model="memberPicks[groupname]"
                  class="tw:h-8 tw:max-w-[220px] tw:text-xs"
                  aria-label="Add member"
                >
                  <option value="">Add member…</option>
                  <option
                    v-for="name in availableUsers(groupname)"
                    :key="name"
                    :value="name"
                  >
                    {{ name }}
                  </option>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== '' || !memberPicks[groupname]"
                  @click="addMember(groupname)"
                  >{{
                    busy === `member-add-${groupname}` ? 'Adding…' : 'Add'
                  }}</Button
                >
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-4">
          <p v-if="loading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
            Loading…
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-3 tw:pl-0">
            <li
              v-for="permission in permissionNames"
              :key="permission"
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <div class="tw:flex tw:items-start tw:justify-between tw:gap-3">
                <div>
                  <p class="tw:m-0 tw:text-sm tw:font-semibold">
                    {{ permissions[permission].label }}
                  </p>
                  <code
                    class="tw:font-mono tw:text-xs tw:text-muted-foreground"
                    >{{ permission }}</code
                  >
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="
                    startEditPermission(permission, permissions[permission])
                  "
                  >Edit</Button
                >
              </div>

              <div
                v-if="editingPermission === permission"
                class="tw:grid tw:gap-2 tw:rounded-lg tw:bg-surface-muted tw:p-3"
              >
                <div class="tw:grid tw:gap-1.5">
                  <Label :for="`permission-label-${permission}`">Label</Label>
                  <Input
                    :id="`permission-label-${permission}`"
                    v-model="editLabel"
                  />
                </div>
                <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
                  <input
                    v-model="editShowTile"
                    type="checkbox"
                    class="tw:size-4 tw:accent-brand-500"
                  />
                  Show tile on the portal
                </label>
                <div class="tw:flex tw:justify-end tw:gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="cancelEditPermission"
                    >Cancel</Button
                  >
                  <Button
                    size="sm"
                    :disabled="busy !== ''"
                    @click="saveEditPermission(permission)"
                    >{{
                      busy === `permission-update-${permission}`
                        ? 'Saving…'
                        : 'Save'
                    }}</Button
                  >
                </div>
              </div>

              <div class="tw:flex tw:flex-wrap tw:gap-2">
                <Badge
                  v-for="name in permissions[permission].allowed"
                  :key="name"
                  variant="brand"
                  class="tw:flex tw:items-center tw:gap-1"
                >
                  {{ name }}
                  <template
                    v-if="confirmingRevoke === revokeKey(permission, name)"
                  >
                    <button
                      type="button"
                      class="tw:ml-1 tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs tw:text-red-500"
                      :disabled="busy !== ''"
                      @click="confirmRevoke(permission, name)"
                    >
                      confirm
                    </button>
                    <button
                      type="button"
                      class="tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs"
                      @click="cancelRevoke"
                    >
                      ×
                    </button>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="tw:ml-1 tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs"
                    :disabled="busy !== ''"
                    @click="requestRevoke(permission, name)"
                  >
                    revoke
                  </button>
                </Badge>
              </div>

              <div class="tw:flex tw:items-center tw:gap-2">
                <Select
                  v-model="grantPicks[permission]"
                  class="tw:h-8 tw:max-w-[220px] tw:text-xs"
                  aria-label="Grant access to"
                >
                  <option value="">Grant access to…</option>
                  <option v-for="name in groupNames" :key="name" :value="name">
                    {{ name }}
                  </option>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== '' || !grantPicks[permission]"
                  @click="grantPermission(permission)"
                  >{{
                    busy === `permission-add-${permission}`
                      ? 'Granting…'
                      : 'Grant'
                  }}</Button
                >
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <ConfirmDialog
      :open="confirmingDeleteGroup !== null"
      tier="disruptive"
      title="Delete this group?"
      :description="`Members of ${confirmingDeleteGroup} lose whatever access this group grants.`"
      confirm-label="Delete"
      :busy="busy === `delete-group-${confirmingDeleteGroup}`"
      @confirm="confirmDeleteGroup(confirmingDeleteGroup!)"
      @cancel="cancelDeleteGroup"
    />
  </PageLayout>
</template>
