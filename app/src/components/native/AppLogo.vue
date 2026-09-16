<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    logo?: string | null
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { logo: null, size: 'md' },
)

const sizeClass = computed(
  () =>
    ({
      sm: 'tw:size-8 tw:rounded-md tw:text-xs',
      md: 'tw:size-10 tw:rounded-lg tw:text-sm',
      lg: 'tw:size-14 tw:rounded-xl tw:text-lg',
    })[props.size],
)

const initials = computed(() => {
  const parts = props.name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return letters.join('') || '?'
})
</script>

<template>
  <img
    v-if="logo"
    :src="logo"
    alt=""
    aria-hidden="true"
    class="tw:shrink-0 tw:object-contain"
    :class="sizeClass"
  />
  <span
    v-else
    aria-hidden="true"
    class="tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:bg-surface-muted tw:font-semibold tw:text-muted-foreground"
    :class="sizeClass"
    >{{ initials }}</span
  >
</template>
