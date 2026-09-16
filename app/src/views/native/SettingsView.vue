<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  getSettings,
  resetAllSettings,
  resetSetting,
  setSetting,
  type FullSettingOption,
  type SettingValue,
} from '@/api/nativeSettings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useActionRunner } from '@/composables/useActionRunner'
import { useConfirm } from '@/composables/useConfirm'
import { useNotifications } from '@/composables/useNotifications'
import ConfirmDialog from '@/components/native/ConfirmDialog.vue'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { success } = useNotifications()

const settings = ref<Record<string, SettingValue>>({})
type SettingMeta = {
  label: string
  help?: string
  type: FullSettingOption['type']
  choices: Array<{ value: string; label: string }>
  group: string
}
const metadata = ref<Record<string, SettingMeta>>({})

const busy = ref('')
const { run } = useActionRunner(busy, '')

const settingKeys = computed(() => Object.keys(settings.value).sort())

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  const result = await getSettings(true)
  const nextValues: Record<string, SettingValue> = {}
  const nextMetadata: Record<string, SettingMeta> = {}
  const text = (
    value: string | Record<string, string> | undefined,
    fallback: string,
  ) =>
    typeof value === 'string'
      ? value
      : value?.en || Object.values(value || {})[0] || fallback

  for (const panel of result.settings.panels || []) {
    for (const section of panel.sections || []) {
      for (const option of section.options || []) {
        const key = [panel.id, section.id, option.id].filter(Boolean).join('.')
        const rawValue =
          option.current_value ?? option.value ?? option.default ?? null
        const value =
          option.type === 'boolean'
            ? rawValue === true ||
              rawValue === 1 ||
              rawValue === '1' ||
              rawValue === 'true'
            : option.type === 'number' || option.type === 'integer'
              ? rawValue === null || rawValue === ''
                ? null
                : Number(rawValue)
              : rawValue
        nextValues[key] = value
        nextMetadata[key] = {
          label: text(option.ask || option.name, option.id),
          help: option.help ? text(option.help, '') : undefined,
          type: option.type,
          choices: (option.choices || []).map((choice) =>
            typeof choice === 'string'
              ? { value: choice, label: choice }
              : { value: choice.value, label: choice.label || choice.value },
          ),
          group: text(section.name, section.id || text(panel.name, panel.id)),
        }
      }
    }
  }

  if (Object.keys(nextValues).length === 0) {
    const fallback = await getSettings()
    settings.value = fallback.settings
    metadata.value = {}
  } else {
    settings.value = nextValues
    metadata.value = nextMetadata
  }
}, 'Failed to load settings.')

// -- edit a setting -------------------------------------------------------------

type EditorKind = 'boolean' | 'number' | 'text' | 'select'

const editingKey = ref<string | null>(null)
const editValue = ref('')
const editorKind = ref<EditorKind>('text')
const editorChoices = ref<Array<{ value: string; label: string }>>([])

function kindOf(value: SettingValue): EditorKind {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'text'
}

function startEdit(key: string) {
  editingKey.value = key
  const meta = metadata.value[key]
  editorChoices.value = meta?.choices || []
  editorKind.value = editorChoices.value.length
    ? 'select'
    : meta?.type === 'boolean'
      ? 'boolean'
      : meta?.type === 'number' || meta?.type === 'integer'
        ? 'number'
        : kindOf(settings.value[key])
  editValue.value = String(settings.value[key] ?? '')
}

function cancelEdit() {
  editingKey.value = null
}

function parsedEditValue(): SettingValue {
  if (editorKind.value === 'boolean') return editValue.value === 'true'
  if (editorKind.value === 'number') return Number(editValue.value)
  return editValue.value
}

