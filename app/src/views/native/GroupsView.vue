<script setup lang="ts">
import { computed, ref } from 'vue'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import PeopleSectionNav from '@/components/native/PeopleSectionNav.vue'

const { success, danger } = useNotifications()

const CORE_GROUPS = new Set(['all_users', 'visitors', 'admins'])

const groups = ref<Record<string, UserGroup>>({})
const permissions = ref<Record<string, PermissionInfo>>({})
const usernames = ref<string[]>([])

const busy = ref('')
const { run } = useActionRunner(busy, '')

const groupNames = computed(() => Object.keys(groups.value).sort())
const permissionNames = computed(() => Object.keys(permissions.value).sort())

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  const [groupResult, permissionResult, userResult] = await Promise.all([
    getGroups(),
    getPermissions(true),
    listUsers(),
  ])
  groups.value = groupResult
  permissions.value = permissionResult.permissions
  usernames.value = Object.keys(userResult.users).sort()
}, 'Failed to load groups.')

// -- create group -------------------------------------------------------------

const showCreateGroup = ref(false)
const createGroupname = ref('')
const { pending: confirmingCreateGroup, request: requestCreateGroupConfirm } =
  useConfirm(false)

function requestCreateGroup() {
  if (!createGroupname.value.trim()) {
    danger('Enter a group name.')
    return
  }
  requestCreateGroupConfirm(true)
}

async function confirmCreateGroup() {
  confirmingCreateGroup.value = false
  await run(
    'create-group',
    async () => {
      await sync()
      const result = await createGroup(createGroupname.value.trim())
      success(
        `Group creation submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      createGroupname.value = ''
      showCreateGroup.value = false
      await load()
    },
    'Failed to create group.',
  )
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
  await run(
    `member-add-${groupname}`,
    async () => {
      await sync()
      const result = await updateGroup(groupname, { add: [username] })
      success(
        `Added ${username} to ${groupname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      memberPicks.value[groupname] = ''
      await load()
    },
    `Failed to add ${username} to ${groupname}.`,
  )
}

const {
  pending: confirmingRemoveMember,
  request: requestRemoveMemberConfirm,
  cancel: cancelRemoveMember,
} = useConfirm<string | null>(null)

function memberKey(groupname: string, username: string) {
  return `${groupname}:${username}`
}

function requestRemoveMember(groupname: string, username: string) {
  requestRemoveMemberConfirm(memberKey(groupname, username))
}

const pendingRemoveMember = computed(() => {
  const key = confirmingRemoveMember.value
  if (!key) return null
  const separator = key.indexOf(':')
  return {
    groupname: key.slice(0, separator),
    username: key.slice(separator + 1),
  }
})

async function confirmRemoveMember(groupname: string, username: string) {
  confirmingRemoveMember.value = null
  const key = memberKey(groupname, username)
  await run(
    `member-remove-${key}`,
    async () => {
      await sync()
      const result = await updateGroup(groupname, { remove: [username] })
      success(
        `Revoked ${username}'s access via ${groupname}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to revoke ${username}'s access via ${groupname}.`,
  )
}

// -- delete group ---------------------------------------------------------

const {
  pending: confirmingDeleteGroup,
  request: requestDeleteGroupConfirm,
  cancel: cancelDeleteGroup,
} = useConfirm<string | null>(null)

function requestDeleteGroup(groupname: string) {
  requestDeleteGroupConfirm(groupname)
}

async function confirmDeleteGroup(groupname: string) {
  confirmingDeleteGroup.value = null
  await run(
    `delete-group-${groupname}`,
    async () => {
      await sync()
      const result = await deleteGroup(groupname)
      success(
        `Deletion of ${groupname} submitted.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to delete ${groupname}.`,
  )
}

// -- grant/revoke permission ------------------------------------------------

const grantPicks = ref<Record<string, string>>({})

async function grantPermission(permission: string) {
  const name = grantPicks.value[permission]
  if (!name) return
  await run(
    `permission-add-${permission}`,
    async () => {
      await sync()
      const result = await addPermission(permission, [name])
      success(
        `Granted ${name} access to ${permission}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      grantPicks.value[permission] = ''
      await load()
    },
    `Failed to grant access to ${permission}.`,
  )
}

const {
  pending: confirmingRevoke,
  request: requestRevokeConfirm,
  cancel: cancelRevoke,
} = useConfirm<string | null>(null)

function revokeKey(permission: string, name: string) {
  return `${permission}:${name}`
}

function requestRevoke(permission: string, name: string) {
  requestRevokeConfirm(revokeKey(permission, name))
}

const pendingRevoke = computed(() => {
  const key = confirmingRevoke.value
  if (!key) return null
  const separator = key.indexOf(':')
  return { permission: key.slice(0, separator), name: key.slice(separator + 1) }
})

async function confirmRevoke(permission: string, name: string) {
  confirmingRevoke.value = null
  const key = revokeKey(permission, name)
  await run(
    `permission-remove-${key}`,
    async () => {
      await sync()
      const result = await removePermission(permission, [name])
      success(
        `Revoked ${name} access to ${permission}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to revoke access to ${permission}.`,
  )
}

// -- update permission label/tile --------------------------------------------

const editingPermission = ref<string | null>(null)
const editLabel = ref('')
const editShowTile = ref(false)

function startEditPermission(permission: string, info: PermissionInfo) {
  editingPermission.value = permission
  editLabel.value = info.label
  editShowTile.value = Boolean(info.show_tile)
}

function cancelEditPermission() {
  editingPermission.value = null
}

async function saveEditPermission(permission: string) {
  await run(
    `permission-update-${permission}`,
    async () => {
      await sync()
      const result = await updatePermission(permission, {
        label: editLabel.value.trim(),
        show_tile: editShowTile.value,
      })
      success(
        `Updated ${permission}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      editingPermission.value = null
      await load()
    },
    `Failed to update ${permission}.`,
  )
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="People"
      title="Access groups"
      description="Choose which groups can use each application. Changes ask for confirmation first."
    />
    <PeopleSectionNav />

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
                  <button
                    type="button"
                    class="tw:ml-1 tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs tw:text-muted-foreground"
                    :disabled="busy !== ''"
                    @click="requestRemoveMember(groupname, member)"
                  >
                    revoke
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
                  <RouterLink
                    v-if="permission.endsWith('.main')"
                    :to="{ name: 'app-management' }"
                    class="tw:ml-2 tw:text-xs tw:font-medium tw:text-brand-500 tw:no-underline tw:hover:underline"
                    >Manage in Applications →</RouterLink
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
                  <button
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
    <ConfirmDialog
      :open="confirmingRemoveMember !== null"
      tier="disruptive"
      title="Revoke this member's access?"
      :description="`${pendingRemoveMember?.username} loses whatever access ${pendingRemoveMember?.groupname} grants.`"
      confirm-label="Revoke"
      :busy="busy === `member-remove-${confirmingRemoveMember}`"
      @confirm="
        confirmRemoveMember(
          pendingRemoveMember!.groupname,
          pendingRemoveMember!.username,
        )
      "
      @cancel="cancelRemoveMember"
    />
    <ConfirmDialog
      :open="confirmingRevoke !== null"
      tier="disruptive"
      title="Revoke this group's access?"
      :description="`${pendingRevoke?.name} loses access to ${pendingRevoke?.permission}.`"
      confirm-label="Revoke"
      :busy="busy === `permission-remove-${confirmingRevoke}`"
      @confirm="confirmRevoke(pendingRevoke!.permission, pendingRevoke!.name)"
      @cancel="cancelRevoke"
    />
  </PageLayout>
</template>
