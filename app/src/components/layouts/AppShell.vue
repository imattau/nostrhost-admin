<script setup lang="ts">
import { Menu } from '@lucide/vue'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'
import IdentityMenu from '@/components/native/IdentityMenu.vue'

import AppSidebar from './AppSidebar.vue'

const route = useRoute()
const mobileNavOpen = ref(false)
watch(
  () => route.fullPath,
  () => {
    mobileNavOpen.value = false
  },
)
</script>

<template>
  <div
    class="tw:flex tw:min-h-screen tw:bg-background tw:font-sans tw:text-foreground"
  >
    <AppSidebar :open="mobileNavOpen" @close="mobileNavOpen = false" />

    <div class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
      <header
        class="tw:flex tw:h-20 tw:shrink-0 tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-border-subtle tw:bg-surface tw:px-4 tw:sm:px-8"
      >
        <div class="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="tw:shrink-0 tw:lg:hidden"
            aria-label="Toggle navigation"
            :aria-expanded="mobileNavOpen"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            <Menu class="tw:size-5" aria-hidden="true" />
          </Button>
          <p
            class="tw:truncate tw:font-medium tw:text-sm tw:uppercase tw:text-muted-foreground"
          >
            Self-Hosted Application Hub
          </p>
        </div>

        <div class="tw:flex tw:items-center tw:gap-3">
          <IdentityMenu />
        </div>
      </header>

      <main class="tw:flex-1 tw:p-4 tw:sm:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
