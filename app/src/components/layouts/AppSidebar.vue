<script setup lang="ts">
import { ChevronDown, ExternalLink } from '@lucide/vue'
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { NAV_GROUP_ORDER } from '@/router/routes'

const props = defineProps<{ open?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const route = useRoute()
const baseUrl = import.meta.env.BASE_URL

// Nav items are derived from the route table itself (routes.ts), not
// hand-maintained here, so the sidebar can never link to a screen that
// doesn't exist yet. Grouped by meta.nav.group, in NAV_GROUP_ORDER.
const navGroups = computed(() => {
  const byGroup = new Map<
    string,
    { to: { name: string }; label: string; icon: unknown }[]
  >()
  for (const r of router.options.routes) {
    if (!r.meta?.nav) continue
    const { group, label, icon } = r.meta.nav
    if (!byGroup.has(group)) byGroup.set(group, [])
    byGroup.get(group)!.push({ to: { name: r.name as string }, label, icon })
  }
  return NAV_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    items: byGroup.get(group)!,
  }))
})

// Every group starts expanded; collapsed state persists only for the
// session (not worth a localStorage entry for a handful of booleans).
const collapsed = reactive<Record<string, boolean>>({})

function toggleGroup(group: string) {
  collapsed[group] = !collapsed[group]
}

function groupIsActive(items: { to: { name: string } }[]) {
  return items.some((item) => item.to.name === route.name)
}

function navigate(to: { name: string }) {
  router.push(to)
  emit('close')
}

// The user portal is a separate SPA served by YunoHost at /nostrhost/sso/ on
// the same domain (see conf/caddy/caddy_domain.conf in nostrhost-yunohost) —
// there is no native API route for it, so this is a plain same-origin link
// rather than a router entry.
const portalUrl = `${window.location.origin}/nostrhost/sso/`
</script>

<template>
  <div
    v-if="props.open"
    class="tw:fixed tw:inset-0 tw:z-40 tw:bg-black/50 tw:lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />
  <aside
    class="tw:fixed tw:inset-y-0 tw:left-0 tw:z-50 tw:flex tw:w-[260px] tw:shrink-0 tw:-translate-x-full tw:flex-col tw:justify-between tw:overflow-y-auto tw:border-r tw:border-border-subtle tw:bg-surface tw:p-6 tw:transition-transform tw:lg:sticky tw:lg:top-0 tw:lg:h-screen tw:lg:translate-x-0"
    :class="props.open ? 'tw:translate-x-0' : ''"
  >
    <div class="tw:flex tw:flex-col tw:gap-8">
      <RouterLink
        :to="{ name: 'native-overview' }"
        class="tw:flex tw:items-center tw:gap-3 tw:text-foreground tw:no-underline tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:rounded-lg"
        @click="emit('close')"
      >
        <span
          class="tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[10px] tw:bg-brand-500 tw:shadow-[0_4px_6px_rgba(139,92,246,0.5)]"
        >
          <img
            :src="`${baseUrl}nostrhost-mark.svg`"
            alt=""
            width="18"
            height="18"
          />
        </span>
        <span class="tw:flex tw:flex-col tw:leading-tight">
          <span class="tw:text-lg tw:font-bold">NostrHost</span>
          <span
            class="tw:font-mono tw:text-[10px] tw:uppercase tw:tracking-wider tw:text-brand-500"
            >System Console</span
          >
        </span>
      </RouterLink>

      <nav class="tw:flex tw:w-full tw:flex-col tw:gap-4">
        <div v-for="entry in navGroups" :key="entry.group">
          <button
            v-if="entry.items.length > 1"
            type="button"
            class="tw:flex tw:w-full tw:items-center tw:justify-between tw:px-2 tw:py-1 tw:font-mono tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-wider tw:text-muted-foreground"
            :aria-expanded="!collapsed[entry.group]"
            @click="toggleGroup(entry.group)"
          >
            {{ entry.group }}
            <ChevronDown
              class="tw:size-3.5 tw:transition-transform"
              :class="collapsed[entry.group] ? '-tw:rotate-90' : ''"
              aria-hidden="true"
            />
          </button>
          <p
            v-else
            class="tw:px-2 tw:py-1 tw:font-mono tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-wider tw:text-muted-foreground"
          >
            {{ entry.group }}
          </p>
          <div
            v-show="!collapsed[entry.group] || groupIsActive(entry.items)"
            class="tw:mt-1 tw:flex tw:flex-col tw:gap-1"
          >
            <RouterLink
              v-for="item in entry.items"
              :key="item.label"
              v-slot="{ isActive }"
              :to="item.to"
              custom
            >
              <a
                :href="router.resolve(item.to).href"
                class="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:px-4 tw:py-2.5 tw:text-sm tw:no-underline tw:transition-colors"
                :class="
                  isActive
                    ? 'tw:border-brand-500 tw:bg-brand-500/10 tw:font-semibold tw:text-foreground'
                    : 'tw:border-transparent tw:font-medium tw:text-muted-foreground tw:hover:bg-surface-muted'
                "
                @click.prevent="navigate(item.to)"
              >
                <component
                  :is="item.icon"
                  class="tw:size-[18px]"
                  aria-hidden="true"
                />
                {{ item.label }}
              </a>
            </RouterLink>
          </div>
        </div>
        <a
          :href="portalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-transparent tw:px-4 tw:py-3 tw:text-sm tw:font-medium tw:text-muted-foreground tw:no-underline tw:transition-colors tw:hover:bg-surface-muted"
          @click="emit('close')"
        >
          <ExternalLink class="tw:size-[18px]" aria-hidden="true" />
          Portal
        </a>
      </nav>
    </div>

    <div
      class="tw:flex tw:w-full tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border-subtle tw:bg-background tw:p-4"
    >
      <div class="tw:flex tw:w-full tw:items-center tw:justify-between">
        <span class="tw:font-mono tw:text-[11px] tw:text-muted-foreground"
          >NostrHost Core</span
        >
        <span
          class="tw:rounded tw:bg-emerald-500/10 tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[10px] tw:font-semibold tw:text-emerald-500"
          >native control plane</span
        >
      </div>
      <hr class="tw:w-full tw:border-border-subtle" />
      <div class="tw:flex tw:w-full tw:items-center tw:gap-2">
        <span class="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-emerald-500" />
        <span class="tw:text-xs tw:text-foreground">State reconciled</span>
      </div>
    </div>
  </aside>
</template>
