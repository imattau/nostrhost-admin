import type { Component } from 'vue'
import { Activity, AppWindow, LayoutGrid, Users } from '@lucide/vue'
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
    name: 'native-overview',
    path: '/',
    component: () => import('@/views/native/SystemOverviewView.vue'),
    meta: { nav: { label: 'Overview', icon: Activity } },
  },
  {
    name: 'native-packages',
    path: '/packages',
    component: () => import('@/views/native/PackageAuthoringView.vue'),
    meta: { nav: { label: 'Packages', icon: AppWindow } },
  },
  {
    name: 'native-catalogue',
    path: '/catalogue',
    component: () => import('@/views/native/CatalogueView.vue'),
    meta: { nav: { label: 'Catalogue', icon: LayoutGrid } },
  },
  {
    name: 'native-identities',
    path: '/identities',
    component: () => import('@/views/native/IdentitiesView.vue'),
    meta: { nav: { label: 'Identities', icon: Users } },
  },
]

export default routes
