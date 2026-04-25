import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Remove console and debugger in production
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    // Increase chunk size warning limit (we'll handle chunking manually)
    chunkSizeWarningLimit: 1000,
    // Disable source maps for smaller production builds
    sourcemap: false,
    // Use esbuild for faster builds (built-in, no extra dependency)
    minify: 'esbuild',
    // Manual chunking strategy for better code splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor'
          }
          if (
            id.includes('node_modules/@mui/material') ||
            id.includes('node_modules/@mui/icons-material') ||
            id.includes('node_modules/@emotion/react') ||
            id.includes('node_modules/@emotion/styled')
          ) {
            return 'mui-vendor'
          }
          if (id.includes('node_modules/firebase/')) {
            return 'firebase-vendor'
          }
          if (id.includes('dataconnect-generated') || id.includes('node_modules/@dataconnect/')) {
            return 'dataconnect-vendor'
          }
        },
      },
    },
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // CSS code splitting
    cssCodeSplit: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@mui/icons-material',
      'firebase/auth',
      'firebase/functions',
      'firebase/data-connect',
    ],
  },
})