async function saveEdit(key: string) {
  await run(
    `set-${key}`,
    async () => {
      await sync()
      const value = parsedEditValue()
      const result = await setSetting(key, value)
      success(
        `Updated ${key}.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      editingKey.value = null
      await load()
    },
    `Failed to update ${key}.`,
  )
}

// -- reset a setting --------------------------------------------------------

const {
  pending: confirmingReset,
  request: requestResetConfirm,
  cancel: cancelReset,
} = useConfirm<string | null>(null)

function requestReset(key: string) {
  requestResetConfirm(key)
}

async function confirmReset(key: string) {
  confirmingReset.value = null
  await run(
    `reset-${key}`,
    async () => {
      await sync()
      const result = await resetSetting(key)
      success(
        `Reset ${key} to its default.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    `Failed to reset ${key}.`,
  )
}

// -- reset all ----------------------------------------------------------------

const { pending: confirmingResetAll, request: requestResetAllConfirm } =
  useConfirm(false)

function requestResetAll() {
  requestResetAllConfirm(true)
}

async function confirmResetAll() {
  confirmingResetAll.value = false
  await run(
    'reset-all',
    async () => {
      await sync()
      const result = await resetAllSettings()
      success(
        `All settings reset to their defaults.${result.request_id ? ` Operation ${result.request_id}` : ''}`,
      )
      await load()
    },
    'Failed to reset settings.',
  )
}
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="System"
      title="Settings"
      description="Global YunoHost settings. Changes ask for confirmation first."
    />

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle>Global settings</CardTitle>
          <template #actions>
            <Button
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="requestResetAll"
              >{{
                busy === 'reset-all' ? 'Resetting…' : 'Reset all to defaults'
              }}</Button
            >
          </template>
        </CardHeader>
        <CardContent class="tw:grid tw:gap-3">
          <p v-if="loading" class="tw:m-0 tw:text-sm tw:text-muted-foreground">
            Loading…
          </p>
          <ul v-else class="tw:m-0 tw:grid tw:gap-2 tw:pl-0">
            <li
              v-for="key in settingKeys"
              :key="key"
              class="tw:grid tw:gap-2 tw:border-b tw:border-border-subtle tw:py-4 last:tw:border-b-0"
            >
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <div class="tw:min-w-0">
                  <strong class="tw:block tw:text-sm">{{
                    metadata[key]?.label || key
                  }}</strong>
                  <code
                    class="tw:mt-0.5 tw:block tw:font-mono tw:text-[11px] tw:text-muted-foreground"
                    >{{ key }}</code
                  >
                  <p
                    v-if="metadata[key]?.help"
                    class="tw:mb-0 tw:mt-1 tw:max-w-2xl tw:text-xs tw:leading-5 tw:text-muted-foreground"
                  >
                    {{ metadata[key].help }}
                  </p>
                </div>
                <span class="tw:flex tw:items-center tw:gap-2">
                  <span
                    class="tw:max-w-48 tw:truncate tw:text-sm tw:text-muted-foreground"
                    >{{ String(settings[key]) }}</span
                  >
                  <template v-if="confirmingReset === key">
                    <span class="tw:text-xs tw:text-muted-foreground"
                      >Reset?</span
                    >
                    <Button variant="outline" size="sm" @click="cancelReset"
                      >Cancel</Button
                    >
                    <Button
                      variant="danger"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="confirmReset(key)"
                      >Confirm</Button
                    >
                  </template>
                  <template v-else>
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="startEdit(key)"
                      >Edit</Button
                    >
                    <Button
                      variant="outline"
                      size="sm"
                      :disabled="busy !== ''"
                      @click="requestReset(key)"
                      >{{
                        busy === `reset-${key}` ? 'Resetting…' : 'Reset'
                      }}</Button
                    >
                  </template>
                </span>
              </div>

              <div
                v-if="editingKey === key"
                class="tw:grid tw:gap-2 tw:border-l-2 tw:border-signature tw:bg-selection/35 tw:p-3"
              >
                <Select
                  v-if="editorKind === 'boolean'"
                  v-model="editValue"
                  class="tw:h-8 tw:max-w-[160px] tw:text-xs"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </Select>
                <Select
                  v-else-if="editorKind === 'select'"
                  v-model="editValue"
                  class="tw:max-w-[320px]"
                >
                  <option
                    v-for="choice in editorChoices"
                    :key="choice.value"
                    :value="choice.value"
                  >
                    {{ choice.label }}
                  </option>
                </Select>
                <Input
                  v-else
                  v-model="editValue"
                  :type="editorKind === 'number' ? 'number' : 'text'"
                  class="tw:max-w-[320px]"
                  autocomplete="off"
                  spellcheck="false"
                />
                <div class="tw:flex tw:justify-end tw:gap-2">
                  <Button variant="outline" size="sm" @click="cancelEdit"
                    >Cancel</Button
                  >
                  <Button
                    size="sm"
                    :disabled="busy !== ''"
                    @click="saveEdit(key)"
                    >{{ busy === `set-${key}` ? 'Saving…' : 'Save' }}</Button
                  >
                </div>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <ConfirmDialog
      :open="confirmingResetAll"
      tier="destructive"
      title="Reset all settings to defaults?"
      description="Every global setting reverts to its default value. This cannot be undone."
      confirm-label="Reset all"
      confirm-phrase="reset all"
      :busy="busy === 'reset-all'"
      @confirm="confirmResetAll"
      @cancel="confirmingResetAll = false"
    />
  </PageLayout>
</template>
