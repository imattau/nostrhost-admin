<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { getDomains } from '@/api/nativeDomains'
import { linkIdentity } from '@/api/nativeIdentity'
import { getIdentities, type Identity } from '@/api/nativeSystem'
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
import { Select } from '@/components/ui/select'
import { useSigner } from '@/composables/useSigner'
import IdentityFields from '@/components/native/IdentityFields.vue'
import {
  defaultIdentitySelection,
  type IdentitySelection,
} from '@/components/native/identitySelection'
import { shortenKey } from '@/lib/utils'

const { publicKey, signerAvailable, sync } = useSigner()

type UserRow = NativeUser & { username: string }

const users = ref<UserRow[] | null>(null)
const identities = ref<Identity[] | null>(null)
const domains = ref<string[]>([])
const error = ref('')
const loading = ref(false)

const identityByUsername = computed(() => {
  const map = new Map<string, Identity>()
  for (const identity of identities.value ?? []) {
    if (!map.has(identity.username)) map.set(identity.username, identity)
  }
  return map
})

// System accounts need a Unix password to exist (the OS requires a shadow
// entry), but nothing about signing in to this console is password-based —
// that's always Nostr. So NostrHost never asks an admin to invent one: it
// generates a strong random password itself, both on creation and whenever
// one is rotated. The 24-char length and one-of-each-class construction
// clear even YunoHost's strictest password-strength profile regardless of
// server config.
function randomInt(max: number): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % max
}

