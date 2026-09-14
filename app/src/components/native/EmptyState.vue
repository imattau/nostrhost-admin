<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon?: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div
    class="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-border-subtle tw:p-8 tw:text-center"
  >
    <span
      v-if="icon"
      class="tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-full tw:bg-surface-muted tw:text-muted-foreground"
    >
      <component :is="icon" class="tw:size-5" aria-hidden="true" />
    </span>
    <div>
      <p class="tw:text-sm tw:font-medium tw:text-foreground">{{ title }}</p>
      <p v-if="description" class="tw:mt-1 tw:text-sm tw:text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.action" class="tw:mt-1">
      <slot name="action" />
    </div>
  </div>
</template>
