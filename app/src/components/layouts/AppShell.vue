<script setup lang="ts">
import { Menu } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getHealth, getSystemStatus } from '@/api/nativeSystem'
import { Button } from '@/components/ui/button'

import AppSidebar from './AppSidebar.vue'

const route = useRoute()
const mobileNavOpen = ref(false)
const hostname = ref('')
const reachable = ref<boolean | null>(null)
const currentPage = computed(() => route.meta.nav?.label ?? 'NostrHost')

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') mobileNavOpen.value = false
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    const [health, status] = await Promise.all([getHealth(), getSystemStatus()])
    hostname.value = status.hostname
    reachable.value = health.ok
  } catch {
    reachable.value = false
  }
})
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
watch(
  () => route.fullPath,
  () => {
    mobileNavOpen.value = false
  },
)
</script>

<template>
  <div
    class="tw:flex tw:min-h-screen tw:bg-canvas tw:font-sans tw:text-foreground"
  >
    <a
      href="#main-content"
      class="tw:fixed tw:left-3 tw:top-3 tw:z-[70] tw:-translate-y-20 tw:bg-foreground tw:px-3 tw:py-2 tw:text-sm tw:font-semibold tw:text-background tw:focus:translate-y-0"
    >
      Skip to main content
    </a>
    <AppSidebar
      :open="mobileNavOpen"
      :hostname="hostname"
      :reachable="reachable"
      @close="mobileNavOpen = false"
    />

    <div class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
      <header
        class="tw:sticky tw:top-0 tw:z-30 tw:flex tw:h-14 tw:shrink-0 tw:items-center tw:gap-3 tw:border-b tw:border-border-subtle tw:bg-canvas/95 tw:px-4 tw:backdrop-blur tw:lg:hidden"
      >
        <Button
          variant="ghost"
          size="icon"
          class="tw:shrink-0"
          aria-label="Open workshop navigation"
          :aria-expanded="mobileNavOpen"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          <Menu class="tw:size-5" aria-hidden="true" />
        </Button>
        <p class="tw:m-0 tw:truncate tw:text-sm tw:font-semibold">
          {{ currentPage }}
        </p>
      </header>

      <main
        id="main-content"
        tabindex="-1"
        class="tw:flex-1 tw:px-4 tw:py-7 tw:sm:px-8 tw:lg:px-10 tw:lg:py-9 tw:xl:px-12"
      >
        <slot />
      </main>
    </div>
  </div>
</template>
