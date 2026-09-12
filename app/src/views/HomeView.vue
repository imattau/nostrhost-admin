<script setup lang="ts">
import {
  Archive,
  Boxes,
  ChevronRight,
  Globe,
  KeyRound,
  RefreshCw,
  Stethoscope,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-vue-next'

import { Card } from '@/components/ui/card'

const menu: { routeName: string; icon: LucideIcon; translation: string }[] = [
  { routeName: 'user-list', icon: Users, translation: 'users' },
  {
    routeName: 'group-list',
    icon: KeyRound,
    translation: 'groups_and_permissions',
  },
  { routeName: 'domain-list', icon: Globe, translation: 'domains' },
  { routeName: 'app-list', icon: Boxes, translation: 'applications' },
  { routeName: 'update', icon: RefreshCw, translation: 'system_update' },
  { routeName: 'tool-list', icon: Wrench, translation: 'tools' },
  {
    routeName: 'diagnosis',
    icon: Stethoscope,
    translation: 'diagnosis',
  },
  { routeName: 'backup', icon: Archive, translation: 'backup' },
]
</script>

<template>
  <section aria-labelledby="home-heading">
    <div class="tw:mb-5">
      <h1
        id="home-heading"
        class="tw:m-0 tw:text-xl tw:font-semibold tw:tracking-tight tw:text-foreground"
      >
        {{ $t('home') }}
      </h1>
      <p class="tw:mb-0 tw:mt-1 tw:text-sm tw:text-muted-foreground">
        NostrHost System Console
      </p>
    </div>
    <div
      class="tw:grid tw:grid-cols-1 tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-4"
    >
      <Card
        v-for="item in menu"
        :key="item.routeName"
        :to="{ name: item.routeName }"
        class="tw:flex tw:items-center tw:gap-3 tw:p-5"
      >
        <div
          class="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-brand-100 tw:text-brand-700 tw:dark:bg-brand-900 tw:dark:text-brand-200"
        >
          <component :is="item.icon" class="tw:size-5" />
        </div>
        <h4
          class="tw:m-0 tw:flex-1 tw:text-sm tw:font-medium tw:text-foreground"
        >
          {{ $t(item.translation) }}
        </h4>
        <ChevronRight class="tw:size-4 tw:shrink-0 tw:text-muted-foreground" />
      </Card>
    </div>
  </section>
</template>
