<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <header class="tw:border-b tw:border-border-subtle tw:pb-4">
    <div class="tw:flex tw:flex-col tw:gap-1 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
      <div>
        <p
          class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
        >
          {{ eyebrow }}
        </p>
        <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">{{ title }}</h1>
        <p v-if="description" class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
