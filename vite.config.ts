import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { chunkGraphGuard } from './scripts/build/chunk-graph.mjs'

const DEPLOY_ENV_BY_MODE: Record<string, string> = {
  development: 'dev',
  staging: 'beta',
  production: 'prod',
}

// Keep later-used controls together: the shell and Home need the core UI, while
// the first section/admin task can fetch one shared chunk rather than many files.
// Common auth, onboarding and guest form controls stay in core. Entries below
// belong only to deferred task routes; the build guard rejects static cycles
// and any eager path to mui-task.
const TASK_COMPONENTS = new Set([
  'Autocomplete', 'useAutocomplete', 'Checkbox', 'Radio',
  'RadioGroup', 'FormGroup', 'ToggleButton', 'ToggleButtonGroup',
  'TablePagination', 'TablePaginationActions',
  'Tabs', 'Tab', 'TabScrollButton', 'Tooltip', 'Popper', 'Chip', 'Pagination',
  'PaginationItem', 'usePagination', 'Table', 'TableBody', 'TableHead',
  'TableCell', 'TableRow', 'TableContainer', 'TableSortLabel', 'Collapse',
  'Accordion', 'AccordionSummary', 'AccordionDetails', 'ListItem', 'ListItemSecondaryAction',
  'ListSubheader', 'Breadcrumbs', 'DialogContentText', 'LinearProgress',
])

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
  // An open HMR WebSocket can prevent real browser-cache restoration in acceptance.
  ...(mode === 'session-e2e' ? { server: { hmr: false } } : {}),
  plugins: [
    react(),
    // Fail the build if shared dependencies pull deferred controls into startup.
    chunkGraphGuard(),
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
          const materialPath = id.split('/node_modules/@mui/material/')[1]?.replace(/^esm\//, '')
          const component = materialPath?.split('/')[0]
          if (component && TASK_COMPONENTS.has(component)) {
            return 'mui-task'
          }
          if (
            id.includes('node_modules/@mui/') ||
            id.includes('node_modules/@emotion/') ||
            // The shell's Fade/Grow and the deferred Collapse share these.
            // Explicit core ownership prevents a core -> task -> core cycle.
            id.includes('node_modules/react-transition-group/') ||
            id.includes('node_modules/@babel/runtime/')
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
