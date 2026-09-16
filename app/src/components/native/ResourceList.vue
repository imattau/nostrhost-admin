<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <section class="tw:min-w-0" :aria-label="label">
    <div v-if="$slots.tools" class="tw:mb-3">
      <slot name="tools" />
    </div>
    <div
      class="tw:divide-y tw:divide-border-subtle tw:border-y tw:border-border-subtle"
    >
      <slot />
    </div>
  </section>
</template>
