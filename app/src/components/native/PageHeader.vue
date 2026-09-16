<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  description?: string
}>()
</script>

<template>
  <header class="tw:pb-7">
    <div
      class="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-end tw:sm:justify-between"
    >
      <div>
        <p class="tw:m-0 tw:text-xs tw:font-semibold tw:text-muted-foreground">
          {{ eyebrow }}
        </p>
        <h1
          class="tw:mb-0 tw:mt-2 tw:text-[1.75rem] tw:font-semibold tw:leading-tight tw:tracking-[-0.025em] tw:text-foreground"
        >
          {{ title }}
        </h1>
        <p
          v-if="description"
          class="tw:mb-0 tw:mt-2 tw:max-w-3xl tw:text-sm tw:leading-6 tw:text-muted-foreground"
        >
          {{ description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="tw:flex tw:shrink-0 tw:items-center tw:gap-2 tw:pb-0.5"
      >
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
