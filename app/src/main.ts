import { createApp } from 'vue'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist-mono/latin-400.css'

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
app.use(router).mount('#app')
