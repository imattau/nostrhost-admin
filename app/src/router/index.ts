import { createRouter, createWebHashHistory } from 'vue-router'

import { refreshSession, useSigner } from '@/composables/useSigner'

import routes from './routes'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

// Single sign-in: the portal session cookie (nostrhost.portal) is the auth for
// the whole console. On every navigation we probe the native API's public
// /session endpoint; if there is no session the console redirects to the portal
// login (with a redirect back), and a signed-in non-admin is refused.
router.beforeEach(async (to) => {
  const { publicKey, admin } = useSigner()

  // Probe the session on first navigation (subsequent navigations reuse the
  // in-memory result).
  await refreshSession()

  const isConnectRoute = to.name === 'native-connect'

  if (!publicKey.value && !isConnectRoute) {
    // Not signed in at all → portal login, redirecting back here.
    const back = `${to.fullPath}`
    return { name: 'native-connect', query: { redirect: back } }
  }
  if (publicKey.value && !admin.value && !isConnectRoute) {
    // Signed in but not an admin → refuse, don't loop to login.
    return {
      name: 'native-connect',
      query: { redirect: to.fullPath, denied: '1' },
    }
  }
  if (publicKey.value && isConnectRoute) {
    const redirect = to.query.redirect
    return typeof redirect === 'string' ? redirect : { name: 'native-overview' }
  }
  return true
})

export default router
