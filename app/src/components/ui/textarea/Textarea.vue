<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), {
  class: undefined,
})

const model = defineModel<string>()

const classes = computed(() =>
  cn(
    'tw:w-full tw:min-h-40 tw:resize-y tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:font-mono tw:text-sm tw:text-foreground tw:placeholder:text-muted-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:disabled:pointer-events-none tw:disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <textarea v-model="model" :class="classes" />
</template>
