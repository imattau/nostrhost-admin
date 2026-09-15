<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  applyCatalogueApp,
  applyChangeUrl,
  applyNativeAppSettings,
  getAppManagement,
  getNativeAppSettings,
  planCatalogueApp,
  planChangeUrl,
  planNativeAppSettings,
  type AppManagementEntry,
  type ChangeUrlPlan,
  type NativeAppSettings,
  type PackagePlan,
} from '@/api/nativePackages'
import {
  addPermission,
  getGroups,
  getPermissionInfo,
  removePermission,
  updatePermission,
  type PermissionInfo,
} from '@/api/nativeGroupsPermissions'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'
import { useNotifications } from '@/composables/useNotifications'
import { useSigner } from '@/composables/useSigner'
import { toErrorMessage } from '@/utils/errors'

type Filter =
  | 'all'
  | 'installed'
  | 'available'
  | 'version-differs'
  | 'installed-unlisted'
type Action = 'install' | 'upgrade' | 'remove' | 'settings' | 'change-url'

const { publicKey, sync } = useSigner()
const { success, danger } = useNotifications()

const apps = ref<AppManagementEntry[]>([])
const catalogueError = ref('')
const selected = ref<AppManagementEntry | null>(null)
const settings = ref<NativeAppSettings | null>(null)
const values = ref<Record<string, unknown>>({})
const plan = ref<PackagePlan | ChangeUrlPlan | null>(null)
const action = ref<Action | null>(null)
const newDomain = ref('')
const newPath = ref('')
const permission = ref<PermissionInfo | null>(null)
const groupNames = ref<string[]>([])
const editLabel = ref('')
const editShowTile = ref(false)
const grantPick = ref('')
const confirmingRevoke = ref<string | null>(null)
const filter = ref<Filter>('all')
const category = ref('all')
const search = ref('')
const busy = ref('')
const categories = computed(() => {
  const found = new Set<string>()
  for (const app of apps.value) {
    if (app.category) found.add(app.category)
  }
  return Array.from(found).sort()
})
const grantableGroups = computed(() =>
  groupNames.value.filter(
    (name) => !(permission.value?.allowed || []).includes(name),
  ),
)
const visibleApps = computed(() =>
  apps.value.filter((app) => {
    const matchesFilter =
      filter.value === 'all' ||
      app.status === filter.value ||
      (filter.value === 'installed' && app.installed)
    const matchesCategory =
      category.value === 'all' || app.category === category.value
    const needle = search.value.trim().toLocaleLowerCase()
    const matchesSearch =
      !needle ||
      `${app.name} ${app.id} ${app.description}`
        .toLocaleLowerCase()
        .includes(needle)
    return matchesFilter && matchesCategory && matchesSearch
  }),
)

async function loadApps() {
  busy.value = 'load'
  try {
    await sync()
    const inventory = await getAppManagement()
    apps.value = inventory.apps
    catalogueError.value = inventory.catalogue_error || ''
    if (selected.value) {
      selected.value =
        apps.value.find((item) => item.id === selected.value?.id) || null
    }
  } catch (cause) {
    danger(toErrorMessage(cause, 'Could not load applications.'))
  } finally {
    busy.value = ''
  }
}

onMounted(() => {
  if (publicKey.value) loadApps()
})
watch(publicKey, (key) => {
  if (key) loadApps()
})

async function loadPermission(app: AppManagementEntry) {
  try {
    permission.value = await getPermissionInfo(`${app.id}.main`)
    editLabel.value = permission.value.label
    editShowTile.value = Boolean(permission.value.show_tile)
  } catch {
    // This app has no `.main` permission (or it's not reachable yet) -
    // the General section just doesn't render for it.
    permission.value = null
  }
  if (groupNames.value.length === 0) {
    try {
      groupNames.value = Object.keys(await getGroups()).sort()
    } catch {
      // Non-fatal: the grant picker is just empty until a retry succeeds.
    }
  }
}

async function chooseApp(app: AppManagementEntry) {
  selected.value = app
  settings.value = null
  values.value = {}
  plan.value = null
  action.value = null
  newDomain.value = ''
  newPath.value = ''
  permission.value = null
  grantPick.value = ''
  confirmingRevoke.value = null
  if (!app.installed || !app.installation?.native) return
  busy.value = 'settings'
  try {
    settings.value = await getNativeAppSettings(app.id)
    values.value = { ...settings.value.values }
  } catch (cause) {
    danger(toErrorMessage(cause, 'Could not load app settings.'))
  } finally {
    busy.value = ''
  }
  await loadPermission(app)
}

