<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{ class?: string; disabled?: boolean; ariaLabel?: string }>(),
  {
    class: undefined,
    disabled: false,
    ariaLabel: undefined,
  },
)

const model = defineModel<boolean>({ default: false })

const trackClasses = computed(() =>
  cn(
    'tw:relative tw:inline-flex tw:h-5 tw:w-9 tw:shrink-0 tw:cursor-pointer tw:rounded-full tw:border tw:border-border-subtle tw:transition-colors tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:disabled:pointer-events-none tw:disabled:opacity-50',
    model.value ? 'tw:bg-brand-500' : 'tw:bg-surface-muted',
    props.class,
  ),
)
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :aria-label="ariaLabel"
    :disabled="disabled"
    :class="trackClasses"
    @click="model = !model"
  >
    <span
      class="tw:pointer-events-none tw:inline-block tw:size-4 tw:translate-x-0.5 tw:rounded-full tw:bg-surface tw:shadow tw:transition-transform"
      :class="model ? 'tw:translate-x-4' : 'tw:translate-x-0.5'"
    />
  </button>
</template>
