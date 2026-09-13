<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import {
  getSettings,
  resetAllSettings,
  resetSetting,
  setSetting,
  type SettingValue,
} from '@/api/nativeSettings'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const settings = ref<Record<string, SettingValue>>({})

const loading = ref(false)
const error = ref('')
const notice = ref('')
const busy = ref('')

const settingKeys = computed(() => Object.keys(settings.value).sort())

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const result = await getSettings()
    settings.value = result.settings
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load settings.'
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
  notice.value = ''
  error.value = ''
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
  busy.value = `set-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const value = parsedEditValue()
    const result = await setSetting(key, value)
    notice.value = `Updated ${key}.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    editingKey.value = null
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to update ${key}.`
  } finally {
    busy.value = ''
  }
}

// -- reset a setting --------------------------------------------------------

const confirmingReset = ref<string | null>(null)

function requestReset(key: string) {
  notice.value = ''
  error.value = ''
  confirmingReset.value = key
}

function cancelReset() {
  confirmingReset.value = null
}

async function confirmReset(key: string) {
  confirmingReset.value = null
  busy.value = `reset-${key}`
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await resetSetting(key)
    notice.value = `Reset ${key} to its default.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : `Failed to reset ${key}.`
  } finally {
    busy.value = ''
  }
}

// -- reset all ----------------------------------------------------------------

const confirmingResetAll = ref(false)

function requestResetAll() {
  notice.value = ''
  error.value = ''
  confirmingResetAll.value = true
}

async function confirmResetAll() {
  confirmingResetAll.value = false
  busy.value = 'reset-all'
  error.value = ''
  notice.value = ''
  try {
    await sync()
    const result = await resetAllSettings()
    notice.value = `All settings reset to their defaults.${result.request_id ? ` Operation ${result.request_id}` : ''}`
    await load()
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to reset settings.'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        System
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Settings
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Global YunoHost settings. Changes ask for confirmation first.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      You are not signed in. Sign in at the portal to continue.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Sign in at the portal to continue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>
    <Alert v-if="notice" variant="success" role="status">{{ notice }}</Alert>

    <template v-if="publicKey">
      <Card>
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span>Global settings</span>
            <template v-if="confirmingResetAll">
              <span class="tw:flex tw:items-center tw:gap-2">
                <span class="tw:text-xs tw:text-muted-foreground"
                  >Reset everything?</span
                >
                <Button
                  variant="outline"
                  size="sm"
                  @click="confirmingResetAll = false"
                  >Cancel</Button
                >
                <Button
                  variant="danger"
                  size="sm"
                  :disabled="busy !== ''"
                  @click="confirmResetAll"
                  >Confirm</Button
                >
              </span>
            </template>
            <Button
              v-else
              variant="outline"
              size="sm"
              :disabled="busy !== ''"
              @click="requestResetAll"
              >{{
                busy === 'reset-all' ? 'Resetting…' : 'Reset all to defaults'
              }}</Button
            >
          </CardTitle>
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
  </section>
</template>
