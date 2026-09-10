<script setup lang="ts">
import {
  CodeXml,
  Filter,
  LayoutGrid,
  Search,
  Star,
  TriangleAlert,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { VueShowdown } from 'vue-showdown'

import api from '@/api'
import CardDeckFeed from '@/components/CardDeckFeed.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { useForm, useFormQuery } from '@/composables/form'
import { useAutoModal } from '@/composables/useAutoModal'
import { useSearch } from '@/composables/useSearch'
import { pick } from '@/helpers/commons'
import { appRepoUrl, required } from '@/helpers/validators'
import type { Catalog } from '@/types/core/api'
import type { FieldProps, FormFieldDict } from '@/types/form'
import { formatAppQuality } from './appData'

const props = withDefaults(
  defineProps<{
    search?: string
    quality?: 'all' | 'highQuality' | 'decentQuality' | 'working'
    category?: 'all' | string
    subtag?: 'all' | 'others' | string
  }>(),
  {
    search: '',
    quality: 'decentQuality',
    category: 'all',
    subtag: 'all',
  },
)

const { t } = useI18n()
const router = useRouter()
const modalConfirm = useAutoModal()

// Category tiles are an optional way to browse the catalog, not a gate:
// the app list is shown right away so the catalog stays usable as it grows.
const showCategoryBrowser = ref(false)

const [apps, categories] = await api
  .get<Catalog>({
    uri: 'apps/catalog?full&with_categories&with_antifeatures',
    initial: true,
  })
  .then((catalog) => {
    const apps = Object.values(catalog.apps)
      .map((app) => {
        const working = app.state === 'working'
        return {
          ...pick(app, ['id', 'category', 'subtags', 'maintained']),
          ...pick(app.manifest, ['name', 'description']),
          quality: formatAppQuality({ level: app.level, state: app.state }),
          working,
          decentQuality: working && app.level > 4,
          highQuality: working && app.level >= 8,
          logoHash: app.logo_hash,
          searchValues: [
            app.id,
            app.state,
            app.manifest.name,
            app.manifest.description,
            app.potential_alternative_to.join(' '),
          ]
            .join(' ')
            .toLowerCase(),
        }
      })
      .sort((a, b) => (a.id > b.id ? 1 : -1))

    // CATEGORIES
    const categories = [
      { text: t('all_apps'), value: 'all', icon: 'search', subtags: [] },
      ...catalog.categories.map(({ title, id, ...rest }) => {
        return { text: title, value: id, ...rest }
      }),
    ]

    return [apps, categories] as const
  })

const {
  quality,
  category,
  subtag,
  search: externalSearch,
} = useFormQuery(props)

const [search, filteredApps] = useSearch(
  apps,
  (s, app) => {
    // app doesn't match quality filter
    if (props.quality !== 'all' && !app[props.quality]) return false
    // app doesn't match category filter
    if (props.category !== 'all' && app.category !== props.category)
      return false
    if (props.subtag !== 'all') {
      const appMatchSubtag =
        props.subtag === 'others'
          ? app.subtags.length === 0
          : app.subtags.includes(props.subtag)
      // app doesn't match subtag filter
      if (!appMatchSubtag) return false
    }
    if (s === '') return true
    if (app.searchValues.includes(s)) return true
    return false
  },
  {
    externalSearch,
    filterIfNoSearch: true,
    filterAllFn(s) {
      if (props.quality === 'all' && props.category === 'all' && s === '') {
        return true
      }
    },
  },
)

const isPartialSearch = computed(() => {
  return !(['quality', 'category', 'subtag'] as const).every(
    (prop) => props[prop] === 'all',
  )
})

const form = ref({ url: '' })
const fields = {
  url: {
    component: 'InputItem',
    label: t('url'),
    rules: { required, appRepoUrl },
    cProps: {
      id: 'custom-install',
      placeholder: 'https://some.git.forge.tld/USER/REPOSITORY',
    },
  } satisfies FieldProps<'InputItem', string>,
} satisfies FormFieldDict<typeof form.value>
const { v, onSubmit } = useForm(form, fields)

const qualityOptions = [
  { value: 'highQuality', text: t('only_highquality_apps') },
  {
    value: 'decentQuality',
    text: t('only_decent_quality_apps'),
  },
  { value: 'working', text: t('only_working_apps') },
  { value: 'all', text: t('all_apps') },
]

const subtags = computed(() => {
  // build an options array for subtags v-model/options
  if (props.category !== 'all' && categories.length > 1) {
    const category = categories.find((cat) => cat.value === props.category)!
    if (category.subtags.length) {
      const subtags = [{ text: t('all'), value: 'all' }]
      category.subtags.forEach((subtag) => {
        subtags.push({ text: subtag.title, value: subtag.id })
      })
      subtags.push({ text: t('others'), value: 'others' })
      return subtags
    }
  }
  return null
})

// ADVANCED: INSTALL CUSTOM APP is a developer feature, hidden by default
// so it doesn't clutter the catalog for regular end users.
const showCustomInstall = ref(false)

// CATEGORY TILE BROWSER
function onCategoryTileClick(value: string) {
  category.value = value
  showCategoryBrowser.value = false
}

// INSTALL CUSTOM APP
const onCustomInstallClick = onSubmit(async () => {
  const confirmed = await modalConfirm(t('confirm_install_custom_app'))
  if (!confirmed) return

  const url = form.value.url
  router.push({
    name: 'app-install-custom',
    params: { id: url.endsWith('/') ? url : url + '/' },
  })
})
</script>

<template>
  <ViewSearch :items="filteredApps" items-name="apps">
    <template #top-bar>
      <div id="view-top-bar">
        <!-- FILTERS: search + quality + category are all facets on the same
             list, so apps stay visible while filters narrow them down. -->
        <div class="tw:flex tw:flex-wrap tw:gap-3">
          <div class="tw:relative tw:min-w-48 tw:flex-[2_1_auto]">
            <Search
              class="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-slate-400"
            />
            <Input
              id="search-input"
              v-model="search"
              class="tw:pl-9"
              :placeholder="$t('search.for', { items: $t('items.apps', 2) })"
            />
          </div>

          <div class="tw:relative tw:min-w-40">
            <Star
              class="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-slate-400"
            />
            <Select
              v-model="quality"
              class="tw:pl-9"
              :options="qualityOptions"
            />
          </div>

          <div class="tw:relative tw:min-w-40">
            <Filter
              class="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-slate-400"
            />
            <Select v-model="category" class="tw:pl-9" :options="categories" />
          </div>

          <Button
            variant="outline"
            :aria-pressed="showCategoryBrowser"
            @click="showCategoryBrowser = !showCategoryBrowser"
          >
            <LayoutGrid class="tw:size-4" />
            {{
              showCategoryBrowser
                ? $t('app_hide_categories')
                : $t('app_show_categories')
            }}
          </Button>
        </div>

        <!-- CATEGORIES SUBTAGS -->
        <div v-if="subtags" class="tw:mt-3 tw:max-w-64">
          <Select v-model="subtag" :options="subtags" />
        </div>
      </div>
    </template>

    <!-- CATEGORIES CARDS: an optional browsing aid, not a gate — the app
         list below is always shown regardless of this being open. -->
    <template #forced-default="{ noItemsMessage }">
      <ul
        v-if="showCategoryBrowser"
        class="tw:m-0 tw:mb-6 tw:grid tw:list-none tw:grid-cols-1 tw:gap-3 tw:p-0 tw:sm:grid-cols-2 tw:lg:grid-cols-3"
      >
        <li v-for="cat in categories.slice(1)" :key="cat.text">
          <Card
            as="button"
            type="button"
            class="tw:h-full tw:w-full tw:cursor-pointer tw:appearance-none tw:text-center tw:font-sans tw:hover:border-brand-300 tw:hover:shadow-md"
            @click="onCategoryTileClick(cat.value)"
          >
            <h4
              class="tw:m-0 tw:flex tw:items-center tw:justify-center tw:gap-2 tw:text-base tw:font-medium tw:text-slate-900 tw:dark:text-slate-100"
            >
              <YIcon v-if="cat.icon" :iname="cat.icon" /> {{ cat.text }}
            </h4>
            <p
              v-if="'description' in cat"
              class="tw:mt-1 tw:mb-0 tw:text-sm tw:text-slate-500 tw:dark:text-slate-400"
            >
              {{ cat.description }}
            </p>
          </Card>
        </li>
      </ul>

      <CardDeckFeed v-if="filteredApps">
        <article
          v-for="(app, i) in filteredApps"
          :key="app.id"
          :aria-labelledby="`${app.id}-title`"
          :aria-describedby="`${app.id}-desc`"
          :aria-posinset="i + 1"
          :aria-setsize="filteredApps.length"
          class="app-tile"
        >
          <!-- The app name is a "stretched link" covering the whole card
               (::after below); the quality/orphaned badges stay separately
               focusable/clickable on top of it via tw:relative. -->
          <Card class="tw:relative tw:flex tw:h-full tw:gap-3">
            <img
              v-if="app.logoHash"
              class="tw:h-14 tw:w-14 tw:shrink-0 tw:self-start tw:rounded-md tw:bg-white tw:object-contain"
              :src="`./applogos/${app.logoHash}.png`"
              alt=""
            />

            <div
              :id="`${app.id}-card`"
              class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col"
            >
              <h3
                :id="`${app.id}-title`"
                class="tw:m-0 tw:mb-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-base tw:font-medium tw:text-slate-900 tw:dark:text-slate-100"
              >
                <RouterLink
                  :to="{ name: 'app-install', params: { id: app.id } }"
                  class="tw:no-underline tw:after:absolute tw:after:inset-0 tw:after:content-[''] tw:hover:underline"
                >
                  {{ app.name }}
                </RouterLink>

                <Tooltip
                  v-if="app.quality.state !== 'working'"
                  :text="$t(`app_state_${app.quality.state}_explanation`)"
                  class="tw:relative"
                >
                  <!--
                  i18n: app_state_broken
                  i18n: app_state_broken_explanation
                  i18n: app_state_inprogress
                  i18n: app_state_inprogress_explanation
                  i18n: app_state_lowquality
                  i18n: app_state_lowquality_explanation
                  -->
                  <Badge :variant="app.quality.variant" tabindex="0">
                    {{ $t(`app_state_${app.quality.state}`) }}
                  </Badge>
                </Tooltip>

                <Tooltip
                  v-if="app.highQuality"
                  :text="$t('app_state_highquality_explanation')"
                  class="tw:relative"
                >
                  <Star
                    class="tw:size-4 tw:fill-amber-400 tw:text-amber-400"
                    tabindex="0"
                  />
                </Tooltip>
              </h3>

              <p
                :id="`${app.id}-desc`"
                class="tw:m-0 tw:text-sm tw:text-slate-600 tw:dark:text-slate-300"
              >
                {{ app.description }}
              </p>

              <div
                v-if="!app.maintained"
                class="tw:relative tw:mt-auto tw:self-start tw:pt-2"
              >
                <Tooltip :text="$t('orphaned_details')">
                  <Badge variant="warning" tabindex="0">
                    <TriangleAlert class="tw:size-3" />
                    {{ $t('orphaned') }}
                  </Badge>
                </Tooltip>
              </div>
            </div>
          </Card>
        </article>
      </CardDeckFeed>

      <template v-else>
        <YAlert
          v-if="noItemsMessage"
          alert
          icon="exclamation-triangle"
          variant="warning"
        >
          {{ noItemsMessage }}
          <div v-if="isPartialSearch">{{ t('catalog_partial_search') }}</div>
        </YAlert>

        <YAlert v-if="!isPartialSearch">
          <VueShowdown :markdown="t('catalog_wishlist', { search })" />
        </YAlert>
      </template>
    </template>

    <template #bot>
      <!-- INSTALL CUSTOM APP: an advanced/developer feature, tucked behind
           a toggle so it doesn't compete with the catalog for attention. -->
      <div class="tw:mt-8 tw:text-center">
        <Button
          variant="ghost"
          size="sm"
          @click="showCustomInstall = !showCustomInstall"
        >
          <CodeXml class="tw:size-4" />
          {{ $t('custom_app_install') }}
        </Button>
      </div>

      <CardForm
        v-if="showCustomInstall"
        v-model="form"
        icon="download"
        :fields="fields"
        :submit-text="$t('install')"
        :title="$t('custom_app_install')"
        :validations="v"
        class="mt-3"
        @submit.prevent="onCustomInstallClick"
      >
        <template #disclaimer>
          <div class="alert alert-warning">
            <YIcon iname="exclamation-triangle" />
            {{ $t('confirm_install_custom_app') }}
          </div>
        </template>
      </CardForm>
    </template>
  </ViewSearch>
</template>

<style lang="scss" scoped>
#view-top-bar {
  margin-bottom: 2rem;
}

// CardDeckFeed still renders its root as Bootstrap's `.card-deck` (a plain
// flex-wrap container used purely for the feed/infinite-scroll behavior at
// catalog scale) — size the tw-styled `.app-tile` children within it here,
// since Tailwind utilities can't be handed to that component from outside.
.card-deck .app-tile {
  flex-basis: 100%;

  @include media-breakpoint-up(md) {
    flex-basis: 50%;
    max-width: calc(50% - 0.75rem);
  }

  @include media-breakpoint-up(lg) {
    flex-basis: 33%;
    max-width: calc(33.3% - 1rem);
  }
}
</style>
