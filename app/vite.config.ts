import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8190'

  return {
    base: mode === 'production' ? env.VITE_BASE_URL || '/admin/' : '/',
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: env.VITE_HOST || '127.0.0.1',
      port: Number(env.VITE_PORT || 8080),
      proxy: Object.fromEntries(
        [
          '/healthz',
          '/system',
          '/service',
          '/app',
          '/package',
          '/identity',
          '/catalog',
          '/capability',
          '/events',
        ].map((path) => [
          path,
          { target: apiTarget, changeOrigin: false, xfwd: true },
        ]),
      ),
    },
  }
})
