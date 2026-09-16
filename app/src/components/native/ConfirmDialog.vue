<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'

// Three tiers (plan §Phase 1.4):
// - soft: benign/additive (create group, open a port) — one click, primary button.
// - disruptive: reversible but interrupts something (restart, reload, force-close) — warning button.
// - destructive: irreversible or high-blast-radius (shutdown, delete backup, reset-all,
//   remove a domain) — red button, disabled until the operator types the resource name.
export type ConfirmTier = 'soft' | 'disruptive' | 'destructive'

const props = withDefaults(
  defineProps<{
    open: boolean
    tier?: ConfirmTier
    title: string
    description?: string
    confirmLabel?: string
    cancelLabel?: string
    // Required for tier "destructive": the operator must type this exactly
    // to enable the confirm button.
    confirmPhrase?: string
    busy?: boolean
  }>(),
  {
    tier: 'soft',
    description: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    confirmPhrase: undefined,
    busy: false,
  },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const typed = ref('')
const headingRef = ref<HTMLElement | null>(null)
const dialogRef = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

watch(
  () => props.open,
  async (isOpen) => {
    typed.value = ''
    if (isOpen) {
      returnFocus = document.activeElement as HTMLElement | null
      await nextTick()
      headingRef.value?.focus()
    } else {
      returnFocus?.focus()
      returnFocus = null
    }
  },
)

const tierButtonVariant = computed(() =>
  props.tier === 'destructive'
    ? 'danger'
    : props.tier === 'disruptive'
      ? 'warning'
      : 'primary',
)

const canConfirm = computed(() => {
  if (props.busy) return false
  if (props.tier !== 'destructive') return true
  return (
    props.confirmPhrase !== undefined && typed.value === props.confirmPhrase
  )
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('cancel')
  if (event.key !== 'Tab' || !dialogRef.value) return
  const focusable = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
    ),
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div
    v-if="open"
    class="tw:fixed tw:inset-0 tw:z-[90] tw:flex tw:items-center tw:justify-center tw:bg-black/50 tw:p-4"
    @keydown="onKeydown"
    @click.self="emit('cancel')"
  >
    <div
      ref="dialogRef"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      class="tw:w-full tw:max-w-md tw:rounded-[4px] tw:border tw:border-border-subtle tw:border-t-4 tw:border-t-signature tw:bg-workbench tw:p-6 tw:shadow-xl"
    >
      <h2
        id="confirm-dialog-title"
        ref="headingRef"
        tabindex="-1"
        class="tw:text-lg tw:font-bold tw:text-foreground tw:focus-visible:outline-none"
      >
        {{ title }}
      </h2>
      <p v-if="description" class="tw:mt-2 tw:text-sm tw:text-muted-foreground">
        {{ description }}
      </p>

      <div v-if="$slots.default" class="tw:mt-3">
        <slot />
      </div>

      <div v-if="tier === 'destructive'" class="tw:mt-4">
        <label
          for="confirm-dialog-phrase"
          class="tw:mb-1 tw:block tw:text-xs tw:font-medium tw:text-muted-foreground"
        >
          Type
          <code class="tw:font-mono tw:text-foreground">{{
            confirmPhrase
          }}</code>
          to confirm
        </label>
        <input
          id="confirm-dialog-phrase"
          v-model="typed"
          type="text"
          autocomplete="off"
          class="tw:w-full tw:rounded-[3px] tw:border tw:border-border-subtle tw:bg-background tw:px-3 tw:py-2 tw:text-sm tw:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-focus"
        />
      </div>

      <div class="tw:mt-6 tw:flex tw:justify-end tw:gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="emit('cancel')"
        >
          {{ cancelLabel }}
        </Button>
        <Button
          :variant="tierButtonVariant"
          size="sm"
          :disabled="!canConfirm"
          @click="emit('confirm')"
        >
          {{ busy ? 'Working…' : confirmLabel }}
        </Button>
      </div>
    </div>
  </div>
</template>
