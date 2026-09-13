<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), {
  class: undefined,
})

const classes = computed(() =>
  cn(
    'tw:mb-4 tw:flex tw:flex-col tw:gap-1 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between',
    props.class,
  ),
)
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
