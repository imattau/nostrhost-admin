<script setup lang="ts">
import { KeyRound } from '@lucide/vue'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSigner } from '@/composables/useSigner'

const { publicKey, busy, error, signerAvailable, connect } = useSigner()
const route = useRoute()
const router = useRouter()

// The router guard already redirects away once publicKey is set, but that
// only re-runs on navigation — watch here so a successful connect leaves
// this screen immediately instead of waiting for the next route change.
watch(publicKey, (key) => {
  if (!key) return
  const redirect = route.query.redirect
  router.replace(
    typeof redirect === 'string' ? redirect : { name: 'native-overview' },
  )
})
</script>

<template>
  <div
    class="tw:flex tw:min-h-screen tw:items-center tw:justify-center tw:bg-background tw:p-6 tw:font-sans"
  >
    <Card class="tw:w-full tw:max-w-sm">
      <CardHeader class="tw:items-center tw:text-center">
        <span
          class="tw:mb-2 tw:flex tw:size-12 tw:items-center tw:justify-center tw:rounded-[14px] tw:bg-brand-500 tw:shadow-[0_4px_6px_rgba(139,92,246,0.5)]"
        >
          <KeyRound class="tw:size-6 tw:text-white" aria-hidden="true" />
        </span>
        <CardTitle class="tw:text-xl">NostrHost</CardTitle>
        <p
          class="tw:font-mono tw:text-[10px] tw:uppercase tw:tracking-wider tw:text-brand-500"
        >
          System console access
        </p>
      </CardHeader>
      <CardContent class="tw:grid tw:gap-4">
        <p class="tw:text-center tw:text-sm tw:text-muted-foreground">
          This console has no username or password. Sign in by authorizing your
          Nostr browser signer — every request is then signed client-side
          (NIP-98) and verified by the control-plane API, with no session cookie
          or stored credential.
        </p>

        <Alert v-if="!signerAvailable" variant="danger">
          No NIP-07 browser signer was found. Install a signer extension (e.g.
          Alby, nos2x), then reload this page.
        </Alert>
        <Alert v-else-if="error" variant="danger" role="alert">{{
          error
        }}</Alert>

        <Button
          variant="primary"
          :disabled="busy || !signerAvailable"
          @click="connect"
        >
          <KeyRound class="tw:size-3.5" aria-hidden="true" />
          {{ busy ? 'Connecting…' : 'Connect signer' }}
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