function generateSystemPassword(length = 24): string {
  const pools = [
    'abcdefghijkmnopqrstuvwxyz',
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    '23456789',
    '!@#$%^&*()-_=+',
  ]
  const all = pools.join('')
  const chars = pools.map((pool) => pool[randomInt(pool.length)])
  while (chars.length < length) chars.push(all[randomInt(all.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

const createUsername = ref('')
const createDomain = ref('')
const createFullname = ref('')
const createIdentity = ref<IdentitySelection>(defaultIdentitySelection())
const creating = ref(false)
const createError = ref('')
const createIdentityNotice = ref('')

const editPending = ref<string | null>(null)
const editFullname = ref('')
const editing = ref(false)
const editError = ref('')

const deletePending = ref<string | null>(null)
const deletePurge = ref(false)
const deleting = ref(false)
const deleteError = ref('')

const linkPending = ref<string | null>(null)
const linkSelection = ref<IdentitySelection>(defaultIdentitySelection())
const linking = ref(false)
const linkError = ref('')

const rotatePending = ref<string | null>(null)
const rotating = ref(false)
const rotateError = ref('')
const revealedPassword = ref<{ username: string; password: string } | null>(
  null,
)
const passwordCopied = ref(false)

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
    const [userResult, identityResult, domainResult] = await Promise.all([
      listUsers(),
      getIdentities(),
      getDomains(),
    ])
    users.value = Object.entries(userResult.users).map(([username, info]) => ({
      ...info,
      username,
    }))
    identities.value = identityResult
    domains.value = domainResult.domains
    if (!createDomain.value && domains.value.length) {
      createDomain.value = domains.value[0]
    }
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
  createIdentityNotice.value = ''
  try {
    await sync()
    const username = createUsername.value.trim()
    await createUser({
      username,
      domain: createDomain.value.trim(),
      password: generateSystemPassword(),
      fullname: createFullname.value.trim(),
    })
    createUsername.value = ''
    createDomain.value = domains.value[0] ?? ''
    createFullname.value = ''

    const identity = createIdentity.value
    createIdentity.value = defaultIdentitySelection()
    if (identity.mode !== 'none') {
      try {
        await linkIdentity({
          username,
          pubkeyOrNpub: identity.pubkeyOrNpub.trim(),
          signerType: identity.signerType,
          label: identity.label.trim() || undefined,
        })
      } catch (cause) {
        createIdentityNotice.value = `User "${username}" was created, but linking the Nostr identity failed: ${
          cause instanceof Error ? cause.message : 'unknown error'
        }. Use "Link identity" below to retry.`
      }
    }
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

function askLink(username: string) {
  linkError.value = ''
  linkSelection.value = {
    ...defaultIdentitySelection(),
    mode: 'existing',
    ready: false,
  }
  linkPending.value = username
}

function cancelLink() {
  linkPending.value = null
}

async function confirmLink(username: string) {
  linking.value = true
  linkError.value = ''
  try {
    await sync()
    const selection = linkSelection.value
    await linkIdentity({
      username,
      pubkeyOrNpub: selection.pubkeyOrNpub.trim(),
      signerType: selection.signerType,
      label: selection.label.trim() || undefined,
    })
    linkPending.value = null
    await load()
  } catch (cause) {
    linkError.value =
      cause instanceof Error ? cause.message : 'Failed to link identity.'
  } finally {
    linking.value = false
  }
}

function askRotate(username: string) {
  rotateError.value = ''
  revealedPassword.value = null
  rotatePending.value = username
}

function cancelRotate() {
  rotatePending.value = null
}

async function confirmRotate(username: string) {
  rotating.value = true
  rotateError.value = ''
  try {
    await sync()
    const password = generateSystemPassword()
    await updateUser({ username, changePassword: password })
    revealedPassword.value = { username, password }
    rotatePending.value = null
  } catch (cause) {
    rotateError.value =
      cause instanceof Error ? cause.message : 'Failed to rotate password.'
  } finally {
    rotating.value = false
  }
}

async function copyRevealedPassword() {
  if (!revealedPassword.value) return
  try {
    await navigator.clipboard.writeText(revealedPassword.value.password)
    passwordCopied.value = true
    setTimeout(() => {
      passwordCopied.value = false
    }, 2000)
  } catch {
    // Clipboard API unavailable (e.g. insecure context) — the password is
    // still visible on screen to copy by hand.
  }
}

function dismissRevealedPassword() {
  revealedPassword.value = null
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-5xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        Account administration
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">Users</h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Create, edit and delete server accounts, and optionally link or generate
        a Nostr identity for each one. A pubkey can also be linked or revoked
        later from the Identities screen.
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
        <form class="tw:grid tw:gap-6" @submit.prevent="submitCreate">
          <div class="tw:grid tw:gap-4">
            <div>
              <p
                class="tw:m-0 tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-muted-foreground"
              >
                System account
              </p>
              <p class="tw:mt-1 tw:text-xs tw:text-muted-foreground">
                This provisions a real Unix account on the server, separate from
                signing in to this console (which always uses Nostr). NostrHost
                generates a strong system password automatically — there's
                nothing to type, and it's never needed to sign in here. If an
                account ever needs direct system-level access (e.g. SSH), rotate
                its system password from the account list below.
              </p>
            </div>
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
            <div class="tw:grid tw:gap-1.5 tw:sm:max-w-xs">
              <Label for="create-domain">Domain</Label>
              <Select id="create-domain" v-model="createDomain" required>
                <option v-if="!domains.length" value="" disabled>
                  No domains available
                </option>
                <option v-for="domain in domains" :key="domain" :value="domain">
                  {{ domain }}
                </option>
              </Select>
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                The domain this account is provisioned under.
                <RouterLink
                  :to="{ name: 'native-domains' }"
                  class="tw:text-brand-500 tw:no-underline tw:hover:underline"
                  >Manage domains</RouterLink
                >
              </p>
            </div>
          </div>

          <div
            class="tw:grid tw:gap-4 tw:border-t tw:border-border-subtle tw:pt-4"
          >
            <div>
              <p
                class="tw:m-0 tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-muted-foreground"
              >
                Nostr identity (optional)
              </p>
              <p class="tw:mt-1 tw:text-xs tw:text-muted-foreground">
                Link this account to a pubkey it already controls, or generate a
                new keypair for it now.
              </p>
            </div>
            <IdentityFields
              v-model="createIdentity"
              id-prefix="create-identity"
            />
          </div>

          <Alert v-if="createError" variant="danger" role="alert">{{
            createError
          }}</Alert>
          <Alert v-if="createIdentityNotice" variant="warning" role="status">{{
            createIdentityNotice
          }}</Alert>
          <div>
            <Button
              type="submit"
              variant="primary"
              :disabled="creating || !createIdentity.ready"
              >{{ creating ? 'Creating…' : 'Create user' }}</Button
            >
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
            <div
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3"
            >
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

            <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <template v-if="identityByUsername.get(user.username)">
                <Badge
                  :variant="
                    identityByUsername.get(user.username)!.enabled
                      ? 'success'
                      : 'neutral'
                  "
                  >{{
                    identityByUsername.get(user.username)!.enabled
                      ? 'Nostr linked'
                      : 'Nostr disabled'
                  }}</Badge
                >
                <code
                  class="tw:font-mono tw:text-xs tw:text-muted-foreground"
                  >{{
                    shortenKey(identityByUsername.get(user.username)!.pubkey)
                  }}</code
                >
                <RouterLink
                  :to="{ name: 'native-identities' }"
                  class="tw:text-xs tw:text-brand-500 tw:no-underline tw:hover:underline"
                  >Manage in Identities</RouterLink
                >
              </template>
              <template v-else>
                <Badge variant="neutral">No Nostr identity</Badge>
              </template>
            </div>

            <template v-if="editPending === user.username">
              <div class="tw:grid tw:gap-1.5 tw:sm:max-w-xs">
                <Label :for="`edit-fullname-${user.username}`">Full name</Label>
                <Input
                  :id="`edit-fullname-${user.username}`"
                  v-model="editFullname"
                  autocomplete="off"
                />
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

            <template v-else-if="linkPending === user.username">
              <div class="tw:rounded-lg tw:bg-surface-muted tw:p-3">
                <IdentityFields
                  v-model="linkSelection"
                  :id-prefix="`link-${user.username}`"
                  :allow-none="false"
                />
              </div>
              <Alert v-if="linkError" variant="danger" role="alert">{{
                linkError
              }}</Alert>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelLink"
                  >Cancel</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="linking || !linkSelection.ready"
                  @click="confirmLink(user.username)"
                  >{{ linking ? 'Linking…' : 'Link identity' }}</Button
                >
              </div>
            </template>

            <template v-else-if="rotatePending === user.username">
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Generate a new system password for {{ user.username }}? It's
                never needed to sign in to this console — only for direct
                system-level access (e.g. SSH).
              </p>
              <Alert v-if="rotateError" variant="danger" role="alert">{{
                rotateError
              }}</Alert>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelRotate"
                  >Cancel</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="rotating"
                  @click="confirmRotate(user.username)"
                  >{{ rotating ? 'Rotating…' : 'Confirm rotate' }}</Button
                >
              </div>
            </template>

            <template v-else-if="revealedPassword?.username === user.username">
              <div
                class="tw:grid tw:gap-2 tw:rounded-lg tw:bg-surface-muted tw:p-3"
              >
                <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                  New system password for {{ user.username }} — shown once, copy
                  it now.
                </p>
                <div class="tw:flex tw:items-center tw:gap-2">
                  <code
                    class="tw:flex-1 tw:overflow-x-auto tw:rounded tw:border tw:border-border-subtle tw:bg-surface tw:px-2 tw:py-1.5 tw:font-mono tw:text-xs"
                    >{{ revealedPassword?.password }}</code
                  >
                  <Button
                    variant="outline"
                    size="sm"
                    @click="copyRevealedPassword"
                    >{{ passwordCopied ? 'Copied' : 'Copy' }}</Button
                  >
                </div>
                <div class="tw:flex tw:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    @click="dismissRevealedPassword"
                    >Done</Button
                  >
                </div>
              </div>
            </template>

            <div v-else class="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
              <Button
                v-if="!identityByUsername.get(user.username)"
                variant="outline"
                size="sm"
                @click="askLink(user.username)"
                >Link identity</Button
              >
              <Button variant="outline" size="sm" @click="askEdit(user)"
                >Edit</Button
              >
              <Button
                variant="outline"
                size="sm"
                @click="askRotate(user.username)"
                >Rotate system password</Button
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
