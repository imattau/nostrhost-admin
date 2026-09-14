import { createApp } from 'vue'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist-mono/latin-400.css'

import App from './App.vue'
import router from './router'
import { useTheme } from '@/composables/useTheme'

import '@/assets/tailwind.css'

// Apply the persisted/system theme before the app mounts so there's no
// flash of the wrong palette.
useTheme()

createApp(App).use(router).mount('#app')
