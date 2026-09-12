<script setup lang="ts">
// Minimal hover/focus tooltip. Not a Popover: it only ever shows short,
// supplementary text next to the element that triggered it.
import { ref } from 'vue'

defineProps<{ text: string }>()
const open = ref(false)
</script>

<template>
  <span
    class="tw:relative tw:inline-flex"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
  >
    <slot />
    <span
      v-if="open"
      role="tooltip"
      class="tw:pointer-events-none tw:absolute tw:bottom-full tw:left-1/2 tw:z-10 tw:mb-2 tw:w-max tw:max-w-64 tw:-translate-x-1/2 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface-muted tw:px-2 tw:py-1 tw:text-xs tw:text-foreground tw:shadow-lg"
    >
      {{ text }}
    </span>
  </span>
</template>
