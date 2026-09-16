import type { RouteRecordRaw } from 'vue-router'

export const NAV_GROUP_ORDER = [
  'Home',
  'Apps & sites',
  'People & access',
  'Network',
  'Maintenance',
  'Activity',
  'Workbench',
] as const

export type NavGroup = (typeof NAV_GROUP_ORDER)[number]
export type NavMeta = {
  label: string
  group: NavGroup
  attentionKey?: 'pending-operations'
}

// A route carries `meta.nav` only when it should appear in the sidebar —
// the shell renders exactly the routes below, so it can never point at a
// screen that doesn't exist yet.
declare module 'vue-router' {
  interface RouteMeta {
    nav?: NavMeta
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
    meta: { nav: { label: 'Overview', group: 'Home' } },
  },
  {
    name: 'app-management',
    path: '/apps',
    component: () => import('@/views/native/AppManagementView.vue'),
    meta: { nav: { label: 'Applications', group: 'Apps & sites' } },
  },
  {
    name: 'native-catalogue',
    path: '/catalogue',
    component: () => import('@/views/native/CatalogueView.vue'),
    meta: { nav: { label: 'Catalogue trust', group: 'Workbench' } },
  },
  {
    name: 'native-packages',
    path: '/packages',
    component: () => import('@/views/native/PackageAuthoringView.vue'),
    meta: { nav: { label: 'Package authoring', group: 'Workbench' } },
  },
  {
    name: 'native-users',
    path: '/users',
    component: () => import('@/views/native/UserManagementView.vue'),
    meta: { nav: { label: 'Users', group: 'People & access' } },
  },
  {
    name: 'native-identities',
    path: '/identities',
    component: () => import('@/views/native/IdentitiesView.vue'),
    meta: { nav: { label: 'Identities', group: 'People & access' } },
  },
  {
    name: 'native-groups',
    path: '/groups',
    component: () => import('@/views/native/GroupsView.vue'),
    meta: {
      nav: { label: 'Groups & permissions', group: 'People & access' },
    },
  },
  {
    name: 'native-domains',
    path: '/domains',
    component: () => import('@/views/native/DomainsView.vue'),
    meta: { nav: { label: 'Domains & DNS', group: 'Network' } },
  },
  {
    name: 'native-nsites',
    path: '/sites',
    component: () => import('@/views/native/NsitesView.vue'),
    meta: { nav: { label: 'Sites', group: 'Apps & sites' } },
  },
  {
    name: 'native-firewall',
    path: '/firewall',
    component: () => import('@/views/native/FirewallView.vue'),
    meta: { nav: { label: 'Firewall', group: 'Network' } },
  },
  {
    name: 'native-services',
    path: '/services',
    component: () => import('@/views/native/ServiceControlView.vue'),
    meta: { nav: { label: 'Services', group: 'Maintenance' } },
  },
  {
    name: 'native-updates',
    path: '/updates',
    component: () => import('@/views/native/UpdatesView.vue'),
    meta: { nav: { label: 'Updates', group: 'Maintenance' } },
  },
  {
    name: 'native-backups',
    path: '/backups',
    component: () => import('@/views/native/BackupsView.vue'),
    meta: { nav: { label: 'Backups', group: 'Maintenance' } },
  },
  {
    name: 'native-diagnosis',
    path: '/diagnosis',
    component: () => import('@/views/native/DiagnosisView.vue'),
    meta: { nav: { label: 'Diagnosis', group: 'Maintenance' } },
  },
  {
    name: 'native-settings',
    path: '/settings',
    component: () => import('@/views/native/SettingsView.vue'),
    meta: { nav: { label: 'Settings', group: 'Maintenance' } },
  },
  {
    name: 'native-power',
    path: '/power',
    component: () => import('@/views/native/PowerView.vue'),
    meta: { nav: { label: 'Power', group: 'Maintenance' } },
  },
  {
    name: 'native-operations',
    path: '/operations',
    component: () => import('@/views/native/OperationsView.vue'),
    meta: {
      nav: {
        label: 'History & approvals',
        group: 'Activity',
        attentionKey: 'pending-operations',
      },
    },
  },
  {
    name: 'native-ai',
    path: '/ai/:section?',
    component: () => import('@/views/native/AiManagementView.vue'),
    meta: { nav: { label: 'AI management', group: 'Workbench' } },
  },
]

export default routes
