<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
  options: { value: unknown; text: string }[]
}>()
const model = defineModel<unknown>()

const classes = computed(() =>
  cn(
    'tw:h-10 tw:w-full tw:rounded-lg tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:text-sm tw:text-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:focus-visible:ring-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <select v-model="model" :class="classes">
    <option v-for="opt in options" :key="String(opt.value)" :value="opt.value">
      {{ opt.text }}
    </option>
  </select>
</template>
