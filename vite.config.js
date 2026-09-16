import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/cursor-playground/',
  build: {
    rollupOptions: {
      input: ['index.html', 'readme/index.html'],
    },
  },
  plugins: [react()],
})
