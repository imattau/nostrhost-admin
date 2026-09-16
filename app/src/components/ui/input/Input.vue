<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), {
  class: undefined,
})

const model = defineModel<string>()

const classes = computed(() =>
  cn(
    'tw:h-10 tw:w-full tw:rounded-[3px] tw:border tw:border-border-subtle tw:bg-workbench tw:px-3 tw:text-sm tw:text-foreground tw:placeholder:text-muted-foreground tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-focus tw:disabled:pointer-events-none tw:disabled:opacity-50',
    props.class,
  ),
)
</script>

<template>
  <input v-model="model" :class="classes" />
</template>
