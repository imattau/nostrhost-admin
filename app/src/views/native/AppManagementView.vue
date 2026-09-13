<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  applyCatalogueApp,
  applyNativeAppSettings,
  getAppManagement,
  getNativeAppSettings,
  planCatalogueApp,
  planNativeAppSettings,
  type AppManagementEntry,
  type NativeAppSettings,
  type PackagePlan,
} from '@/api/nativePackages'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useSigner } from '@/composables/useSigner'

type Filter =
  | 'all'
  | 'installed'
  | 'available'
  | 'version-differs'
  | 'installed-unlisted'
type Action = 'install' | 'upgrade' | 'remove' | 'settings'

const { publicKey, signerAvailable, sync } = useSigner()

const apps = ref<AppManagementEntry[]>([])
const catalogueError = ref('')
const selected = ref<AppManagementEntry | null>(null)
const settings = ref<NativeAppSettings | null>(null)
const values = ref<Record<string, unknown>>({})
const plan = ref<PackagePlan | null>(null)
const action = ref<Action | null>(null)
const error = ref('')
const notice = ref('')
const filter = ref<Filter>('all')
const search = ref('')
const busy = ref('')
const visibleApps = computed(() =>
  apps.value.filter((app) => {
    const matchesFilter =
      filter.value === 'all' ||
      app.status === filter.value ||
      (filter.value === 'installed' && app.installed)
    const needle = search.value.trim().toLocaleLowerCase()
    const matchesSearch =
      !needle ||
      `${app.name} ${app.id} ${app.description}`
        .toLocaleLowerCase()
        .includes(needle)
    return matchesFilter && matchesSearch
  }),
)

async function loadApps() {
  busy.value = 'load'
  error.value = ''
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
    error.value =
      cause instanceof Error ? cause.message : 'Could not load applications.'
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

async function chooseApp(app: AppManagementEntry) {
  selected.value = app
  settings.value = null
  values.value = {}
  plan.value = null
  action.value = null
  error.value = ''
  notice.value = ''
  if (!app.installed || !app.installation?.native) return
  busy.value = 'settings'
  try {
    settings.value = await getNativeAppSettings(app.id)
    values.value = { ...settings.value.values }
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Could not load app settings.'
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

async function previewLifecycle(nextAction: Exclude<Action, 'settings'>) {
  if (!selected.value) return
  busy.value = `plan-${nextAction}`
  error.value = ''
  notice.value = ''
  plan.value = null
  action.value = null
  try {
    plan.value = await planCatalogueApp(selected.value.id, nextAction)
    action.value = nextAction
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Could not build ${nextAction} plan.`
  } finally {
    busy.value = ''
  }
}

async function previewSettings() {
  if (!selected.value) return
  busy.value = 'plan-settings'
  error.value = ''
  notice.value = ''
  plan.value = null
  action.value = null
  try {
    plan.value = await planNativeAppSettings(selected.value.id, values.value)
    action.value = 'settings'
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Could not build settings plan.'
  } finally {
    busy.value = ''
  }
}

async function applyPlan() {
  if (!selected.value || !plan.value || !action.value) return
  const chosenAction = action.value
  busy.value = 'apply'
  error.value = ''
  notice.value = ''
  try {
    const result =
      chosenAction === 'settings'
        ? await applyNativeAppSettings(
            selected.value.id,
            plan.value,
            values.value,
          )
        : await applyCatalogueApp(selected.value.id, chosenAction, plan.value)
    const requestId = result.operation.request_id
    notice.value = `${chosenAction === 'settings' ? 'Settings saved' : `App ${chosenAction} completed`}.${requestId ? ` Operation ${requestId}` : ''}`
    plan.value = null
    action.value = null
    await loadApps()
    if (selected.value?.installed && selected.value.installation?.native)
      await chooseApp(selected.value)
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : `Could not apply ${chosenAction}.`
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
  <section class="tw:space-y-6" aria-labelledby="page-title">
    <header
      class="tw:flex tw:flex-wrap tw:items-start tw:justify-between tw:gap-4"
    >
      <div>
        <p
          class="tw:mb-1 tw:font-mono tw:text-xs tw:uppercase tw:tracking-widest tw:text-brand-500"
        >
          NostrHost
        </p>
        <h1 id="page-title" class="tw:m-0 tw:text-2xl tw:font-semibold">
          Applications
        </h1>
        <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
          Browse trusted releases and manage apps installed on this server.
        </p>
      </div>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      A NIP-07 browser signer is required. Enable a signer extension, then
      reload this page.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Connect your signer above to load the catalogue and manage apps.
    </Alert>
    <Alert v-if="catalogueError" variant="warning" role="status">
      The trusted catalogue is unavailable. Showing installed apps only.
      {{ catalogueError }}
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <div
      v-if="publicKey"
      class="tw:grid tw:gap-5 lg:tw:grid-cols-[minmax(0,1fr)_minmax(19rem,0.8fr)]"
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
              class="tw:flex tw:w-full tw:items-start tw:gap-3 tw:p-4 tw:text-left tw:transition-colors tw:hover:bg-surface-muted tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500"
              :aria-current="selected?.id === app.id ? 'true' : undefined"
              @click="chooseApp(app)"
            >
              <span class="tw:min-w-0 tw:flex-1">
                <strong class="tw:block tw:text-sm">{{ app.name }}</strong>
                <code class="tw:text-xs tw:text-muted-foreground">{{
                  app.id
                }}</code>
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
  </section>
</template>
