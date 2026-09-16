<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  labelledby?: string
}>()
</script>

<template>
  <section
    class="tw:border-t tw:border-border-subtle tw:py-6"
    :aria-labelledby="labelledby"
  >
    <div
      v-if="title || description || $slots.actions"
      class="tw:mb-4 tw:flex tw:flex-col tw:gap-2 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between"
    >
      <div>
        <h2
          v-if="title"
          :id="labelledby"
          class="tw:m-0 tw:text-base tw:font-semibold tw:tracking-tight"
        >
          {{ title }}
        </h2>
        <p
          v-if="description"
          class="tw:mb-0 tw:mt-1 tw:max-w-2xl tw:text-sm tw:leading-6 tw:text-muted-foreground"
        >
          {{ description }}
        </p>
      </div>
      <div
        v-if="$slots.actions"
        class="tw:flex tw:shrink-0 tw:items-center tw:gap-2"
      >
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>
