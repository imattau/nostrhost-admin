<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), {
  class: undefined,
})

const classes = computed(() =>
  cn('tw:border-t tw:border-border-subtle tw:py-6', props.class),
)
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
