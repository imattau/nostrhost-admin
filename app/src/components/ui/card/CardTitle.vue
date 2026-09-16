<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), {
  class: undefined,
})

const classes = computed(() =>
  cn(
    'tw:text-base tw:font-semibold tw:tracking-tight tw:text-foreground',
    props.class,
  ),
)
</script>

<template>
  <h2 :class="classes">
    <slot />
  </h2>
</template>
