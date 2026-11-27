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
      throw new Error(`[sodc-chunk-graph] Static chunk cycle: ${cycle.join(' -> ')}. Review manualChunks boundaries and shared dependency ownership to remove the static back-edge.`);
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
  for (const [entry, chunk] of chunks) {
    if (!chunk.isEntry) continue;
    const seen = new Set();
    const pending = [[entry]];
    while (pending.length) {
      const chain = pending.pop();
      const file = chain.at(-1);
      if (seen.has(file)) continue;
      seen.add(file);
      if (tasks.has(file)) {
        throw new Error(`[sodc-chunk-graph] Deferred mui-task is statically reachable from entry: ${chain.join(' -> ')}. Keep task-only controls out of eager imports and keep shared helpers in the core chunk.`);
      }
      for (const dependency of imports.get(file)) pending.push([...chain, dependency]);
    }
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
