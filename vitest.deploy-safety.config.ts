import { defineConfig } from 'vitest/config';

// Dedicated config for scripts/**/*.test.mjs (deploy-environment.mjs, deployment-check.mjs,
// deployment-preflight.mjs and their -lib.mjs modules). These are plain Node scripts with no
// React/jsdom dependency, run as their own clearly-named CI job (see #475) distinct from the
// application's frontend test suite in vitest.config.ts.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.{test,spec}.mjs'],
  },
});
