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
  }), /Static chunk cycle: assets\/core\.js -> tasks\/controls\.js -> assets\/core\.js.*manualChunks/);
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
  }), /Deferred mui-task is statically reachable from entry: assets\/index\.js -> assets\/controls\.js/);
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
