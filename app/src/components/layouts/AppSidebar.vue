<script setup lang="ts">
import {
  Activity,
  Blocks,
  ChevronDown,
  Hammer,
  Network,
  Users,
  Wrench,
} from '@lucide/vue'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import IdentityMenu from '@/components/native/IdentityMenu.vue'
import { NAV_GROUP_ORDER, type NavGroup } from '@/router/routes'

const props = defineProps<{
  open?: boolean
  hostname?: string
  reachable?: boolean | null
}>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const route = useRoute()
const baseUrl = import.meta.env.BASE_URL
const desktop = ref(false)
let desktopQuery: MediaQueryList | null = null

function syncDesktop(event: MediaQueryListEvent | MediaQueryList) {
  desktop.value = event.matches
}

onMounted(() => {
  desktopQuery = window.matchMedia('(min-width: 64rem)')
  syncDesktop(desktopQuery)
  desktopQuery.addEventListener('change', syncDesktop)
})

onUnmounted(() => desktopQuery?.removeEventListener('change', syncDesktop))

const groupIcons: Record<NavGroup, unknown> = {
  Home: Activity,
  'Apps & sites': Blocks,
  'People & access': Users,
  Network,
  Maintenance: Wrench,
  Activity,
  Workbench: Hammer,
}

const navGroups = computed(() => {
  const byGroup = new Map<string, { to: { name: string }; label: string }[]>()
  for (const item of router.options.routes) {
    if (!item.meta?.nav) continue
    const { group, label } = item.meta.nav
    if (!byGroup.has(group)) byGroup.set(group, [])
    byGroup.get(group)!.push({ to: { name: item.name as string }, label })
  }
  return NAV_GROUP_ORDER.filter((group) => byGroup.has(group)).map((group) => ({
    group,
    icon: groupIcons[group],
    items: byGroup.get(group)!,
  }))
})

const collapsed = reactive<Record<string, boolean>>(
  Object.fromEntries(NAV_GROUP_ORDER.map((group) => [group, group !== 'Home'])),
)

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
</script>

<template>
  <div
    v-if="props.open"
    class="tw:fixed tw:inset-0 tw:z-40 tw:bg-black/55 tw:lg:hidden"
    aria-hidden="true"
    @click="emit('close')"
  />
  <aside
    class="workshop-sidebar tw:fixed tw:inset-y-0 tw:left-0 tw:z-50 tw:flex tw:w-[228px] tw:shrink-0 tw:flex-col tw:border-r tw:border-border-subtle tw:bg-workbench tw:transition-transform tw:lg:sticky tw:lg:top-0 tw:lg:h-screen"
    :data-open="props.open ? 'true' : 'false'"
    :aria-hidden="desktop || props.open ? undefined : 'true'"
    :inert="desktop || props.open ? undefined : true"
    aria-label="Workshop navigation"
  >
    <div class="tw:border-b tw:border-border-subtle tw:px-5 tw:pb-4 tw:pt-5">
      <RouterLink
        :to="{ name: 'native-overview' }"
        class="tw:flex tw:items-center tw:gap-3 tw:text-foreground tw:no-underline tw:focus-visible:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-focus"
        @click="emit('close')"
      >
        <span
          class="tw:grid tw:size-8 tw:shrink-0 tw:place-items-center tw:bg-foreground"
        >
          <img
            :src="`${baseUrl}nostrhost-mark.svg`"
            alt=""
            width="16"
            height="16"
          />
        </span>
        <span class="tw:text-base tw:font-semibold tw:tracking-tight"
          >NostrHost</span
        >
      </RouterLink>
      <div class="tw:mt-4 tw:flex tw:items-start tw:gap-2.5">
        <span
          class="tw:mt-1 tw:size-2 tw:shrink-0 tw:rounded-full"
          :class="
            props.reachable === true
              ? 'tw:bg-healthy'
              : props.reachable === false
                ? 'tw:bg-destructive'
                : 'tw:bg-muted-foreground'
          "
          aria-hidden="true"
        />
        <div class="tw:min-w-0">
          <p
            class="tw:m-0 tw:truncate tw:font-mono tw:text-xs tw:text-foreground"
          >
            {{ props.hostname || 'This server' }}
          </p>
          <p class="tw:mb-0 tw:mt-0.5 tw:text-[11px] tw:text-muted-foreground">
            {{
              props.reachable === true
                ? 'Control plane reachable'
                : props.reachable === false
                  ? 'Status unavailable'
                  : 'Checking status…'
            }}
          </p>
        </div>
      </div>
    </div>

    <nav
      class="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-3 tw:py-4"
      aria-label="Console sections"
    >
      <div v-for="entry in navGroups" :key="entry.group" class="tw:mb-3">
        <button
          type="button"
          class="tw:flex tw:min-h-9 tw:w-full tw:items-center tw:gap-2 tw:border-0 tw:bg-transparent tw:px-2 tw:text-left tw:text-[11px] tw:font-semibold tw:text-muted-foreground tw:hover:text-foreground"
          :aria-expanded="!collapsed[entry.group] || groupIsActive(entry.items)"
          @click="toggleGroup(entry.group)"
        >
          <component :is="entry.icon" class="tw:size-3.5" aria-hidden="true" />
          <span class="tw:flex-1">{{ entry.group }}</span>
          <ChevronDown
            class="tw:size-3 tw:transition-transform"
            :class="collapsed[entry.group] ? 'tw:-rotate-90' : ''"
            aria-hidden="true"
          />
        </button>
        <div
          v-show="!collapsed[entry.group] || groupIsActive(entry.items)"
          class="tw:mt-0.5"
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
              class="tw:flex tw:min-h-9 tw:items-center tw:border-l-2 tw:px-3 tw:py-1.5 tw:text-sm tw:no-underline tw:transition-colors"
              :class="
                isActive
                  ? 'tw:border-signature tw:bg-selection tw:font-semibold tw:text-foreground'
                  : 'tw:border-transparent tw:text-muted-foreground tw:hover:border-border-subtle tw:hover:text-foreground'
              "
              @click.prevent="navigate(item.to)"
            >
              {{ item.label }}
            </a>
          </RouterLink>
        </div>
      </div>
    </nav>

    <div class="tw:border-t tw:border-border-subtle tw:p-3">
      <IdentityMenu placement="sidebar" />
    </div>
  </aside>
</template>

<style scoped>
.workshop-sidebar {
  transform: translateX(-100%);
}

.workshop-sidebar[data-open='true'] {
  transform: translateX(0);
}

@media (min-width: 64rem) {
  .workshop-sidebar {
    transform: translateX(0);
  }
}
</style>
