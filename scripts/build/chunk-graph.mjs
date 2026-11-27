const PROTECTED_ROUTES = [
  'src/features/auth/components/AuthGate.tsx',
  'src/features/auth/components/RegisterPage.tsx',
  'src/features/auth/components/PasswordResetRequestPage.tsx',
  'src/features/guests/GuestTicketPage.tsx',
];

function sourceModule(id) {
  if (typeof id !== 'string') return null;
  const normalized = id.replaceAll('\\', '/').split(/[?#]/, 1)[0];
  if (normalized.startsWith('src/')) return normalized;
  const start = normalized.lastIndexOf('/src/');
  return start < 0 ? null : normalized.slice(start + 1);
}

/**
 * Check the final emitted JavaScript graph, rather than source-module imports
 * or Vite's dynamic-import preload list. Non-emitted imports are not graph
 * vertices: Rollup permits external imports, and Vite can remove CSS-only
 * chunks during generateBundle.
 * @param {import('rollup').OutputBundle} bundle
 */
export function validateChunkGraph(bundle) {
  const chunks = new Map(Object.entries(bundle).filter(([, item]) => item.type === 'chunk'));
  const imports = new Map([...chunks].map(([file, chunk]) => [
    file, chunk.imports.filter(dependency => chunks.has(dependency)),
  ]));
  const visited = new Set();
  const visiting = new Map();
  const path = [];

  const visit = file => {
    if (visiting.has(file)) {
      const cycle = [...path.slice(visiting.get(file)), file];
      throw new Error(`Static chunk cycle: ${cycle.join(' -> ')}. Review manualChunks boundaries and shared dependency ownership to remove the static back-edge.`);
    }
    if (visited.has(file)) return;
    visiting.set(file, path.length);
    path.push(file);
    for (const dependency of imports.get(file)) visit(dependency);
    path.pop();
    visiting.delete(file);
    visited.add(file);
  };
  for (const file of [...chunks.keys()].sort()) visit(file);

  const tasks = new Set([...chunks].filter(([, chunk]) => chunk.name === 'mui-task').map(([file]) => file));
  const assertDeferred = (root, description) => {
    const seen = new Set();
    const pending = [[root]];
    while (pending.length) {
      const chain = pending.pop();
      const file = chain.at(-1);
      if (seen.has(file)) continue;
      seen.add(file);
      if (tasks.has(file)) {
        throw new Error(`Deferred mui-task is statically reachable from ${description}: ${chain.join(' -> ')}. Keep task-only controls out of eager imports and keep shared helpers in the core chunk.`);
      }
      for (const dependency of imports.get(file)) pending.push([...chain, dependency]);
    }
  };
  for (const [entry, chunk] of chunks) {
    if (chunk.isEntry) assertDeferred(entry, 'entry');
  }

  // Route names are not stable chunk filenames: Rollup can coalesce modules or
  // preserve only a facade. Use source identities and count distinct owners.
  const owners = new Map();
  for (const [file, chunk] of chunks) {
    const ids = [...Object.keys(chunk.modules ?? {}), ...(chunk.moduleIds ?? []), chunk.facadeModuleId];
    for (const id of ids) {
      const source = sourceModule(id);
      if (!source) continue;
      if (!owners.has(source)) owners.set(source, new Set());
      owners.get(source).add(file);
    }
  }
  const isApplication = owners.has('src/main.tsx') || owners.has('src/App.tsx');
  for (const route of PROTECTED_ROUTES) {
    const routeOwners = owners.get(route) ?? new Set();
    // Inert deployment fixtures contain none of these application modules.
    // An actual app cannot silently lose protection if a source path changes.
    if (!isApplication && routeOwners.size === 0) continue;
    if (routeOwners.size !== 1) {
      throw new Error(`Protected route ${route} must have exactly one emitted chunk owner; found ${routeOwners.size}. Review the route source path and Rollup module ownership before updating this guard.`);
    }
    assertDeferred([...routeOwners][0], `protected route ${route}`);
  }
}

/** @returns {import('vite').Plugin} */
export function chunkGraphGuard() {
  return {
    name: 'sodc-chunk-graph',
    apply: 'build',
    enforce: 'post',
    // Rollup 4's post hook runs after Vite 7's normal generateBundle hooks,
    // including CSS-only chunk removal and dynamic-import preload rewriting.
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        validateChunkGraph(bundle);
      },
    },
  };
}
