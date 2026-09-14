<script setup lang="ts">
defineProps<{
  label: string
  for?: string
  help?: string
  error?: string
}>()
</script>

<template>
  <div class="tw:grid tw:gap-1.5">
    <label :for="$props.for" class="tw:text-sm tw:font-medium tw:text-foreground">{{
      label
    }}</label>
    <slot />
    <p v-if="error" class="tw:text-xs tw:text-red-500" role="alert">{{ error }}</p>
    <p v-else-if="help" class="tw:text-xs tw:text-muted-foreground">{{ help }}</p>
  </div>
</template>
