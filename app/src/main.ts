import { createApp } from 'vue'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist-mono/latin-400.css'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import router from './router'
import {
  installErrorReporting,
  installVueErrorHandler,
} from '@/lib/errorReport'
import { useTheme } from '@/composables/useTheme'

import '@/assets/tailwind.css'

// Apply the persisted/system theme before the app mounts so there's no
// flash of the wrong palette.
useTheme()

// Capture window/unhandled-rejection/Vue errors into the structured problem
// log (kind=client) via the portal-api report endpoint.
installErrorReporting(router)

const app = createApp(App)
installVueErrorHandler(app)
// A2 server-state: reads/mutations/polling/invalidation go through Vue Query.
// Automatic mutation retries are disabled globally so a rejected write is
// surfaced once (the UI keeps explicit operation-confirmation behaviour).
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5_000,
      },
      mutations: {
        retry: 0,
      },
    },
  },
})
app.use(router).mount('#app')
