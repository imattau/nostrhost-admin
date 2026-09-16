<script setup lang="ts">
const items = [
  { route: 'native-users', label: 'People' },
  { route: 'native-identities', label: 'Nostr identities' },
  { route: 'native-groups', label: 'Access groups' },
]
</script>

<template>
  <nav
    class="tw:mb-6 tw:flex tw:gap-5 tw:border-b tw:border-border-subtle"
    aria-label="People sections"
  >
    <RouterLink
      v-for="item in items"
      :key="item.route"
      :to="{ name: item.route }"
      class="tw:border-b-2 tw:border-transparent tw:px-0 tw:pb-2 tw:text-sm tw:text-muted-foreground tw:no-underline"
      active-class="tw:!border-signature tw:!font-semibold tw:!text-foreground"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
