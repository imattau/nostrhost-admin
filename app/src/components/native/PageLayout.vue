<script setup lang="ts">
import { computed } from 'vue'

// Two widths per the plan's page-frame standardisation: "reading" for
// single-column screens (settings, power, forms), "workspace" (full width)
// for master–detail / data-table screens (applications, domains, users).
const props = withDefaults(defineProps<{ width?: 'reading' | 'workspace' }>(), {
  width: 'reading',
})

const classes = computed(() =>
  props.width === 'reading' ? 'tw:mx-auto tw:max-w-4xl' : 'tw:w-full',
)
</script>

<template>
  <section class="tw:grid tw:gap-6" :class="classes">
    <slot />
  </section>
</template>
