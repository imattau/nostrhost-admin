<script setup lang="ts">
import { useToastController } from 'bootstrap-vue-next'
import { LogOut, User } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import { Button } from '@/components/ui/button'
import { useAutoToast } from '@/composables/useAutoToast'
import { useInfos } from '@/composables/useInfos'
import { useRequests } from '@/composables/useRequests'
import { useSettings } from '@/composables/useSettings'
import { HistoryConsole } from '@/views/_partials'

useAutoToast().init(useToastController())
const { ssoLink, connected, yunohost, logout, onAppCreated } = useInfos()
const { locked } = useRequests()
const { spinner, dark } = useSettings()

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
  <div id="app">
    <!-- HEADER -->
    <header
      class="tw:border-b tw:border-border-subtle tw:dark:border-border-subtle-dark"
    >
      <div
        class="tw:mx-auto tw:flex tw:max-w-6xl tw:items-center tw:gap-4 tw:px-4 tw:py-3"
      >
        <RouterLink
          :to="{ name: 'home' }"
          :aria-disabled="locked"
          class="tw:shrink-0"
          :class="{ 'tw:pointer-events-none tw:opacity-50': locked }"
        >
          <img
            v-if="dark"
            alt="YunoHost logo"
            src="./assets/logo_light.png"
            width="36"
          />
          <img
            v-else
            alt="YunoHost logo"
            src="./assets/logo_dark.png"
            width="36"
          />
        </RouterLink>

        <div class="tw:ml-auto tw:flex tw:items-center tw:gap-2">
          <Button as="a" :href="ssoLink" size="sm">
            <User class="tw:size-4" />
            {{ $t('user_interface_link') }}
          </Button>

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
    <div class="container">
      <MainLayout v-if="ready" />
    </div>

    <BModalOrchestrator />
    <BToastOrchestrator />

    <!-- HISTORY CONSOLE -->
    <HistoryConsole />

    <!-- FOOTER -->
    <footer
      class="tw:mt-auto tw:border-t tw:border-border-subtle tw:py-4 tw:text-sm tw:text-slate-500 tw:dark:border-border-subtle-dark tw:dark:text-slate-400"
    >
      <nav
        class="tw:mx-auto tw:flex tw:max-w-6xl tw:flex-wrap tw:items-center tw:justify-center tw:gap-x-6 tw:gap-y-2 tw:px-4"
      >
        <a
          href="https://doc.yunohost.org/admin"
          target="_blank"
          class="tw:hover:text-brand-600"
          >{{ $t('footer.documentation') }}</a
        >
        <a
          href="https://doc.yunohost.org/community/help/"
          target="_blank"
          class="tw:hover:text-brand-600"
          >{{ $t('footer.help') }}</a
        >
        <a
          href="https://doc.yunohost.org/community/terms_of_services/"
          target="_blank"
          class="tw:hover:text-brand-600"
          >{{ $t('footer.tos') }}</a
        >
        <a
          href="https://yunohost.org/donate.html"
          target="_blank"
          class="tw:hover:text-brand-600"
          >{{ $t('footer.donate') }}</a
        >

        <span v-if="yunohost" id="yunohost-version" class="tw:ml-auto">
          <span v-html="$t('footer_version', yunohost)" />
        </span>
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
