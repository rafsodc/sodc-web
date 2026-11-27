import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkGraphGuard, validateChunkGraph } from '../../../scripts/build/chunk-graph.mjs';

const chunk = (name, imports = [], options = {}) => ({
  type: 'chunk', name, imports, isEntry: false, dynamicImports: [], ...options,
});

test('permits a deferred task chunk sharing the eager core', () => {
  validateChunkGraph({
    'assets/index.js': chunk('index', ['assets/core.js'], {
      isEntry: true, dynamicImports: ['assets/task.js'],
    }),
    'assets/core.js': chunk('mui-vendor', ['assets/react.js']),
    'assets/react.js': chunk('react-vendor'),
    'assets/task.js': chunk('mui-task', ['assets/core.js']),
  });
});

test('rejects a static cycle across emitted paths even outside the entry closure', () => {
  assert.throws(() => validateChunkGraph({
    'assets/index.js': chunk('index', [], { isEntry: true }),
    'assets/core.js': chunk('mui-vendor', ['tasks/controls.js']),
    'tasks/controls.js': chunk('mui-task', ['assets/core.js']),
  }), /^Error: Static chunk cycle: assets\/core\.js -> tasks\/controls\.js -> assets\/core\.js.*manualChunks/);
});

test('rejects a self-import with its emitted filename', () => {
  assert.throws(() => validateChunkGraph({
    'assets/self.js': chunk('self', ['assets/self.js']),
  }), /Static chunk cycle: assets\/self\.js -> assets\/self\.js/);
});

test('rejects a direct task import from an entry', () => {
  assert.throws(() => validateChunkGraph({
    'assets/index.js': chunk('index', ['assets/controls.js'], { isEntry: true }),
    'assets/controls.js': chunk('mui-task'),
  }), /^Error: Deferred mui-task is statically reachable from entry: assets\/index\.js -> assets\/controls\.js/);
});

test('rejects an indirect task import and identifies the complete eager chain', () => {
  assert.throws(() => validateChunkGraph({
    'assets/index.js': chunk('index', ['assets/core.js'], { isEntry: true }),
    'assets/core.js': chunk('mui-vendor', ['tasks/controls.js']),
    'tasks/controls.js': chunk('mui-task'),
  }), /Deferred mui-task is statically reachable from entry: assets\/index\.js -> assets\/core\.js -> tasks\/controls\.js/);
});

test('checks every entry, including a task chunk that itself becomes an entry', () => {
  assert.throws(() => validateChunkGraph({
    'assets/first.js': chunk('first', [], { isEntry: true }),
    'assets/controls.js': chunk('mui-task', [], { isEntry: true }),
  }), /statically reachable from entry: assets\/controls\.js\./);
});

test('ignores external imports, removed CSS-only chunks and non-JavaScript assets', () => {
  validateChunkGraph({
    'assets/index.js': chunk('index', [
      'https://example.invalid/external.js', 'assets/removed-css.js', 'assets/styles.css',
    ], { isEntry: true }),
    'assets/styles.css': { type: 'asset', source: 'body{}' },
  });
});

test('permits a fixture build without a task chunk', () => {
  validateChunkGraph({
    'fixture.js': chunk('fixture', [], { isEntry: true }),
  });
});

test('registers final-graph validation as a build-only post generateBundle hook', () => {
  const plugin = chunkGraphGuard();
  assert.equal(plugin.apply, 'build');
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.generateBundle.order, 'post');
  assert.throws(() => plugin.generateBundle.handler({}, {
    'assets/index.js': chunk('index', ['assets/task.js'], { isEntry: true }),
    'assets/task.js': chunk('mui-task'),
  }), /Deferred mui-task is statically reachable/);
});

// Keep this independent of the runtime guard's list: omitting one route from
// production protection must fail that route's own negative controls.
const protectedRoutes = [
  ['src/features/auth/components/AuthGate.tsx', 'assets/access.js'],
  ['src/features/auth/components/RegisterPage.tsx', 'assets/create.js'],
  ['src/features/auth/components/PasswordResetRequestPage.tsx', 'assets/recover.js'],
  ['src/features/guests/GuestTicketPage.tsx', 'assets/reservation.js'],
];
const appGraph = () => ({
  'assets/index.js': chunk('index', ['assets/core.js'], {
    isEntry: true,
    modules: { '/repo/src/main.tsx': {}, '/repo/src/App.tsx': {} },
    dynamicImports: protectedRoutes.map(([, file]) => file),
  }),
  'assets/core.js': chunk('mui-vendor'),
  'assets/task.js': chunk('mui-task', ['assets/core.js']),
  ...Object.fromEntries(protectedRoutes.map(([source, file]) => [
    file, chunk('opaque-route', ['assets/core.js'], { modules: { [`/repo/${source}`]: {} } }),
  ])),
});

test('permits all four protected routes when each static closure excludes task controls', () => {
  validateChunkGraph(appGraph());
});

