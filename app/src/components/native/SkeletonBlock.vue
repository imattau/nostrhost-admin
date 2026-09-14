<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ class?: string }>(), { class: undefined })

const classes = computed(() =>
  cn('tw:animate-pulse tw:rounded-md tw:bg-surface-muted', props.class),
)
</script>

<template>
  <div :class="classes" aria-hidden="true" />
</template>
