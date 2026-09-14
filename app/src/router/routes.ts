import type { Component } from 'vue'
import {
  Activity,
  Archive,
  AppWindow,
  ArrowUpCircle,
  Bot,
  ClipboardList,
  Flame,
  Globe,
  Globe2,
  LayoutGrid,
  Package,
  Power,
  Server,
  Settings,
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
    nav?: { label: string; icon: Component; group: string }
    // 'bare' skips AppShell (no sidebar/header) — used by the signer gate,
    // which sits in front of the console rather than inside it.
    layout?: 'bare'
  }
}

// Group display order — routes are rendered under their group in this
// order regardless of where they sit in the routes array below.
export const NAV_GROUP_ORDER = [
  'Overview',
  'Apps',
  'People & access',
  'Network',
  'System',
  'Operations',
  'AI',
] as const

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
    meta: { nav: { label: 'Overview', icon: Activity, group: 'Overview' } },
  },
  {
    name: 'app-management',
    path: '/apps',
    component: () => import('@/views/native/AppManagementView.vue'),
    meta: { nav: { label: 'Applications', icon: Package, group: 'Apps' } },
  },
  {
    name: 'native-catalogue',
    path: '/catalogue',
    component: () => import('@/views/native/CatalogueView.vue'),
    meta: { nav: { label: 'Catalogue', icon: LayoutGrid, group: 'Apps' } },
  },
  {
    name: 'native-packages',
    path: '/packages',
    component: () => import('@/views/native/PackageAuthoringView.vue'),
    meta: { nav: { label: 'Package authoring', icon: AppWindow, group: 'Apps' } },
  },
  {
    name: 'native-users',
    path: '/users',
    component: () => import('@/views/native/UserManagementView.vue'),
    meta: { nav: { label: 'Users', icon: UserCog, group: 'People & access' } },
  },
  {
    name: 'native-identities',
    path: '/identities',
    component: () => import('@/views/native/IdentitiesView.vue'),
    meta: { nav: { label: 'Identities', icon: Users, group: 'People & access' } },
  },
  {
    name: 'native-groups',
    path: '/groups',
    component: () => import('@/views/native/GroupsView.vue'),
    meta: {
      nav: { label: 'Groups & permissions', icon: ShieldCheck, group: 'People & access' },
    },
  },
  {
    name: 'native-domains',
    path: '/domains',
    component: () => import('@/views/native/DomainsView.vue'),
    meta: { nav: { label: 'Domains & DNS', icon: Globe, group: 'Network' } },
  },
  {
    name: 'native-nsites',
    path: '/sites',
    component: () => import('@/views/native/NsitesView.vue'),
    meta: { nav: { label: 'Sites', icon: Globe2, group: 'Network' } },
  },
  {
    name: 'native-firewall',
    path: '/firewall',
    component: () => import('@/views/native/FirewallView.vue'),
    meta: { nav: { label: 'Firewall', icon: Flame, group: 'Network' } },
  },
  {
    name: 'native-services',
    path: '/services',
    component: () => import('@/views/native/ServiceControlView.vue'),
    meta: { nav: { label: 'Services', icon: Server, group: 'System' } },
  },
  {
    name: 'native-updates',
    path: '/updates',
    component: () => import('@/views/native/UpdatesView.vue'),
    meta: { nav: { label: 'Updates', icon: ArrowUpCircle, group: 'System' } },
  },
  {
    name: 'native-backups',
    path: '/backups',
    component: () => import('@/views/native/BackupsView.vue'),
    meta: { nav: { label: 'Backups', icon: Archive, group: 'System' } },
  },
  {
    name: 'native-diagnosis',
    path: '/diagnosis',
    component: () => import('@/views/native/DiagnosisView.vue'),
    meta: { nav: { label: 'Diagnosis', icon: Stethoscope, group: 'System' } },
  },
  {
    name: 'native-settings',
    path: '/settings',
    component: () => import('@/views/native/SettingsView.vue'),
    meta: { nav: { label: 'Settings', icon: Settings, group: 'System' } },
  },
  {
    name: 'native-power',
    path: '/power',
    component: () => import('@/views/native/PowerView.vue'),
    meta: { nav: { label: 'Power', icon: Power, group: 'System' } },
  },
  {
    name: 'native-operations',
    path: '/operations',
    component: () => import('@/views/native/OperationsView.vue'),
    meta: { nav: { label: 'History & approvals', icon: ClipboardList, group: 'Operations' } },
  },
  {
    name: 'native-ai',
    path: '/ai',
    component: () => import('@/views/native/AiManagementView.vue'),
    meta: { nav: { label: 'AI management', icon: Bot, group: 'AI' } },
  },
]

export default routes
