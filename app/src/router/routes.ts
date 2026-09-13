import type { Component } from 'vue'
import {
  Activity,
  Archive,
  AppWindow,
  ArrowUpCircle,
  Bot,
  Flame,
  Globe,
  LayoutGrid,
  Package,
  Server,
  ShieldCheck,
  Stethoscope,
  UserCog,
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
    name: 'native-users',
    path: '/users',
    component: () => import('@/views/native/UserManagementView.vue'),
    meta: { nav: { label: 'Users', icon: UserCog } },
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
  {
    name: 'native-updates',
    path: '/updates',
    component: () => import('@/views/native/UpdatesView.vue'),
    meta: { nav: { label: 'Updates', icon: ArrowUpCircle } },
  },
  {
    name: 'native-domains',
    path: '/domains',
    component: () => import('@/views/native/DomainsView.vue'),
    meta: { nav: { label: 'Domains', icon: Globe } },
  },
  {
    name: 'native-backups',
    path: '/backups',
    component: () => import('@/views/native/BackupsView.vue'),
    meta: { nav: { label: 'Backups', icon: Archive } },
  },
  {
    name: 'native-diagnosis',
    path: '/diagnosis',
    component: () => import('@/views/native/DiagnosisView.vue'),
    meta: { nav: { label: 'Diagnosis', icon: Stethoscope } },
  },
  {
    name: 'native-firewall',
    path: '/firewall',
    component: () => import('@/views/native/FirewallView.vue'),
    meta: { nav: { label: 'Firewall', icon: Flame } },
  },
  {
    name: 'native-groups',
    path: '/groups',
    component: () => import('@/views/native/GroupsView.vue'),
    meta: { nav: { label: 'Groups & permissions', icon: ShieldCheck } },
  },
]

export default routes
