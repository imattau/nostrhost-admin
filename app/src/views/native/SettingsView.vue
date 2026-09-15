<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  getSettings,
  resetAllSettings,
  resetSetting,
  setSetting,
  type SettingValue,
} from '@/api/nativeSettings'
import { Badge } from '@/components/ui/badge'
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

const busy = ref('')
const { run } = useActionRunner(busy, '')

const settingKeys = computed(() => Object.keys(settings.value).sort())

const { publicKey, sync, loading, load } = useAsyncResource(async () => {
  const result = await getSettings()
  settings.value = result.settings
}, 'Failed to load settings.')

// -- edit a setting -------------------------------------------------------------

type EditorKind = 'boolean' | 'number' | 'text'

const editingKey = ref<string | null>(null)
const editValue = ref('')
const editorKind = ref<EditorKind>('text')

function kindOf(value: SettingValue): EditorKind {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'text'
}

function startEdit(key: string) {
  editingKey.value = key
  editorKind.value = kindOf(settings.value[key])
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
              class="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
            >
              <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
                <code class="tw:font-mono tw:text-sm">{{ key }}</code>
                <span class="tw:flex tw:items-center tw:gap-2">
                  <Badge variant="neutral">{{ String(settings[key]) }}</Badge>
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
                class="tw:grid tw:gap-2 tw:rounded-lg tw:bg-surface-muted tw:p-3"
              >
                <Select
                  v-if="editorKind === 'boolean'"
                  v-model="editValue"
                  class="tw:h-8 tw:max-w-[160px] tw:text-xs"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
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
