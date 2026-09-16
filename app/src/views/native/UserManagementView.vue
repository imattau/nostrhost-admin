<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useActionRunner } from '@/composables/useActionRunner'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import { toErrorMessage } from '@/utils/errors'
import IdentityFields from '@/components/native/IdentityFields.vue'
import {
  defaultIdentitySelection,
  type IdentitySelection,
} from '@/components/native/identitySelection'
import { shortenKey } from '@/lib/utils'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import EmptyState from '@/components/native/EmptyState.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import PeopleSectionNav from '@/components/native/PeopleSectionNav.vue'
import InspectorPane from '@/components/native/InspectorPane.vue'
import ResourceList from '@/components/native/ResourceList.vue'

const { success, warning } = useNotifications()
const route = useRoute()
const router = useRouter()

type UserRow = NativeUser & { username: string }

const users = ref<UserRow[] | null>(null)
const identities = ref<Identity[] | null>(null)
const domains = ref<string[]>([])

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
const { run: runCreate } = useActionRunner(creating, false)

const editPending = ref<string | null>(null)
const editFullname = ref('')
const editing = ref(false)
const { run: runEdit } = useActionRunner(editing, false)

const {
  pending: deletePending,
  request: askDeleteConfirm,
  cancel: cancelDelete,
} = useConfirm<string | null>(null)
const deletePurge = ref(false)
const deleting = ref(false)
const { run: runDelete } = useActionRunner(deleting, false)

const linkPending = ref<string | null>(null)
const linkSelection = ref<IdentitySelection>(defaultIdentitySelection())
const linking = ref(false)
const { run: runLink } = useActionRunner(linking, false)

const rotatePending = ref<string | null>(null)
const rotating = ref(false)
const { run: runRotate } = useActionRunner(rotating, false)
const revealedPassword = ref<{ username: string; password: string } | null>(
  null,
)
const passwordCopied = ref(false)

const sortedUsers = computed(() =>
  (users.value ?? [])
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username)),
)
const selectedUsername = ref(
  typeof route.query.person === 'string' ? route.query.person : '',
)
const selectedUser = computed(
  () =>
    sortedUsers.value.find(
      (user) => user.username === selectedUsername.value,
    ) ??
    sortedUsers.value[0] ??
    null,
)

async function selectPerson(username: string) {
  selectedUsername.value = username
  await router.replace({ query: { ...route.query, person: username } })
}

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
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
  if (!selectedUsername.value && sortedUsers.value.length) {
    await selectPerson(sortedUsers.value[0].username)
  }
}, 'Failed to load users.')

async function submitCreate() {
  await runCreate(
    true,
    async () => {
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
          success(`Created user "${username}" and linked its Nostr identity.`)
        } catch (cause) {
          warning(
            `User "${username}" was created, but linking the Nostr identity failed: ${toErrorMessage(cause, 'unknown error')}. Use "Link identity" below to retry.`,
          )
        }
      } else {
        success(`Created user "${username}".`)
      }
      await load()
    },
    'Failed to create user.',
  )
}

function askEdit(user: UserRow) {
  editFullname.value = user.fullname ?? ''
  editPending.value = user.username
}

function cancelEdit() {
  editPending.value = null
}

async function confirmEdit(username: string) {
  await runEdit(
    true,
    async () => {
      await sync()
      await updateUser({
        username,
        fullname: editFullname.value.trim() || undefined,
      })
      editPending.value = null
      success(`Updated ${username}.`)
      await load()
    },
    'Failed to update user.',
  )
}

function askDelete(username: string) {
  deletePurge.value = false
  askDeleteConfirm(username)
}

async function confirmDelete(username: string) {
  await runDelete(
    true,
    async () => {
      await sync()
      await deleteUser({ username, purge: deletePurge.value })
      deletePending.value = null
      success(`Deleted ${username}.`)
      await load()
    },
    'Failed to delete user.',
  )
}

