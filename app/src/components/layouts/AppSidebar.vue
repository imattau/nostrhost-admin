<script setup lang="ts">
import { ExternalLink } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const baseUrl = import.meta.env.BASE_URL

// Nav items are derived from the route table itself (routes.ts), not
// hand-maintained here, so the sidebar can never link to a screen that
// doesn't exist yet.
const navItems = computed(() =>
  router.options.routes
    .filter((route) => route.meta?.nav)
    .map((route) => ({
      to: { name: route.name },
      label: route.meta!.nav!.label,
      icon: route.meta!.nav!.icon,
    })),
)

// The user portal is a separate SPA served by YunoHost at /yunohost/sso/ on
// the same domain (see conf/caddy/caddy_domain.conf in nostrhost-yunohost) —
// there is no native API route for it, so this is a plain same-origin link
// rather than a router entry.
const portalUrl = `${window.location.origin}/yunohost/sso/`
</script>

<template>
  <aside
    class="tw:flex tw:w-[260px] tw:shrink-0 tw:flex-col tw:justify-between tw:border-r tw:border-border-subtle tw:bg-surface tw:p-6"
  >
    <div class="tw:flex tw:flex-col tw:gap-8">
      <RouterLink
        :to="{ name: 'native-packages' }"
        class="tw:flex tw:items-center tw:gap-3 tw:text-foreground tw:no-underline tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-brand-500 tw:rounded-lg"
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

      <nav class="tw:flex tw:w-full tw:flex-col tw:gap-2">
        <RouterLink
          v-for="item in navItems"
          :key="item.label"
          v-slot="{ isActive }"
          :to="item.to"
          custom
        >
          <a
            :href="router.resolve(item.to).href"
            class="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:px-4 tw:py-3 tw:text-sm tw:no-underline tw:transition-colors"
            :class="
              isActive
                ? 'tw:border-brand-500 tw:bg-brand-500/10 tw:font-semibold tw:text-foreground'
                : 'tw:border-transparent tw:font-medium tw:text-muted-foreground tw:hover:bg-surface-muted'
            "
            @click.prevent="router.push(item.to)"
          >
            <component
              :is="item.icon"
              class="tw:size-[18px]"
              aria-hidden="true"
            />
            {{ item.label }}
          </a>
        </RouterLink>
        <a
          :href="portalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-transparent tw:px-4 tw:py-3 tw:text-sm tw:font-medium tw:text-muted-foreground tw:no-underline tw:transition-colors tw:hover:bg-surface-muted"
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
