<script setup lang="ts">
import { KeyRound } from '@lucide/vue'

import { Button } from '@/components/ui/button'
import { useSigner } from '@/composables/useSigner'

import AppSidebar from './AppSidebar.vue'

const { publicKey, busy, signerAvailable, connect } = useSigner()

function shortenKey(key: string) {
  return `${key.slice(0, 8)}…${key.slice(-6)}`
}
</script>

<template>
  <div
    class="tw:flex tw:min-h-screen tw:bg-background tw:font-sans tw:text-foreground"
  >
    <AppSidebar />

    <div class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
      <header
        class="tw:flex tw:h-20 tw:shrink-0 tw:items-center tw:justify-between tw:border-b tw:border-border-subtle tw:bg-surface tw:px-8"
      >
        <p
          class="tw:font-medium tw:text-sm tw:uppercase tw:text-muted-foreground"
        >
          Self-Hosted Application Hub
        </p>

        <div class="tw:flex tw:items-center tw:gap-3">
          <span
            v-if="publicKey"
            class="tw:font-mono tw:text-xs tw:text-brand-500"
            :title="publicKey"
          >
            {{ shortenKey(publicKey) }}
          </span>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy || !signerAvailable"
            @click="connect"
          >
            <KeyRound class="tw:size-3.5" aria-hidden="true" />
            {{
              busy
                ? 'Connecting…'
                : publicKey
                  ? 'Reconnect signer'
                  : 'Connect signer'
            }}
          </Button>
        </div>
      </header>

      <main class="tw:flex-1 tw:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
