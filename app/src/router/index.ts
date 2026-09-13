import { createRouter, createWebHashHistory } from 'vue-router'

import { useSigner } from '@/composables/useSigner'

import routes from './routes'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ left: 0, top: 0 }),
})

// There is no session cookie or stored credential — the signer connection
// lives only in memory for this page load — so every navigation re-checks
// it and gates the whole console behind /connect rather than letting each
// view discover on its own that nothing is signed in.
router.beforeEach((to) => {
  const { publicKey } = useSigner()
  const isConnectRoute = to.name === 'native-connect'

  if (!publicKey.value && !isConnectRoute) {
    return { name: 'native-connect', query: { redirect: to.fullPath } }
  }
  if (publicKey.value && isConnectRoute) {
    const redirect = to.query.redirect
    return typeof redirect === 'string' ? redirect : { name: 'native-overview' }
  }
  return true
})

export default router
