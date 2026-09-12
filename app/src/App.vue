<script setup lang="ts">
import { useToastController } from 'bootstrap-vue-next'
import { LogOut } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { useAutoToast } from '@/composables/useAutoToast'
import { useInfos } from '@/composables/useInfos'
import { useRequests } from '@/composables/useRequests'
import { useSettings } from '@/composables/useSettings'
import { HistoryConsole } from '@/views/_partials'

useAutoToast().init(useToastController())
const { connected, logout, onAppCreated } = useInfos()
const { locked } = useRequests()
const { spinner } = useSettings()

const ready = ref(false)
onAppCreated().finally(() => (ready.value = true))

onMounted(() => {
  const copypastaCode = ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp']
  let copypastastep = 0
  document.addEventListener('keydown', ({ key }) => {
    if (key === copypastaCode[copypastastep++]) {
      if (copypastastep === copypastaCode.length) {
        document
          .querySelectorAll('.unselectable')
          .forEach((element) => element.classList.remove('unselectable'))
        copypastastep = 0
      }
    } else {
      copypastastep = 0
    }
  })

  // Konamicode ;P
  const konamiCode = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ]
  let konamistep = 0
  document.addEventListener('keydown', ({ key }) => {
    if (key === konamiCode[konamistep++]) {
      if (konamistep === konamiCode.length) {
        spinner.value = 'nyancat'
        konamistep = 0
      }
    } else {
      konamistep = 0
    }
  })

  const today = new Date()

  // International Transgender Day of Visibility ;) (March 31)
  // and Trans Day of Remembrance (November 20)
  if (
    (today.getDate() === 31 && today.getMonth() + 1 === 3) ||
    (today.getDate() === 20 && today.getMonth() + 1 === 11)
  ) {
    spinner.value = 'transcat'
  }

  // April fools easter egg ;)
  if (today.getDate() === 1 && today.getMonth() + 1 === 4) {
    spinner.value = 'magikarp'
  }

  // Halloween easter egg ;)
  if (today.getDate() === 31 && today.getMonth() + 1 === 10) {
    spinner.value = 'spookycat'
  }
})
</script>

<template>
  <div
    id="app"
    class="tw:flex tw:min-h-screen tw:flex-col tw:bg-background tw:font-sans tw:text-foreground"
  >
    <!-- HEADER -->
    <header class="tw:border-b tw:border-border-subtle tw:bg-surface">
      <div
        class="tw:mx-auto tw:flex tw:w-full tw:max-w-7xl tw:items-center tw:gap-3 tw:px-4 tw:py-3"
      >
        <RouterLink
          :to="{ name: 'home' }"
          :aria-disabled="locked"
          class="tw:flex tw:shrink-0 tw:items-center tw:gap-3 tw:rounded-lg tw:text-foreground tw:no-underline tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500"
          :class="{ 'tw:pointer-events-none tw:opacity-50': locked }"
        >
          <span
            class="tw:flex tw:size-9 tw:items-center tw:justify-center tw:rounded-[10px] tw:bg-brand-500 tw:text-white tw:shadow-[0_4px_12px_rgba(139,92,246,0.35)]"
          >
            <img
              src="/nostrhost-mark.svg"
              alt=""
              width="18"
              height="18"
              class="tw:size-[18px]"
            />
          </span>
          <span class="tw:flex tw:flex-col tw:leading-tight">
            <span class="tw:text-base tw:font-bold">NostrHost</span>
            <span
              class="tw:font-mono tw:text-[10px] tw:uppercase tw:tracking-wider tw:text-brand-500"
              >System Console</span
            >
          </span>
        </RouterLink>

        <div class="tw:ml-auto tw:flex tw:items-center tw:gap-2">
          <Button
            v-show="connected"
            variant="outline"
            size="sm"
            @click.prevent="logout"
          >
            <LogOut class="tw:size-4" />
            {{ $t('logout') }}
          </Button>
        </div>
      </div>
    </header>

    <!-- MAIN -->
    <div class="tw:mx-auto tw:w-full tw:max-w-7xl tw:flex-1 tw:px-4 tw:py-6">
      <MainLayout v-if="ready" />
    </div>

    <BModalOrchestrator />
    <BToastOrchestrator />

    <!-- HISTORY CONSOLE -->
    <HistoryConsole />

    <!-- FOOTER -->
    <footer
      class="tw:mt-auto tw:border-t tw:border-border-subtle tw:py-4 tw:text-sm tw:text-muted-foreground"
    >
      <nav
        class="tw:mx-auto tw:flex tw:max-w-7xl tw:flex-wrap tw:items-center tw:justify-between tw:gap-x-6 tw:gap-y-2 tw:px-4"
      >
        <span class="tw:font-mono tw:text-xs">NostrHost Control Plane</span>
      </nav>
    </footer>
  </div>
</template>

<style lang="scss" scoped>
#console {
  // HistoryConsole is rendered before the footer in the DOM (so tab order
  // stays main-content -> footer -> console), but visually belongs after it.
  order: 3;
}
</style>
