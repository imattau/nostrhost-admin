<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSigner } from '@/composables/useSigner'

const { admin, publicKey } = useSigner()
const route = useRoute()
const router = useRouter()

const denied = route.query.denied === '1'

// Single sign-in: the console authenticates through the portal session. If
// there is no session the user is sent to the portal login (which redirects
// back here); a signed-in non-admin sees a refusal rather than a login.
onMounted(() => {
  if (publicKey.value && !admin.value) return // stay on this refusal screen
  const back = route.query.redirect
  const target = `${window.location.origin}/nostrhost/sso/login?r=${btoa(
    typeof back === 'string' ? back : '/nostrhost/admin/',
  )}`
  window.location.assign(target)
})
</script>

<template>
  <div
    class="tw:flex tw:min-h-screen tw:items-center tw:justify-center tw:bg-background tw:p-6 tw:font-sans"
  >
    <div v-if="denied" class="tw:text-center">
      <p class="tw:text-lg tw:font-medium tw:text-foreground">Access denied</p>
      <p class="tw:mt-2 tw:text-sm tw:text-muted-foreground">
        You are signed in, but your account is not an administrator of this
        console.
      </p>
    </div>
    <div v-else class="tw:text-center">
      <p class="tw:text-sm tw:text-muted-foreground">Redirecting to sign in…</p>
    </div>
  </div>
</template>