async function saveGeneral() {
  if (!selected.value) return
  const appId = selected.value.id
  busy.value = 'general-save'
  try {
    await updatePermission(`${appId}.main`, {
      label: editLabel.value.trim(),
      show_tile: editShowTile.value,
    })
    success('App details updated.')
    await loadPermission(selected.value)
    await loadApps()
  } catch (cause) {
    danger(toErrorMessage(cause, 'Could not update app details.'))
  } finally {
    busy.value = ''
  }
}

async function grantGroup() {
  if (!selected.value || !grantPick.value) return
  const appId = selected.value.id
  const name = grantPick.value
  busy.value = 'general-grant'
  try {
    await addPermission(`${appId}.main`, [name])
    success(`Granted ${name} access.`)
    grantPick.value = ''
    await loadPermission(selected.value)
  } catch (cause) {
    danger(toErrorMessage(cause, `Could not grant ${name} access.`))
  } finally {
    busy.value = ''
  }
}

function requestRevokeGroup(name: string) {
  confirmingRevoke.value = name
}

function cancelRevokeGroup() {
  confirmingRevoke.value = null
}

async function confirmRevokeGroup(name: string) {
  if (!selected.value) return
  confirmingRevoke.value = null
  const appId = selected.value.id
  busy.value = `general-revoke-${name}`
  try {
    await removePermission(`${appId}.main`, [name])
    success(`Revoked ${name} access.`)
    await loadPermission(selected.value)
  } catch (cause) {
    danger(toErrorMessage(cause, `Could not revoke ${name} access.`))
  } finally {
    busy.value = ''
  }
}

function updateValue(key: string, event: Event, type: string) {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  if (type === 'boolean')
    values.value[key] = (target as HTMLInputElement).checked
  else if (type === 'integer' || type === 'number')
    values.value[key] = target.value === '' ? null : Number(target.value)
  else values.value[key] = target.value
}

async function previewLifecycle(
  nextAction: Exclude<Action, 'settings' | 'change-url'>,
) {
  if (!selected.value) return
  busy.value = `plan-${nextAction}`
  plan.value = null
  action.value = null
  try {
    plan.value = await planCatalogueApp(selected.value.id, nextAction)
    action.value = nextAction
  } catch (cause) {
    danger(toErrorMessage(cause, `Could not build ${nextAction} plan.`))
  } finally {
    busy.value = ''
  }
}

async function previewSettings() {
  if (!selected.value) return
  busy.value = 'plan-settings'
  plan.value = null
  action.value = null
  try {
    plan.value = await planNativeAppSettings(selected.value.id, values.value)
    action.value = 'settings'
  } catch (cause) {
    danger(toErrorMessage(cause, 'Could not build settings plan.'))
  } finally {
    busy.value = ''
  }
}

async function previewChangeUrl() {
  if (!selected.value) return
  busy.value = 'plan-change-url'
  plan.value = null
  action.value = null
  try {
    plan.value = await planChangeUrl(
      selected.value.id,
      newDomain.value,
      newPath.value,
    )
    action.value = 'change-url'
  } catch (cause) {
    danger(toErrorMessage(cause, 'Could not build change-url plan.'))
  } finally {
    busy.value = ''
  }
}

async function applyPlan() {
  if (!selected.value || !plan.value || !action.value) return
  const chosenAction = action.value
  busy.value = 'apply'
  try {
    const result =
      chosenAction === 'settings'
        ? await applyNativeAppSettings(
            selected.value.id,
            plan.value as PackagePlan,
            values.value,
          )
        : chosenAction === 'change-url'
          ? await applyChangeUrl(
              selected.value.id,
              newDomain.value,
              newPath.value,
              plan.value as ChangeUrlPlan,
            )
          : await applyCatalogueApp(
              selected.value.id,
              chosenAction,
              plan.value as PackagePlan,
            )
    const requestId = result.operation.request_id
    const actionLabel =
      chosenAction === 'settings'
        ? 'Settings saved'
        : chosenAction === 'change-url'
          ? 'App URL changed'
          : `App ${chosenAction} completed`
    success(`${actionLabel}.${requestId ? ` Operation ${requestId}` : ''}`)
    plan.value = null
    action.value = null
    await loadApps()
    if (selected.value?.installed && selected.value.installation?.native)
      await chooseApp(selected.value)
  } catch (cause) {
    danger(toErrorMessage(cause, `Could not apply ${chosenAction}.`))
  } finally {
    busy.value = ''
  }
}

