import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,     // fixes hot reload on Windows
      interval: 500,        // check for changes every 500ms
    },
    host: true,
    strictPort: true,
    port: 5173
  }
})