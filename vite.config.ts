import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'

const DEPLOY_ENV_BY_MODE: Record<string, string> = {
  development: 'dev',
  staging: 'beta',
  production: 'prod',
}

function currentGitSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA

  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'sodc-deployment-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'deployment-manifest.json',
          source: JSON.stringify(
            {
              schemaVersion: 'sodc-deployment-manifest/v1',
              environment: DEPLOY_ENV_BY_MODE[mode] ?? mode,
              gitSha: currentGitSha(),
              builtAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        })
      },
    },
  ],
  build: {
    // Increase chunk size warning limit (we'll handle chunking manually)
    chunkSizeWarningLimit: 1000,
    // Disable source maps for smaller production builds
    sourcemap: false,
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
          if (id.includes('node_modules/firebase/') || id.includes('node_modules/@firebase/')) {
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
}))