function label(app: AppManagementEntry) {
  return app.status === 'available'
    ? 'Available'
    : app.status === 'version-differs'
      ? 'Version differs'
      : app.status === 'installed-unlisted'
        ? 'Installed · unlisted'
        : 'Installed'
}

function cancelPlan() {
  plan.value = null
  action.value = null
}
</script>

<template>
  <PageLayout width="workspace">
    <PageHeader
      eyebrow="NostrHost"
      title="Applications"
      description="Browse trusted releases and manage apps installed on this server."
    />

    <Alert v-if="catalogueError" variant="warning" role="status">
      The trusted catalogue is unavailable. Showing installed apps only.
      {{ catalogueError }}
    </Alert>
    <div
      v-if="publicKey"
      class="tw:grid tw:gap-5 tw:lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.8fr)]"
    >
      <section
        class="tw:space-y-3"
        aria-label="Application catalogue and installed apps"
      >
        <div class="tw:flex tw:flex-wrap tw:gap-2">
          <label class="tw:sr-only" for="app-search">Search applications</label>
          <input
            id="app-search"
            v-model="search"
            class="tw:min-w-48 tw:flex-1 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
            placeholder="Search apps"
          />
          <label class="tw:sr-only" for="app-filter">Filter applications</label>
          <select
            id="app-filter"
            v-model="filter"
            class="tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
          >
            <option value="all">All apps</option>
            <option value="installed">Installed</option>
            <option value="available">Not installed</option>
            <option value="version-differs">Version differs</option>
            <option value="installed-unlisted">Installed · unlisted</option>
          </select>
          <label class="tw:sr-only" for="app-category"
            >Filter by category</label
          >
          <select
            id="app-category"
            v-model="category"
            class="tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
          >
            <option value="all">All categories</option>
            <option v-for="item in categories" :key="item" :value="item">
              {{ item }}
            </option>
          </select>
          <Button variant="outline" :disabled="busy !== ''" @click="loadApps">{{
            busy === 'load' ? 'Loading…' : 'Refresh'
          }}</Button>
        </div>
        <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
          {{ visibleApps.length }} of {{ apps.length }} apps
        </p>
        <ul
          class="tw:m-0 tw:divide-y tw:divide-border-subtle tw:overflow-hidden tw:rounded-xl tw:border tw:border-border-subtle tw:bg-surface tw:p-0"
        >
          <li v-for="app in visibleApps" :key="app.id">
            <button
              class="tw:flex tw:w-full tw:items-start tw:gap-3 tw:border-0 tw:bg-transparent tw:p-4 tw:text-left tw:text-foreground tw:[font:inherit] tw:transition-colors tw:hover:bg-surface-muted tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500"
              :aria-pressed="selected?.id === app.id"
              @click="chooseApp(app)"
            >
              <span class="tw:min-w-0 tw:flex-1">
                <strong class="tw:block tw:text-sm">{{ app.name }}</strong>
                <code class="tw:text-xs tw:text-muted-foreground">{{
                  app.id
                }}</code>
                <span
                  v-if="app.category"
                  class="tw:ml-2 tw:text-xs tw:text-muted-foreground"
                  >· {{ app.category }}</span
                >
                <span
                  v-if="app.description"
                  class="tw:mt-1 tw:block tw:line-clamp-2 tw:text-xs tw:text-muted-foreground"
                  >{{ app.description }}</span
                >
              </span>
              <span
                class="tw:shrink-0 tw:rounded-full tw:bg-surface-muted tw:px-2 tw:py-1 tw:text-xs"
                >{{ label(app) }}</span
              >
            </button>
          </li>
          <li
            v-if="visibleApps.length === 0"
            class="tw:p-6 tw:text-center tw:text-sm tw:text-muted-foreground"
          >
            No apps match this filter.
          </li>
        </ul>
      </section>

      <aside
        class="tw:space-y-4 tw:rounded-xl tw:border tw:border-border-subtle tw:bg-surface tw:p-4"
        aria-label="Selected application details"
      >
        <template v-if="selected">
          <div>
            <p
              class="tw:mb-1 tw:font-mono tw:text-xs tw:uppercase tw:tracking-wider tw:text-muted-foreground"
            >
              {{ label(selected) }}
            </p>
            <h2 class="tw:m-0 tw:text-lg tw:font-semibold">
              {{ selected.name }}
            </h2>
            <p
              class="tw:mb-0 tw:mt-1 tw:font-mono tw:text-xs tw:text-muted-foreground"
            >
              {{ selected.id }}
            </p>
          </div>
          <dl
            class="tw:grid tw:grid-cols-[auto_1fr] tw:gap-x-3 tw:gap-y-1 tw:text-sm"
          >
            <dt v-if="selected.category" class="tw:text-muted-foreground">
              Category
            </dt>
            <dd v-if="selected.category" class="tw:m-0">
              {{ selected.category }}
            </dd>
            <dt class="tw:text-muted-foreground">Installed</dt>
            <dd class="tw:m-0">{{ selected.installed_version || 'No' }}</dd>
            <dt class="tw:text-muted-foreground">Catalogue</dt>
            <dd class="tw:m-0">
              {{ selected.catalogue_version || 'No current entry' }}
            </dd>
            <dt class="tw:text-muted-foreground">Source</dt>
            <dd class="tw:m-0 tw:break-all">
              {{
                selected.catalogue?.repository ||
                selected.installation?.source ||
                'Local installation'
              }}
            </dd>
          </dl>
          <div class="tw:flex tw:flex-wrap tw:gap-2">
            <Button
              v-if="selected.status === 'available'"
              :disabled="busy !== ''"
              @click="previewLifecycle('install')"
              >{{
                busy === 'plan-install' ? 'Building plan…' : 'Review install'
              }}</Button
            >
            <Button
              v-if="
                selected.status === 'version-differs' &&
                selected.installation?.native
              "
              variant="outline"
              :disabled="busy !== ''"
              @click="previewLifecycle('upgrade')"
              >{{
                busy === 'plan-upgrade'
                  ? 'Building plan…'
                  : 'Review catalogue version'
              }}</Button
            >
            <Button
              v-if="selected.installed && selected.installation?.native"
              variant="outline"
              :disabled="busy !== ''"
              @click="previewLifecycle('remove')"
              >{{
                busy === 'plan-remove' ? 'Building plan…' : 'Review removal'
              }}</Button
            >
          </div>

          <section
            v-if="selected.installed && permission"
            class="tw:space-y-3 tw:border-t tw:border-border-subtle tw:pt-4"
            aria-labelledby="general-title"
          >
            <div>
              <h3 id="general-title" class="tw:m-0 tw:text-base tw:font-semibold">
                General
              </h3>
              <p class="tw:mb-0 tw:mt-1 tw:text-xs tw:text-muted-foreground">
                Display name, portal tile, and who can access this app.
              </p>
            </div>
            <label class="tw:block tw:space-y-1">
              <span class="tw:block tw:text-sm tw:font-medium">Label</span>
              <Input v-model="editLabel" />
            </label>
            <label class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
              <input
                v-model="editShowTile"
                type="checkbox"
                class="tw:size-4 tw:accent-brand-500"
              />
              Show tile on the portal
            </label>
            <Button
              variant="outline"
              :disabled="busy !== '' || !editLabel.trim()"
              @click="saveGeneral"
              >{{ busy === 'general-save' ? 'Saving…' : 'Save' }}</Button
            >

            <div class="tw:space-y-2 tw:border-t tw:border-border-subtle tw:pt-3">
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-2">
                <Label>Access groups</Label>
                <RouterLink
                  :to="{ name: 'native-groups' }"
                  class="tw:text-xs tw:font-medium tw:text-brand-500 tw:no-underline tw:hover:underline"
                  >Manage in Groups &amp; permissions →</RouterLink
                >
              </div>
              <div class="tw:flex tw:flex-wrap tw:gap-2">
                <Badge
                  v-for="name in permission.allowed"
                  :key="name"
                  variant="brand"
                  class="tw:flex tw:items-center tw:gap-1"
                >
                  {{ name }}
                  <button
                    type="button"
                    class="tw:ml-1 tw:cursor-pointer tw:min-h-6 tw:min-w-6 tw:border-0 tw:bg-transparent tw:p-1 tw:font-mono tw:text-xs"
                    :disabled="busy !== ''"
                    @click="requestRevokeGroup(name)"
                  >
                    revoke
                  </button>
                </Badge>
                <span
                  v-if="permission.allowed.length === 0"
                  class="tw:text-xs tw:text-muted-foreground"
                  >No groups have access yet.</span
                >
              </div>
              <div class="tw:flex tw:items-center tw:gap-2">
                <Select
                  v-model="grantPick"
                  class="tw:h-8 tw:max-w-[220px] tw:text-xs"
                  aria-label="Grant access to"
                >
                  <option value="">Grant access to…</option>
                  <option
                    v-for="name in grantableGroups"
                    :key="name"
                    :value="name"
                  >
                    {{ name }}
                  </option>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="busy !== '' || !grantPick"
                  @click="grantGroup"
                  >{{
                    busy === 'general-grant' ? 'Granting…' : 'Grant'
                  }}</Button
                >
              </div>
            </div>
          </section>

          <section
            v-if="
              selected.installed &&
              selected.installation?.native &&
              selected.movable
            "
            class="tw:space-y-3 tw:border-t tw:border-border-subtle tw:pt-4"
            aria-labelledby="change-url-title"
          >
            <div>
              <h3
                id="change-url-title"
                class="tw:m-0 tw:text-base tw:font-semibold"
              >
                Change URL
              </h3>
              <p class="tw:mb-0 tw:mt-1 tw:text-xs tw:text-muted-foreground">
                Move this app to a different domain and path.
              </p>
            </div>
            <label class="tw:block tw:space-y-1">
              <span class="tw:block tw:text-sm tw:font-medium">Domain</span>
              <input
                v-model="newDomain"
                class="tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
                placeholder="example.com"
              />
            </label>
            <label class="tw:block tw:space-y-1">
              <span class="tw:block tw:text-sm tw:font-medium">Path</span>
              <input
                v-model="newPath"
                class="tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
                placeholder="/"
              />
            </label>
            <Button
              variant="outline"
              :disabled="busy !== '' || !newDomain"
              @click="previewChangeUrl"
              >{{
                busy === 'plan-change-url'
                  ? 'Building plan…'
                  : 'Review URL change'
              }}</Button
            >
          </section>

          <section
            v-if="selected.installed && !selected.installation?.native"
            class="tw:rounded-lg tw:bg-surface-muted tw:p-3 tw:text-sm"
          >
            This installation does not have a native package manifest. Native
            settings and lifecycle controls are unavailable for it.
          </section>

          <section
            v-if="selected.installed && selected.installation?.native"
            class="tw:space-y-3 tw:border-t tw:border-border-subtle tw:pt-4"
            aria-labelledby="settings-title"
          >
            <div>
              <h3
                id="settings-title"
                class="tw:m-0 tw:text-base tw:font-semibold"
              >
                Application settings
              </h3>
              <p class="tw:mb-0 tw:mt-1 tw:text-xs tw:text-muted-foreground">
                Changes are validated and previewed before the approved resource
                plan is applied.
              </p>
            </div>
            <p
              v-if="busy === 'settings'"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              Loading settings…
            </p>
            <p
              v-else-if="settings && settings.fields.length === 0"
              class="tw:m-0 tw:text-sm tw:text-muted-foreground"
            >
              This app has no configurable settings declared.
            </p>
            <div v-else-if="settings" class="tw:space-y-3">
              <label
                v-for="field in settings.fields"
                :key="field.key"
                class="tw:block tw:space-y-1"
              >
                <span class="tw:block tw:text-sm tw:font-medium">{{
                  field.label || field.key
                }}</span>
                <span
                  v-if="field.description"
                  class="tw:block tw:text-xs tw:text-muted-foreground"
                  >{{ field.description }}</span
                >
                <select
                  v-if="field.type === 'enum'"
                  class="tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
                  :value="values[field.key]"
                  @change="updateValue(field.key, $event, field.type)"
                >
                  <option
                    v-for="choice in field.choices || []"
                    :key="choice"
                    :value="choice"
                  >
                    {{ choice }}
                  </option>
                </select>
                <input
                  v-else-if="field.type === 'boolean'"
                  type="checkbox"
                  class="tw:size-4 tw:accent-brand-500"
                  :checked="Boolean(values[field.key])"
                  @change="updateValue(field.key, $event, field.type)"
                />
                <input
                  v-else
                  class="tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
                  :type="
                    field.type === 'integer' || field.type === 'number'
                      ? 'number'
                      : 'text'
                  "
                  :step="field.type === 'integer' ? '1' : 'any'"
                  :value="values[field.key]"
                  @input="updateValue(field.key, $event, field.type)"
                />
              </label>
              <Button :disabled="busy !== ''" @click="previewSettings">{{
                busy === 'plan-settings'
                  ? 'Building plan…'
                  : 'Review settings change'
              }}</Button>
            </div>
          </section>
        </template>
        <p v-else class="tw:m-0 tw:text-sm tw:text-muted-foreground">
          Select an app to see its catalogue and installation details.
        </p>
      </aside>
    </div>

    <section
      v-if="plan && action"
      class="tw:space-y-3 tw:rounded-xl tw:border tw:border-brand-300 tw:bg-surface tw:p-4"
      aria-labelledby="plan-title"
    >
      <div
        class="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-3"
      >
        <div>
          <h2 id="plan-title" class="tw:m-0 tw:text-base tw:font-semibold">
            Review {{ action }} plan · {{ plan.package.id }}
            {{ plan.package.version }}
          </h2>
          <p class="tw:mb-0 tw:mt-1 tw:text-sm tw:text-muted-foreground">
            {{ plan.operations.length }} resource operations · plan
            {{ plan.plan_sha256.slice(0, 16) }}…
          </p>
        </div>
        <Button variant="outline" :disabled="busy !== ''" @click="cancelPlan"
          >Cancel</Button
        >
      </div>
      <ul
        v-if="plan.settings_diff?.length"
        class="tw:m-0 tw:list-none tw:space-y-1 tw:rounded-lg tw:bg-surface-muted tw:p-3 tw:text-sm"
      >
        <li v-for="change in plan.settings_diff" :key="change.key">
          <strong>{{ change.key }}</strong
          >: {{ change.old }} → {{ change.new }}
        </li>
      </ul>
      <p
        v-if="action === 'change-url' && 'url_diff' in plan"
        class="tw:m-0 tw:rounded-lg tw:bg-surface-muted tw:p-3 tw:text-sm"
      >
        <strong>URL</strong>: {{ (plan as ChangeUrlPlan).url_diff.old.domain
        }}{{ (plan as ChangeUrlPlan).url_diff.old.path }} →
        {{ (plan as ChangeUrlPlan).url_diff.new.domain
        }}{{ (plan as ChangeUrlPlan).url_diff.new.path }}
      </p>
      <ol class="tw:m-0 tw:space-y-2 tw:pl-5 tw:text-sm">
        <li
          v-for="(operation, index) in plan.operations"
          :key="`${operation.resource}-${index}`"
        >
          <strong>{{ operation.summary }}</strong>
          <span class="tw:ml-2 tw:text-xs tw:text-muted-foreground"
            >{{ operation.risk || 'low' }} risk ·
            {{
              operation.reversible ? 'reversible' : 'no automatic reverse'
            }}</span
          >
        </li>
      </ol>
      <Button :disabled="busy !== ''" @click="applyPlan">{{
        busy === 'apply' ? 'Applying…' : `Approve and apply ${action}`
      }}</Button>
      <p class="tw:m-0 tw:text-xs tw:text-muted-foreground">
        The server revalidates this plan digest and submits the change through
        the signed operation and policy path.
      </p>
    </section>

    <ConfirmDialog
      :open="confirmingRevoke !== null"
      tier="disruptive"
      title="Revoke this group's access?"
      :description="`${confirmingRevoke} loses access to this app.`"
      confirm-label="Revoke"
      :busy="busy === `general-revoke-${confirmingRevoke}`"
      @confirm="confirmRevokeGroup(confirmingRevoke!)"
      @cancel="cancelRevokeGroup"
    />
  </PageLayout>
</template>
