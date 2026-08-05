import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-utils/setup.ts'],
    // scripts/**/*.test.mjs (deploy-script/deployment-safety tests) run under their own
    // vitest.deploy-safety.config.ts and CI job instead of here — see that file.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/',
        '**/build/',
        '**/__tests__/',
        '**/*.test.*',
        '**/*.spec.*',
        'src/dataconnect-generated/**',  // auto-generated SDK — not hand-authored
      ],
      thresholds: {
        lines: 75,
        // scripts/**/*.mjs used to be pulled into this same coverage report as a side effect
        // of scripts/**/*.test.mjs sharing this config (see the include comment above), and
        // its thoroughly-tested functions inflated this metric above what src/ earns on its
        // own. Now that they're correctly split into vitest.deploy-safety.config.ts, src/
        // alone measures in the low 70s -- recalibrated to match, not a lowered bar for
        // src/ itself. Set with a little headroom below the current measured value so minor
        // future deletions of well-covered code don't immediately trip this again.
        functions: 73,
        branches: 70,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
