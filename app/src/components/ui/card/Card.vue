<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; as?: string; to?: unknown }>()

const classes = computed(() =>
  cn(
    'tw:block tw:rounded-xl tw:border tw:border-border-subtle tw:bg-surface tw:p-4 tw:shadow-sm tw:transition-colors tw:transition-shadow',
    props.to
      ? 'tw:hover:border-brand-300 tw:hover:shadow-md tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:focus-visible:ring-offset-2'
      : undefined,
    props.class,
  ),
)
</script>

<template>
  <component :is="to ? 'router-link' : (as ?? 'div')" :to="to" :class="classes">
    <slot />
  </component>
</template>
