<script setup lang="ts">
import { ChevronDown, ExternalLink, KeyRound, LogOut, Monitor, Moon, Sun } from '@lucide/vue'
import { onMounted, onUnmounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { useSigner } from '@/composables/useSigner'
import { useTheme } from '@/composables/useTheme'
import { shortenKey } from '@/lib/utils'

const { publicKey, username, admin, connect } = useSigner()
const { preference, setTheme } = useTheme()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const portalUrl = `${window.location.origin}/nostrhost/sso/`

const identity = () =>
  username.value || (publicKey.value ? shortenKey(publicKey.value) : null)

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

const themeOptions: { value: 'system' | 'light' | 'dark'; label: string; icon: typeof Sun }[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]
</script>

<template>
  <div ref="root" class="tw:relative">
    <Button
      variant="outline"
      size="sm"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <KeyRound class="tw:size-3.5" aria-hidden="true" />
      <span v-if="identity()" class="tw:max-w-24 tw:truncate tw:font-mono tw:sm:max-w-none">{{
        identity()
      }}</span>
      <span v-else>Sign in</span>
      <ChevronDown class="tw:size-3.5" aria-hidden="true" />
    </Button>

    <div
      v-if="open"
      role="menu"
      class="tw:absolute tw:right-0 tw:top-[calc(100%+8px)] tw:z-50 tw:w-64 tw:rounded-xl tw:border tw:border-border-subtle tw:bg-surface tw:p-2 tw:shadow-lg"
    >
      <div v-if="publicKey" class="tw:border-b tw:border-border-subtle tw:px-2 tw:pb-2">
        <p class="tw:truncate tw:text-sm tw:font-medium tw:text-foreground">
          {{ username || 'Signed in' }}
        </p>
        <p class="tw:truncate tw:font-mono tw:text-xs tw:text-muted-foreground" :title="publicKey">
          {{ shortenKey(publicKey) }}
        </p>
        <span
          class="tw:mt-1 tw:inline-block tw:rounded tw:bg-brand-500/10 tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[10px] tw:font-semibold tw:uppercase tw:text-brand-500"
          >{{ admin ? 'Admin' : 'Operator' }}</span
        >
      </div>

      <div class="tw:py-2">
        <p class="tw:px-2 tw:pb-1 tw:font-mono tw:text-[10px] tw:uppercase tw:tracking-wider tw:text-muted-foreground">
          Theme
        </p>
        <div class="tw:flex tw:gap-1 tw:px-2">
          <button
            v-for="option in themeOptions"
            :key="option.value"
            type="button"
            role="menuitemradio"
            :aria-checked="preference === option.value"
            class="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:px-2 tw:py-1.5 tw:text-[11px]"
            :class="
              preference === option.value
                ? 'tw:border-brand-500 tw:bg-brand-500/10 tw:text-foreground'
                : 'tw:border-transparent tw:text-muted-foreground tw:hover:bg-surface-muted'
            "
            @click="setTheme(option.value)"
          >
            <component :is="option.icon" class="tw:size-4" aria-hidden="true" />
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="tw:border-t tw:border-border-subtle tw:pt-2">
        <a
          :href="portalUrl"
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          class="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-2 tw:text-sm tw:text-foreground tw:no-underline tw:hover:bg-surface-muted"
          @click="open = false"
        >
          <ExternalLink class="tw:size-4" aria-hidden="true" />
          Open portal
        </a>
        <button
          type="button"
          role="menuitem"
          class="tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-2 tw:text-left tw:text-sm tw:text-foreground tw:hover:bg-surface-muted"
          @click="open = false; connect()"
        >
          <LogOut class="tw:size-4" aria-hidden="true" />
          {{ admin || publicKey ? 'Sign out' : 'Sign in' }}
        </button>
      </div>
    </div>
  </div>
</template>
