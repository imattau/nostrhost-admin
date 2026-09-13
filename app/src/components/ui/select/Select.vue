<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), {
  class: undefined,
})

const model = defineModel<string>()

const classes = computed(() =>
  cn(
    'tw:h-10 tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:text-sm tw:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:disabled:pointer-events-none tw:disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <select v-model="model" :class="classes">
    <slot />
  </select>
</template>
