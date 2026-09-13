<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { getCatalogueList, type CatalogueEntry } from '@/api/nativeCatalog'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const entries = ref<CatalogueEntry[] | null>(null)
const error = ref('')
const loading = ref(false)

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
  <section class="tw:mx-auto tw:grid tw:max-w-4xl tw:gap-6">
    <header class="tw:border-b tw:border-border-subtle tw:pb-4">
      <p
        class="tw:font-mono tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-brand-500"
      >
        Trusted native catalogue
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        Catalogue
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Signed app declarations this node trusts, synced from the control relay.
        Read-only; this screen cannot install or publish apps.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      A NIP-07 browser signer is required. Enable a signer extension, then
      reload this page.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Connect your signer above to load the catalogue.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <div v-if="publicKey" class="tw:flex tw:items-center tw:justify-between">
      <p class="tw:text-sm tw:text-muted-foreground">
        {{ entries ? `${entries.length} trusted app(s)` : '' }}
      </p>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">{{
        loading ? 'Refreshing…' : 'Refresh'
      }}</Button>
    </div>

    <p
      v-if="publicKey && entries && entries.length === 0"
      class="tw:text-sm tw:text-muted-foreground"
    >
      No trusted apps in the catalogue yet.
    </p>

    <Card v-for="entry in entries ?? []" :key="entry.event_id">
      <CardHeader>
        <CardTitle
          >{{ entry.declaration.AppID }}
          <Badge variant="brand" class="tw:ml-2"
            >v{{ entry.declaration.Version }}</Badge
          ></CardTitle
        >
      </CardHeader>
      <CardContent>
        <dl class="tw:grid tw:gap-2 tw:text-sm">
          <div class="tw:flex tw:justify-between tw:gap-3">
            <dt class="tw:text-muted-foreground">Repository</dt>
            <dd class="tw:truncate tw:font-mono tw:text-xs tw:text-foreground">
              {{ entry.declaration.Repository }}
            </dd>
          </div>
          <div class="tw:flex tw:justify-between tw:gap-3">
            <dt class="tw:text-muted-foreground">Commit</dt>
            <dd class="tw:font-mono tw:text-xs tw:text-foreground">
              {{ shortHash(entry.declaration.Commit) }}
            </dd>
          </div>
          <div class="tw:flex tw:justify-between tw:gap-3">
            <dt class="tw:text-muted-foreground">Manifest hash</dt>
            <dd class="tw:font-mono tw:text-xs tw:text-foreground">
              {{ shortHash(entry.declaration.ManifestHash) }}
            </dd>
          </div>
          <div class="tw:flex tw:justify-between tw:gap-3">
            <dt class="tw:text-muted-foreground">Content hash</dt>
            <dd class="tw:font-mono tw:text-xs tw:text-foreground">
              {{ shortHash(entry.declaration.ContentHash) }}
            </dd>
          </div>
          <div class="tw:flex tw:justify-between tw:gap-3">
            <dt class="tw:text-muted-foreground">Architectures</dt>
            <dd class="tw:text-xs tw:text-foreground">
              {{ entry.declaration.Architectures.join(', ') }}
            </dd>
          </div>
          <div class="tw:flex tw:justify-between tw:gap-3">
            <dt class="tw:text-muted-foreground">Provenance event</dt>
            <dd class="tw:font-mono tw:text-xs tw:text-foreground">
              {{ shortHash(entry.event_id) }}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  </section>
</template>
