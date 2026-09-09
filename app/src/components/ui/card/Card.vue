<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string; as?: string; to?: unknown }>()

const classes = computed(() =>
  cn(
    'tw:block tw:rounded-lg tw:border tw:border-border-subtle tw:bg-surface tw:p-4 tw:shadow-sm tw:transition-shadow tw:dark:border-border-subtle-dark tw:dark:bg-surface-dark',
    props.to ? 'tw:hover:shadow-md tw:hover:border-brand-300' : undefined,
    props.class,
  ),
)
</script>

<template>
  <component :is="to ? 'router-link' : (as ?? 'div')" :to="to" :class="classes">
    <slot />
  </component>
</template>
