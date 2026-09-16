<script setup lang="ts">
import { MoreHorizontal } from '@lucide/vue'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Button } from '@/components/ui/button'

defineProps<{ label: string }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) {
    root.value?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus()
  }
}

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    close(true)
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="tw:relative">
    <Button
      variant="ghost"
      size="icon"
      :aria-label="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MoreHorizontal class="tw:size-4" aria-hidden="true" />
    </Button>
    <div
      v-if="open"
      ref="menu"
      role="menu"
      class="tw:absolute tw:right-0 tw:top-[calc(100%+4px)] tw:z-20 tw:min-w-40 tw:rounded-[3px] tw:border tw:border-border-subtle tw:bg-workbench tw:p-1 tw:shadow-lg"
      @click="close()"
    >
      <slot />
    </div>
  </div>
</template>
