import type { Component } from 'vue'
import {
  Activity,
  AppWindow,
  Bot,
  LayoutGrid,
  Package,
  Server,
  Users,
} from '@lucide/vue'
import type { RouteRecordRaw } from 'vue-router'

// A route carries `meta.nav` only when it should appear in the sidebar —
// the shell renders exactly the routes below, so it can never point at a
// screen that doesn't exist yet.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: { label: string; icon: Component }
    // 'bare' skips AppShell (no sidebar/header) — used by the signer gate,
    // which sits in front of the console rather than inside it.
    layout?: 'bare'
  }
}

const routes: RouteRecordRaw[] = [
  {
    name: 'native-connect',
    path: '/connect',
    component: () => import('@/views/native/ConnectGateView.vue'),
    meta: { layout: 'bare' },
  },
  {
    name: 'native-overview',
    path: '/',
    component: () => import('@/views/native/SystemOverviewView.vue'),
    meta: { nav: { label: 'Overview', icon: Activity } },
  },
  {
    name: 'app-management',
    path: '/apps',
    component: () => import('@/views/native/AppManagementView.vue'),
    meta: { nav: { label: 'Applications', icon: Package } },
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
  {
    name: 'native-services',
    path: '/services',
    component: () => import('@/views/native/ServiceControlView.vue'),
    meta: { nav: { label: 'Services', icon: Server } },
  },
  {
    name: 'native-ai',
    path: '/ai',
    component: () => import('@/views/native/AiManagementView.vue'),
    meta: { nav: { label: 'AI management', icon: Bot } },
  },
]

export default routes
