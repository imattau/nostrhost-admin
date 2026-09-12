import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    name: 'native-packages',
    path: '/',
    alias: '/packages',
    component: () => import('@/views/native/PackageAuthoringView.vue'),
  },
]

export default routes
