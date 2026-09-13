<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  createUser,
  deleteUser,
  listUsers,
  updateUser,
  type NativeUser,
} from '@/api/nativeUsers'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

type UserRow = NativeUser & { username: string }

const users = ref<UserRow[] | null>(null)
const error = ref('')
const loading = ref(false)

const createUsername = ref('')
const createDomain = ref('')
const createPassword = ref('')
const createFullname = ref('')
const creating = ref(false)
const createError = ref('')

const editPending = ref<string | null>(null)
const editFullname = ref('')
const editPassword = ref('')
const editing = ref(false)
const editError = ref('')

const deletePending = ref<string | null>(null)
const deletePurge = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const sortedUsers = computed(() =>
  (users.value ?? [])
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username)),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const result = await listUsers()
    users.value = Object.entries(result.users).map(([username, info]) => ({
      ...info,
      username,
    }))
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load users.'
  } finally {
    loading.value = false
  }
}

async function submitCreate() {
  creating.value = true
  createError.value = ''
  try {
    await sync()
    await createUser({
      username: createUsername.value.trim(),
      domain: createDomain.value.trim(),
      password: createPassword.value,
      fullname: createFullname.value.trim(),
    })
    createUsername.value = ''
    createDomain.value = ''
    createPassword.value = ''
    createFullname.value = ''
    await load()
  } catch (cause) {
    createError.value =
      cause instanceof Error ? cause.message : 'Failed to create user.'
  } finally {
    creating.value = false
  }
}

function askEdit(user: UserRow) {
  editError.value = ''
  editPassword.value = ''
  editFullname.value = user.fullname ?? ''
  editPending.value = user.username
}

function cancelEdit() {
  editPending.value = null
}

async function confirmEdit(username: string) {
  editing.value = true
  editError.value = ''
  try {
    await sync()
    await updateUser({
      username,
      fullname: editFullname.value.trim() || undefined,
      changePassword: editPassword.value || undefined,
    })
    editPending.value = null
    await load()
  } catch (cause) {
    editError.value =
      cause instanceof Error ? cause.message : 'Failed to update user.'
  } finally {
    editing.value = false
  }
}

function askDelete(username: string) {
  deleteError.value = ''
  deletePurge.value = false
  deletePending.value = username
}

function cancelDelete() {
  deletePending.value = null
}

async function confirmDelete(username: string) {
  deleting.value = true
  deleteError.value = ''
  try {
    await sync()
    await deleteUser({ username, purge: deletePurge.value })
    deletePending.value = null
    await load()
  } catch (cause) {
    deleteError.value =
      cause instanceof Error ? cause.message : 'Failed to delete user.'
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        Account administration
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">Users</h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Create, edit and delete server accounts. A user's Nostr identity is
        linked separately from the Identities screen once the account exists
        here.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Create a user</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="tw:grid tw:gap-4" @submit.prevent="submitCreate">
          <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="create-username">Username</Label>
              <Input
                id="create-username"
                v-model="createUsername"
                required
                autocomplete="off"
              />
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="create-fullname">Full name</Label>
              <Input
                id="create-fullname"
                v-model="createFullname"
                required
                autocomplete="off"
              />
            </div>
          </div>
          <div class="tw:grid tw:gap-4 tw:sm:grid-cols-2">
            <div class="tw:grid tw:gap-1.5">
              <Label for="create-domain">Mail domain</Label>
              <Input
                id="create-domain"
                v-model="createDomain"
                required
                autocomplete="off"
                placeholder="example.com"
              />
            </div>
            <div class="tw:grid tw:gap-1.5">
              <Label for="create-password">Password</Label>
              <Input
                id="create-password"
                v-model="createPassword"
                type="password"
                required
                autocomplete="new-password"
              />
            </div>
          </div>
          <Alert v-if="createError" variant="danger" role="alert">{{
            createError
          }}</Alert>
          <div>
            <Button type="submit" variant="primary" :disabled="creating">{{
              creating ? 'Creating…' : 'Create user'
            }}</Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle class="tw:flex tw:items-center tw:justify-between tw:gap-2">
          <span>Accounts</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="loading"
            @click="load"
            >{{ loading ? 'Refreshing…' : 'Refresh' }}</Button
          >
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul v-if="sortedUsers.length" class="tw:grid tw:gap-2">
          <li
            v-for="user in sortedUsers"
            :key="user.username"
            class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <strong class="tw:text-sm tw:text-foreground">{{
                user.username
              }}</strong>
              <Badge
                v-if="(user.groups ?? []).includes('admins')"
                variant="success"
                >Admin</Badge
              >
            </div>
            <span class="tw:text-xs tw:text-muted-foreground"
              >{{ user.fullname
              }}<template v-if="user.mail"> · {{ user.mail }}</template></span
            >

            <template v-if="editPending === user.username">
              <div class="tw:grid tw:gap-3 tw:sm:grid-cols-2">
                <div class="tw:grid tw:gap-1.5">
                  <Label :for="`edit-fullname-${user.username}`"
                    >Full name</Label
                  >
                  <Input
                    :id="`edit-fullname-${user.username}`"
                    v-model="editFullname"
                    autocomplete="off"
                  />
                </div>
                <div class="tw:grid tw:gap-1.5">
                  <Label :for="`edit-password-${user.username}`"
                    >New password (optional)</Label
                  >
                  <Input
                    :id="`edit-password-${user.username}`"
                    v-model="editPassword"
                    type="password"
                    autocomplete="new-password"
                  />
                </div>
              </div>
              <Alert v-if="editError" variant="danger" role="alert">{{
                editError
              }}</Alert>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelEdit"
                  >Cancel</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="editing"
                  @click="confirmEdit(user.username)"
                  >{{ editing ? 'Saving…' : 'Save' }}</Button
                >
              </div>
            </template>

            <template v-else-if="deletePending === user.username">
              <label
                class="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground"
              >
                <input v-model="deletePurge" type="checkbox" />
                Also purge the account's data
              </label>
              <Alert v-if="deleteError" variant="danger" role="alert">{{
                deleteError
              }}</Alert>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelDelete"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="deleting"
                  @click="confirmDelete(user.username)"
                  >{{ deleting ? 'Deleting…' : 'Confirm delete' }}</Button
                >
              </div>
            </template>

            <div v-else class="tw:flex tw:justify-end tw:gap-2">
              <Button variant="outline" size="sm" @click="askEdit(user)"
                >Edit</Button
              >
              <Button
                variant="outline"
                size="sm"
                @click="askDelete(user.username)"
                >Delete</Button
              >
            </div>
          </li>
        </ul>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Loading…' : 'No users yet.' }}
        </p>
      </CardContent>
    </Card>
  </section>
</template>
