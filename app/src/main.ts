import { createApp } from 'vue'
import '@fontsource/geist/latin-400.css'
import '@fontsource/geist/latin-600.css'
import '@fontsource/geist-mono/latin-400.css'

import App from './App.vue'
import router from './router'

import '@/assets/tailwind.css'

createApp(App).use(router).mount('#app')
