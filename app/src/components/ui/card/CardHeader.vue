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
    <div class="tw:min-w-0">
      <slot />
    </div>
    <div v-if="$slots.actions" class="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
