<script setup lang="ts">
defineProps<{ label: string; sticky?: boolean }>()
</script>

<template>
  <aside
    class="tw:min-w-0 tw:border-t tw:border-border-subtle tw:bg-workbench tw:p-5 tw:lg:border-l tw:lg:border-t-0"
    :class="
      sticky
        ? 'tw:lg:sticky tw:lg:top-6 tw:lg:max-h-[calc(100vh-3rem)] tw:lg:overflow-y-auto'
        : ''
    "
    :aria-label="label"
  >
    <slot />
  </aside>
</template>
