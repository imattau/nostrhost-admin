<script setup lang="ts">
import { ChevronRight, Home } from 'lucide-vue-next'

import { useInfos } from '@/composables/useInfos'

const { breadcrumb, updateHtmlTitle } = useInfos()

// Call this here to trigger title update at page load (with translation)
updateHtmlTitle()
</script>

<template>
  <nav v-if="breadcrumb.length" :aria-label="$t('home')">
    <ol
      class="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400"
    >
      <li>
        <RouterLink
          to="/"
          class="tw:flex tw:items-center tw:hover:text-brand-600"
        >
          <span class="tw:sr-only">{{ $t('home') }}</span>
          <Home class="tw:size-4" />
        </RouterLink>
      </li>

      <li
        v-for="({ to, text }, i) in breadcrumb"
        :key="i"
        class="tw:flex tw:items-center tw:gap-1.5"
      >
        <ChevronRight class="tw:size-3.5 tw:shrink-0" />
        <RouterLink
          :to="to"
          class="tw:hover:text-brand-600"
          :class="{
            'tw:font-medium tw:text-slate-900 tw:dark:text-slate-100':
              i === breadcrumb.length - 1,
          }"
          :aria-current="i === breadcrumb.length - 1 ? 'page' : undefined"
        >
          {{ text }}
        </RouterLink>
      </li>
    </ol>
  </nav>
</template>
