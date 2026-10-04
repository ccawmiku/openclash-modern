import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  base: '/luci-static/openclash-modern/',
  build: { manifest: true, sourcemap: false, chunkSizeWarningLimit: 180 },
  server: { port: 5179, strictPort: true },
  preview: { port: 5179, strictPort: true },
})