for (const [source, file] of protectedRoutes) {
  for (const indirect of [false, true]) {
    test(`rejects ${indirect ? 'indirect' : 'direct'} task use confined to ${source}`, () => {
      const graph = appGraph();
      if (indirect) {
        graph['assets/route-helper.js'] = chunk('route-helper', ['assets/task.js']);
        graph[file].imports.push('assets/route-helper.js');
      } else graph[file].imports.push('assets/task.js');
      assert.throws(() => validateChunkGraph(graph), error => {
        assert.match(error.message, /^Deferred mui-task is statically reachable from protected route /);
        assert.ok(error.message.includes(source));
        assert.ok(error.message.includes(indirect
          ? `${file} -> assets/route-helper.js -> assets/task.js`
          : `${file} -> assets/task.js`));
        return true;
      });
    });
  }

  test(`fails closed when the application loses the owner of ${source}`, () => {
    const graph = appGraph();
    delete graph[file];
    assert.throws(() => validateChunkGraph(graph), error => {
      assert.ok(error.message.includes(`Protected route ${source} must have exactly one emitted chunk owner; found 0`));
      return true;
    });
  });
}

test('rejects ambiguous protected-route ownership across emitted chunks', () => {
  const graph = appGraph();
  const [source] = protectedRoutes[3];
  graph['assets/duplicate.js'] = chunk('duplicate', [], { modules: { [`/repo/${source}`]: {} } });
  assert.throws(() => validateChunkGraph(graph), /GuestTicketPage\.tsx must have exactly one emitted chunk owner; found 2/);
});

test('normalizes Windows source IDs and query/hash suffixes', () => {
  const graph = appGraph();
  for (const item of Object.values(graph)) {
    if (item.modules) item.modules = Object.fromEntries(Object.keys(item.modules).map(id => [
      id.replace('/repo/', 'C:/repo/').replaceAll('/', '\\') + '?transformed#module', {},
    ]));
  }
  const [, file] = protectedRoutes[2];
  graph[file].imports.push('assets/task.js');
  assert.throws(() => validateChunkGraph(graph), /protected route src\/features\/auth\/components\/PasswordResetRequestPage\.tsx:/);
});

test('uses route facades when module maps are unavailable', () => {
  const graph = appGraph();
  graph['assets/index.js'].modules = {};
  graph['assets/index.js'].facadeModuleId = '/repo/src/main.tsx';
  for (const [source, file] of protectedRoutes) {
    graph[file].modules = {};
    graph[file].facadeModuleId = `/repo/${source}`;
  }
  validateChunkGraph(graph);
  graph[protectedRoutes[3][1]].imports.push('assets/task.js');
  assert.throws(() => validateChunkGraph(graph), /protected route src\/features\/guests\/GuestTicketPage\.tsx:/);
});

test('uses Rollup moduleIds when a route is coalesced without a facade or module map', () => {
  const graph = appGraph();
  for (const [source, file] of protectedRoutes) {
    graph[file].modules = {};
    graph[file].moduleIds = [`/repo/${source}`];
  }
  graph[protectedRoutes[1][1]].imports.push('assets/task.js');
  assert.throws(() => validateChunkGraph(graph), /protected route src\/features\/auth\/components\/RegisterPage\.tsx:/);
});

test('checks protected routes coalesced into one chunk using their source modules', () => {
  const graph = appGraph();
  const combined = protectedRoutes.slice(1, 3);
  for (const [, file] of combined) delete graph[file];
  graph['assets/combined.js'] = chunk('combined', ['assets/core.js'], {
    modules: Object.fromEntries(combined.map(([source]) => [`/repo/${source}`, {}])),
    facadeModuleId: null,
  });
  validateChunkGraph(graph);
  graph['assets/combined.js'].imports.push('assets/task.js');
  assert.throws(() => validateChunkGraph(graph), /RegisterPage\.tsx: assets\/combined\.js -> assets\/task\.js/);
});

test('allows ProfileCompletion to use task controls without weakening protected routes', () => {
  const graph = appGraph();
  graph['assets/profile.js'] = chunk('ProfileCompletion', ['assets/task.js'], {
    modules: { '/repo/src/features/auth/components/ProfileCompletion.tsx': {} },
  });
  graph['assets/index.js'].dynamicImports.push('assets/profile.js');
  validateChunkGraph(graph);
});

test('checks a protected route even when the app root is not part of a partial build', () => {
  const [source] = protectedRoutes[1];
  assert.throws(() => validateChunkGraph({
    'route.js': chunk('opaque', ['task.js'], { modules: { [`/repo/${source}`]: {} } }),
    'task.js': chunk('mui-task'),
  }), /protected route src\/features\/auth\/components\/RegisterPage\.tsx: route\.js -> task\.js/);
});

test('does not accept a similarly named source as the protected route owner', () => {
  const graph = appGraph();
  const [source, file] = protectedRoutes[1];
  graph[file].modules = { [`/repo/${source}.old`]: {} };
  assert.throws(() => validateChunkGraph(graph), /RegisterPage\.tsx must have exactly one emitted chunk owner; found 0/);
});

test('the App module alone enables required route-owner checks', () => {
  assert.throws(() => validateChunkGraph({
    'application.js': chunk('application', [], { isEntry: true, modules: { '/repo/src/App.tsx': {} } }),
  }), /AuthGate\.tsx must have exactly one emitted chunk owner; found 0/);
});
