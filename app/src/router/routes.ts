import type { Component } from 'vue'
import { AppWindow } from '@lucide/vue'
import type { RouteRecordRaw } from 'vue-router'

// A route carries `meta.nav` only when it should appear in the sidebar —
// the shell renders exactly the routes below, so it can never point at a
// screen that doesn't exist yet.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: { label: string; icon: Component }
  }
}

const routes: RouteRecordRaw[] = [
  {
    name: 'native-packages',
    path: '/',
    alias: '/packages',
    component: () => import('@/views/native/PackageAuthoringView.vue'),
    meta: { nav: { label: 'Packages', icon: AppWindow } },
  },
]

export default routes
