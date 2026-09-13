<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import {
  getHealth,
  getIdentities,
  getSystemVersions,
  type Health,
  type Identity,
  type SystemVersions,
} from '@/api/nativeSystem'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'

const { publicKey, signerAvailable, sync } = useSigner()

const health = ref<Health | null>(null)
const versions = ref<SystemVersions | null>(null)
const identities = ref<Identity[] | null>(null)
const error = ref('')
const loading = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await sync()
    const [healthResult, versionsResult, identitiesResult] = await Promise.all([
      getHealth(),
      getSystemVersions(),
      getIdentities(),
    ])
    health.value = healthResult
    versions.value = versionsResult
    identities.value = identitiesResult
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : 'Failed to load system status.'
  } finally {
    loading.value = false
  }
}

function shortenKey(key: string) {
  return `${key.slice(0, 12)}…${key.slice(-8)}`
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
        NostrHost native status
      </p>
      <h1 class="tw:mt-1 tw:text-2xl tw:font-bold tw:text-foreground">
        System overview
      </h1>
      <p class="tw:mt-2 tw:max-w-2xl tw:text-sm tw:text-muted-foreground">
        Read-only reachability, version, and identity reads from the native API.
        This screen cannot change host state.
      </p>
    </header>

    <Alert v-if="!signerAvailable" variant="danger">
      A NIP-07 browser signer is required. Enable a signer extension, then
      reload this page.
    </Alert>
    <Alert v-else-if="!publicKey" variant="info">
      Connect your signer above to load system status.
    </Alert>
    <Alert v-if="error" variant="danger" role="alert">{{ error }}</Alert>

    <div v-if="publicKey" class="tw:flex tw:items-center tw:justify-between">
      <p class="tw:text-sm tw:text-muted-foreground">
        Signed in as
        <code class="tw:font-mono">{{ shortenKey(publicKey) }}</code>
      </p>
      <Button variant="outline" size="sm" :disabled="loading" @click="load">{{
        loading ? 'Refreshing…' : 'Refresh'
      }}</Button>
    </div>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>API health</CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="health" class="tw:flex tw:items-center tw:gap-2">
          <Badge :variant="health.ok ? 'success' : 'danger'">
            {{ health.ok ? 'Reachable' : 'Unreachable' }}
          </Badge>
          <span class="tw:text-sm tw:text-muted-foreground"
            >API version {{ health.version }}</span
          >
        </div>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Checking…' : 'No health data yet.' }}
        </p>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Installed versions</CardTitle>
      </CardHeader>
      <CardContent>
        <ul
          v-if="versions && Object.keys(versions).length"
          class="tw:grid tw:gap-2"
        >
          <li
            v-for="(info, name) in versions"
            :key="name"
            class="tw:flex tw:items-center tw:justify-between tw:gap-3 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <code class="tw:font-mono tw:text-sm tw:text-foreground">{{
              name
            }}</code>
            <span class="tw:text-sm tw:text-muted-foreground">
              {{ info.version ?? 'unknown' }}
              <template v-if="info.repo"> · {{ info.repo }}</template>
            </span>
          </li>
        </ul>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Loading…' : 'No version data yet.' }}
        </p>
      </CardContent>
    </Card>

    <Card v-if="publicKey">
      <CardHeader>
        <CardTitle>Linked identities</CardTitle>
      </CardHeader>
      <CardContent>
        <ul v-if="identities && identities.length" class="tw:grid tw:gap-2">
          <li
            v-for="identity in identities"
            :key="identity.pubkey"
            class="tw:grid tw:gap-1 tw:rounded-lg tw:border tw:border-border-subtle tw:p-3"
          >
            <div class="tw:flex tw:items-center tw:justify-between tw:gap-3">
              <strong class="tw:text-sm tw:text-foreground">{{
                identity.username
              }}</strong>
              <Badge :variant="identity.enabled ? 'success' : 'neutral'">
                {{ identity.enabled ? 'Enabled' : 'Disabled' }}
              </Badge>
            </div>
            <code class="tw:font-mono tw:text-xs tw:text-muted-foreground">{{
              shortenKey(identity.pubkey)
            }}</code>
            <span class="tw:text-xs tw:text-muted-foreground"
              >{{ identity.signer_type
              }}<template v-if="identity.label">
                · {{ identity.label }}</template
              ></span
            >
          </li>
        </ul>
        <p v-else class="tw:text-sm tw:text-muted-foreground">
          {{ loading ? 'Loading…' : 'No linked identities yet.' }}
        </p>
      </CardContent>
    </Card>
  </section>
</template>
