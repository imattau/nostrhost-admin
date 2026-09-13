import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    name: 'app-management',
    path: '/',
    alias: '/apps',
    component: () => import('@/views/native/AppManagementView.vue'),
  },
  {
    name: 'native-packages',
    path: '/packages',
    component: () => import('@/views/native/PackageAuthoringView.vue'),
  },
]

export default routes
