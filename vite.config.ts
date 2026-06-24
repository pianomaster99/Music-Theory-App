import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // The Python ML project (incl. its multi-GB .venv with tens of thousands of
    // torch header files) lives in ml/. Watching it blows past the inotify limit
    // (ENOSPC), so skip that whole subtree and any venv.
    watch: {
      ignored: [
        path.resolve(__dirname, 'ml'),
        path.resolve(__dirname, 'ml/**'),
        '**/ml/**',
        '**/.venv/**',
        '**/dist/**',
      ],
    },
  },
})