function askLink(username: string) {
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
  await runLink(
    true,
    async () => {
      await sync()
      const selection = linkSelection.value
      await linkIdentity({
        username,
        pubkeyOrNpub: selection.pubkeyOrNpub.trim(),
        signerType: selection.signerType,
        label: selection.label.trim() || undefined,
      })
      linkPending.value = null
      success(`Linked a Nostr identity to ${username}.`)
      await load()
    },
    'Failed to link identity.',
  )
}

function askRotate(username: string) {
  revealedPassword.value = null
  rotatePending.value = username
}

function cancelRotate() {
  rotatePending.value = null
}

async function confirmRotate(username: string) {
  await runRotate(
    true,
    async () => {
      await sync()
      const password = generateSystemPassword()
      await updateUser({ username, changePassword: password })
      revealedPassword.value = { username, password }
      rotatePending.value = null
    },
    'Failed to rotate password.',
  )
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
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="People"
      title="People"
      description="Manage each person's server account, Nostr identity and access from one area."
    />
    <PeopleSectionNav />

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

    <div
      v-if="publicKey && sortedUsers.length"
      class="tw:grid tw:gap-0 tw:border-y tw:border-border-subtle tw:lg:grid-cols-[260px_minmax(0,1fr)]"
    >
      <ResourceList
        label="People"
        class="tw:border-b tw:border-border-subtle tw:lg:border-b-0 tw:lg:border-r"
      >
        <button
          v-for="user in sortedUsers"
          :key="user.username"
          type="button"
          class="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-3 tw:border-0 tw:border-b tw:border-border-subtle tw:bg-transparent tw:px-4 tw:py-3 tw:text-left tw:text-sm"
          :class="
            selectedUser?.username === user.username
              ? 'tw:bg-selection tw:font-semibold'
              : 'tw:hover:bg-surface-muted'
          "
          @click="selectPerson(user.username)"
        >
          <span>
            <span class="tw:block">{{ user.fullname || user.username }}</span>
            <span
              class="tw:block tw:font-mono tw:text-xs tw:font-normal tw:text-muted-foreground"
              >{{ user.username }}</span
            >
          </span>
          <span class="tw:text-xs tw:text-muted-foreground">{{
            identityByUsername.get(user.username)
              ? 'Nostr linked'
              : 'No identity'
          }}</span>
        </button>
      </ResourceList>

      <InspectorPane
        v-if="selectedUser"
        :label="`Details for ${selectedUser.username}`"
        class="tw:p-5"
      >
        <div class="tw:grid tw:gap-4">
          <div>
            <div
              class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3"
            >
              <strong class="tw:text-sm tw:text-foreground">{{
                selectedUser.username
              }}</strong>
              <Badge
                v-if="(selectedUser.groups ?? []).includes('admins')"
                variant="success"
                >Admin</Badge
              >
            </div>
            <span class="tw:text-xs tw:text-muted-foreground"
              >{{ selectedUser.fullname
              }}<template v-if="selectedUser.mail">
                · {{ selectedUser.mail }}</template
              ></span
            >
          </div>

          <section class="tw:border-t tw:border-border-subtle tw:pt-4">
            <h3 class="tw:m-0 tw:text-sm tw:font-semibold">Nostr identity</h3>
            <div class="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <template v-if="identityByUsername.get(selectedUser.username)">
                <Badge
                  :variant="
                    identityByUsername.get(selectedUser.username)!.enabled
                      ? 'success'
                      : 'neutral'
                  "
                  >{{
                    identityByUsername.get(selectedUser.username)!.enabled
                      ? 'Nostr linked'
                      : 'Nostr disabled'
                  }}</Badge
                >
                <code
                  class="tw:font-mono tw:text-xs tw:text-muted-foreground"
                  >{{
                    shortenKey(
                      identityByUsername.get(selectedUser.username)!.pubkey,
                    )
                  }}</code
                >
                <RouterLink
                  :to="{ name: 'native-identities' }"
                  class="workbench-link tw:text-xs"
                  >Manage identities →</RouterLink
                >
              </template>
              <Button
                v-else
                variant="outline"
                size="sm"
                @click="askLink(selectedUser.username)"
                >Link identity</Button
              >
            </div>
          </section>

          <section class="tw:border-t tw:border-border-subtle tw:pt-4">
            <h3 class="tw:m-0 tw:text-sm tw:font-semibold">Account</h3>
            <template v-if="editPending === selectedUser.username">
              <div class="tw:grid tw:gap-1.5 tw:sm:max-w-xs">
                <Label :for="`edit-fullname-${selectedUser.username}`"
                  >Full name</Label
                >
                <Input
                  :id="`edit-fullname-${selectedUser.username}`"
                  v-model="editFullname"
                  autocomplete="off"
                />
              </div>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelEdit"
                  >Cancel</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="editing"
                  @click="confirmEdit(selectedUser.username)"
                  >{{ editing ? 'Saving…' : 'Save' }}</Button
                >
              </div>
            </template>

            <template v-else-if="linkPending === selectedUser.username">
              <div class="tw:rounded-lg tw:bg-surface-muted tw:p-3">
                <IdentityFields
                  v-model="linkSelection"
                  :id-prefix="`link-${selectedUser.username}`"
                  :allow-none="false"
                />
              </div>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelLink"
                  >Cancel</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="linking || !linkSelection.ready"
                  @click="confirmLink(selectedUser.username)"
                  >{{ linking ? 'Linking…' : 'Link identity' }}</Button
                >
              </div>
            </template>

            <template v-else-if="rotatePending === selectedUser.username">
              <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                Generate a new system password for {{ selectedUser.username }}?
                It's never needed to sign in to this console — only for direct
                system-level access (e.g. SSH).
              </p>
              <div class="tw:flex tw:justify-end tw:gap-2">
                <Button variant="outline" size="sm" @click="cancelRotate"
                  >Cancel</Button
                >
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="rotating"
                  @click="confirmRotate(selectedUser.username)"
                  >{{ rotating ? 'Rotating…' : 'Confirm rotate' }}</Button
                >
              </div>
            </template>

            <template
              v-else-if="revealedPassword?.username === selectedUser.username"
            >
              <div
                class="tw:grid tw:gap-2 tw:rounded-lg tw:bg-surface-muted tw:p-3"
              >
                <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
                  New system password for {{ selectedUser.username }} — shown
                  once, copy it now.
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
              <Button variant="outline" size="sm" @click="askEdit(selectedUser)"
                >Edit</Button
              >
              <Button
                variant="outline"
                size="sm"
                @click="askRotate(selectedUser.username)"
                >Rotate system password</Button
              >
              <Button
                variant="ghost"
                size="sm"
                @click="askDelete(selectedUser.username)"
                >Delete</Button
              >
            </div>
          </section>

          <section class="tw:border-t tw:border-border-subtle tw:pt-4">
            <h3 class="tw:m-0 tw:text-sm tw:font-semibold">Access</h3>
            <p class="tw:mb-0 tw:mt-2 tw:text-sm tw:text-muted-foreground">
              Groups:
              {{ (selectedUser.groups ?? []).join(', ') || 'No groups' }}.
              <RouterLink :to="{ name: 'native-groups' }" class="workbench-link"
                >Manage access →</RouterLink
              >
            </p>
          </section>
        </div>
      </InspectorPane>
    </div>
    <p v-else-if="loading" class="tw:text-sm tw:text-muted-foreground">
      Loading…
    </p>
    <EmptyState v-else-if="publicKey" title="No people yet" />

    <ConfirmDialog
      :open="deletePending !== null"
      tier="destructive"
      title="Delete this user?"
      description="This removes the account and its permission grants."
      confirm-label="Delete"
      :confirm-phrase="deletePending ?? undefined"
      :busy="deleting"
      @confirm="confirmDelete(deletePending!)"
      @cancel="cancelDelete"
    >
      <label
        class="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground"
      >
        <input v-model="deletePurge" type="checkbox" />
        Also delete the account's data
      </label>
    </ConfirmDialog>
  </PageLayout>
</template>
