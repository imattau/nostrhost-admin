<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { getCatalogueList, type CatalogueEntry } from '@/api/nativeCatalog'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'
import PageHeader from '@/components/native/PageHeader.vue'
import PageLayout from '@/components/native/PageLayout.vue'

const { publicKey, sync } = useSigner()

const entries = ref<CatalogueEntry[] | null>(null)
const error = ref('')
const loading = ref(false)
const search = ref('')
const category = ref('all')

const categories = computed(() => {
  const found = new Set<string>()
  for (const entry of entries.value || []) {
    if (entry.declaration.Category) found.add(entry.declaration.Category)
  }
  return Array.from(found).sort()
})

const visibleEntries = computed(() =>
  (entries.value || []).filter((entry) => {
    const matchesCategory =
      category.value === 'all' || entry.declaration.Category === category.value
    const needle = search.value.trim().toLocaleLowerCase()
    const matchesSearch =
      !needle ||
      `${entry.declaration.Name} ${entry.declaration.AppID} ${entry.declaration.Description}`
        .toLocaleLowerCase()
        .includes(needle)
    return matchesCategory && matchesSearch
  }),
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const result = await getCatalogueList()
    entries.value = result.entries
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load the catalogue.'
  } finally {
    loading.value = false
  }
}

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}

onMounted(() => {
  if (publicKey.value) load()
})
watch(publicKey, (key) => {
  if (key) load()
})
</script>

<template>
  <PageLayout>
    <PageHeader
      eyebrow="Trusted native catalogue"
      title="Catalogue"
      description="Signed app declarations this node trusts, synced from the control relay. Read-only; this screen cannot install or publish apps."
    />

    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <div
      v-if="publicKey"
      class="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-2"
    >
      <p class="tw:text-sm tw:text-muted-foreground">
        {{
          entries
            ? `${visibleEntries.length} of ${entries.length} trusted app(s)`
            : ''
        }}
      </p>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">{{
        loading ? 'Refreshing…' : 'Refresh'
      }}</Button>
    </div>

    <div
      v-if="publicKey && entries && entries.length"
      class="tw:flex tw:flex-wrap tw:gap-2"
    >
      <label class="tw:sr-only" for="catalogue-search">Search catalogue</label>
      <input
        id="catalogue-search"
        v-model="search"
        class="tw:min-w-48 tw:flex-1 tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
        placeholder="Search trusted apps"
      />
      <label class="tw:sr-only" for="catalogue-category"
        >Filter by category</label
      >
      <select
        id="catalogue-category"
        v-model="category"
        class="tw:rounded-md tw:border tw:border-border-subtle tw:bg-surface tw:px-3 tw:py-2 tw:text-sm"
      >
        <option value="all">All categories</option>
        <option v-for="item in categories" :key="item" :value="item">
          {{ item }}
        </option>
      </select>
    </div>

    <p
      v-if="publicKey && entries && entries.length === 0"
      class="tw:text-sm tw:text-muted-foreground"
    >
      No trusted apps in the catalogue yet.
    </p>
    <p
      v-else-if="publicKey && entries && visibleEntries.length === 0"
      class="tw:text-sm tw:text-muted-foreground"
    >
      No trusted apps match this search or category.
    </p>

    <div
      v-if="visibleEntries.length"
      class="tw:grid tw:gap-4 tw:sm:grid-cols-2 tw:lg:grid-cols-3"
    >
      <Card v-for="entry in visibleEntries" :key="entry.event_id">
        <CardHeader>
          <CardTitle
            class="tw:flex tw:items-center tw:justify-between tw:gap-2"
          >
            <span class="tw:truncate">{{
              entry.declaration.Name || entry.declaration.AppID
            }}</span>
            <Badge variant="brand">v{{ entry.declaration.Version }}</Badge>
          </CardTitle>
          <p class="tw:font-mono tw:text-xs tw:text-muted-foreground">
            {{ entry.declaration.AppID }}
            <span v-if="entry.declaration.Category"
              >· {{ entry.declaration.Category }}</span
            >
          </p>
        </CardHeader>
        <CardContent>
          <p
            v-if="entry.declaration.Description"
            class="tw:mb-3 tw:line-clamp-2 tw:text-xs tw:text-muted-foreground"
          >
            {{ entry.declaration.Description }}
          </p>
          <dl class="tw:grid tw:gap-1.5 tw:text-xs">
            <div class="tw:grid tw:gap-0.5">
              <dt class="tw:text-muted-foreground">Repository</dt>
              <dd class="tw:truncate tw:font-mono tw:text-foreground">
                {{ entry.declaration.Repository }}
              </dd>
            </div>
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <dt class="tw:text-muted-foreground">Commit</dt>
              <dd class="tw:font-mono tw:text-foreground">
                {{ shortHash(entry.declaration.Commit) }}
              </dd>
            </div>
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <dt class="tw:text-muted-foreground">Manifest hash</dt>
              <dd class="tw:font-mono tw:text-foreground">
                {{ shortHash(entry.declaration.ManifestHash) }}
              </dd>
            </div>
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <dt class="tw:text-muted-foreground">Content hash</dt>
              <dd class="tw:font-mono tw:text-foreground">
                {{ shortHash(entry.declaration.ContentHash) }}
              </dd>
            </div>
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <dt class="tw:text-muted-foreground">Architectures</dt>
              <dd class="tw:truncate tw:text-foreground">
                {{ entry.declaration.Architectures.join(', ') }}
              </dd>
            </div>
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <dt class="tw:text-muted-foreground">Provenance event</dt>
              <dd class="tw:font-mono tw:text-foreground">
                {{ shortHash(entry.event_id) }}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  </PageLayout>
</template>
