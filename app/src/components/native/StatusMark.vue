<script setup lang="ts">
withDefaults(
  defineProps<{
    state: 'healthy' | 'warning' | 'danger' | 'neutral'
    label: string
  }>(),
  { state: 'neutral' },
)
</script>

<template>
  <span
    class="tw:inline-flex tw:items-center tw:gap-2 tw:text-sm tw:font-medium"
  >
    <span
      class="tw:size-2 tw:shrink-0 tw:rounded-full"
      :class="{
        'tw:bg-healthy': state === 'healthy',
        'tw:bg-caution': state === 'warning',
        'tw:bg-destructive': state === 'danger',
        'tw:bg-muted-foreground': state === 'neutral',
      }"
      aria-hidden="true"
    />
    {{ label }}
  </span>
</template>
