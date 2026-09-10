<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
const model = defineModel<string>()

const classes = computed(() =>
  cn(
    'tw:h-10 tw:w-full tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:text-sm tw:text-slate-900 tw:placeholder:text-slate-400 tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:dark:border-border-subtle-dark tw:dark:bg-surface-dark tw:dark:text-slate-100',
    props.class,
  ),
)
</script>

<template>
  <input v-model="model" :class="classes" />
</template>
