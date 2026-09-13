<script setup lang="ts">
import AppShell from '@/components/layouts/AppShell.vue'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <AppShell v-if="route.meta.layout !== 'bare'">
      <component :is="Component" />
    </AppShell>
    <component :is="Component" v-else />
  </RouterView>
</template>
