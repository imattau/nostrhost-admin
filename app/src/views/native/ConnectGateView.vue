<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { Button } from '@/components/ui/button'
import { useSigner } from '@/composables/useSigner'

const { admin, publicKey, username, connect } = useSigner()
const route = useRoute()

const denied = route.query.denied === '1'
const portalUrl = `${window.location.origin}/nostrhost/sso/`

// Single sign-in: the console authenticates through the portal session. If
// there is no session the user is sent to the portal login (which redirects
// back here); a signed-in non-admin sees a refusal rather than a login.
onMounted(() => {
  if (publicKey.value && !admin.value) return // stay on this refusal screen
  // `redirect` is the bare in-app path the router guard captured (e.g.
  // "/apps"); the console uses hash history with base /nostrhost/admin/, so
  // it needs the origin + base + "#" prefix before the portal can send the
  // user back to the right screen after login.
  const back = route.query.redirect
  const path = typeof back === 'string' ? back : '/'
  const absoluteBack = `${window.location.origin}${import.meta.env.BASE_URL}#${path}`
  const target = `${window.location.origin}/nostrhost/sso/login?r=${btoa(absoluteBack)}`
  window.location.assign(target)
})
</script>

<template>
  <div
    class="tw:flex tw:min-h-screen tw:items-center tw:justify-center tw:bg-background tw:p-6 tw:font-sans"
  >
    <div v-if="denied" class="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:text-center">
      <div>
        <p class="tw:text-lg tw:font-medium tw:text-foreground">Access denied</p>
        <p class="tw:mt-2 tw:text-sm tw:text-muted-foreground">
          You are signed in{{ username ? ` as ${username}` : '' }}, but your
          account is not an administrator of this console.
        </p>
      </div>
      <div class="tw:flex tw:gap-2">
        <Button variant="outline" size="sm" as="a" :href="portalUrl">
          Open portal
        </Button>
        <Button variant="outline" size="sm" @click="connect">Sign out</Button>
      </div>
    </div>
    <div v-else class="tw:text-center">
      <p class="tw:text-sm tw:text-muted-foreground">Redirecting to sign in…</p>
    </div>
  </div>
</template>
