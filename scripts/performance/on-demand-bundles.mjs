import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

// Actual application builds, with Rollup's graph rather than strings in Vite's
// preload dependency table. No application code, SDK or network is executed.
const root = process.cwd();
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return args[index + 1];
}
if (args.some((arg, index) => index % 2 === 0 && !['--baseline', '--output'].includes(arg))) {
  throw new Error('Usage: node scripts/performance/on-demand-bundles.mjs [--baseline REF] [--output FILE]');
}
const baselineRef = option('--baseline', '77acae6cc3daba8660b8c9e85bedca7ec8bd7bc2');
const output = path.resolve(option('--output', '.firebase/performance/650-on-demand-bundles.json'));
const evidence = output.replace(/\.json$/, '') + '-assets';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const runnerSha256 = sha256(readFileSync(new URL(import.meta.url)));
const git = (...values) => execFileSync('git', values, { cwd: root, encoding: 'utf8' }).trim();
const baselineCommit = git('rev-parse', `${baselineRef}^{commit}`);
const candidateCommit = git('rev-parse', 'HEAD');
const temp = mkdtempSync(path.join(tmpdir(), 'sodc-bundle-measurement-'));

const source = (name) => `src/${name}`;
const section = source('features/sections/components/SectionDetail.tsx');
const eventAbout = source('features/sections/components/EventDetailsContent.tsx');
const admin = source('features/admin/components/SectionAdminPage.tsx');
const home = source('features/welcome/components/MemberWelcomePage.tsx');
const scenarios = [
  ['startup', []],
  ['public-home', [source('features/welcome/components/PublicHomePage.tsx')]],
  ['member-home', [home]],
  ['members-directory', [section]],
  ['events-list', [section]],
  // URL intent preloads About before its data is known, including empty details.
  ['event-about-empty', [section, eventAbout]],
  ['event-about-markdown', [section, eventAbout, source('shared/components/SafeMarkdown.tsx')]],
  ['event-book', [section, source('features/sections/components/EventBookingWizard.tsx')]],
  ['event-attendees', [section, source('features/sections/components/EventAttendees.tsx')]],
  ['member-contact', [section, source('features/sections/components/ContactDetailsDialog.tsx')]],
  ['my-bookings', [source('features/sections/components/MyBookings.tsx')]],
  ['section-admin-hub', [admin]],
  ['section-admin-events', [admin, source('features/admin/components/SectionEventsManager.tsx')]],
  ['section-admin-files', [admin, source('features/admin/components/ManageSectionFiles.tsx')]],
  ['section-admin-announcements', [admin, source('features/admin/components/SendAnnouncementPage.tsx')]],
];

function sourceSnapshot(directory) {
  const files = ['index.html', 'package.json', 'package-lock.json', 'vite.config.ts', ...readdirSync(directory).filter((file) => /^tsconfig.*\.json$/.test(file))];
  function walk(relative) {
    for (const entry of readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'test-utils') walk(next);
      } else if (!/\.(test|spec)\./.test(entry.name)) files.push(next);
    }
  }
  walk('src');
  const hashes = Object.fromEntries(files.sort().map((file) => [file, sha256(readFileSync(path.join(directory, file)))]));
  return { sha256: sha256(JSON.stringify(hashes)), files: hashes };
}

// Reuse installed packages without resolving the local generated package to the
// candidate's source when building the archived baseline.
function linkDependencies(directory) {
  const destination = path.join(directory, 'node_modules');
  mkdirSync(path.join(destination, '@dataconnect'), { recursive: true });
  for (const entry of readdirSync(path.join(root, 'node_modules'))) {
    if (entry === '@dataconnect' || entry.startsWith('.vite')) continue;
    symlinkSync(path.join(root, 'node_modules', entry), path.join(destination, entry));
  }
  for (const entry of readdirSync(path.join(root, 'node_modules/@dataconnect'))) {
    symlinkSync(entry === 'generated' ? path.join(directory, 'src/dataconnect-generated') : path.join(root, 'node_modules/@dataconnect', entry), path.join(destination, '@dataconnect', entry));
  }
}

function normalizeId(id, directory) {
  const clean = id.replaceAll('\\', '/');
  const packageIndex = clean.lastIndexOf('/node_modules/');
  if (packageIndex >= 0) return clean.slice(packageIndex + 1);
  if (clean.startsWith(directory + '/')) return clean.slice(directory.length + 1);
  return clean.replaceAll(root, '<candidate>').replaceAll(temp, '<temporary>');
}

async function measure(label, directory, commit) {
  const before = sourceSnapshot(directory);
  let graph;
  process.env.GITHUB_SHA = commit;
  const inertConfig = {
    VITE_FIREBASE_API_KEY: 'bundle-measurement-public-placeholder',
    VITE_FIREBASE_AUTH_DOMAIN: 'bundle-measurement.invalid',
    VITE_FIREBASE_PROJECT_ID: 'bundle-measurement',
    VITE_FIREBASE_STORAGE_BUCKET: 'bundle-measurement.invalid',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789000',
    VITE_FIREBASE_APP_ID: '1:123456789000:web:bundle-measurement',
    VITE_FIREBASE_MEASUREMENT_ID: 'G-MEASUREMENT',
    VITE_RECAPTCHA_SITE_KEY: 'bundle-measurement-placeholder',
    VITE_USE_FIREBASE_EMULATORS: 'false',
  };
  await build({
    root: directory,
    configFile: path.join(directory, 'vite.config.ts'),
    mode: 'production',
    envDir: path.join(temp, 'empty-env'),
    define: Object.fromEntries(Object.entries(inertConfig).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    logLevel: 'warn',
    build: { outDir: path.join(evidence, label), emptyOutDir: true },
    plugins: [{
      name: 'sodc-bundle-measurement',
      enforce: 'post',
      // Vite's later generateBundle hooks rewrite the entry preload map. Read
      // the final Rollup graph after those hooks and verify it against disk.
      writeBundle(_options, bundle) {
        graph = Object.fromEntries(Object.entries(bundle).map(([file, asset]) => {
          const bytes = asset.type === 'chunk' ? Buffer.from(asset.code) : Buffer.from(asset.source);
          return [file, {
            kind: asset.type === 'chunk' ? 'js' : file.endsWith('.css') ? 'css' : 'other',
            rawBytes: bytes.length,
            gzipBytes: gzipSync(bytes, { level: 9 }).length,
            sha256: sha256(bytes),
            ...(asset.type === 'chunk' ? {
              entry: asset.isEntry,
              imports: asset.imports,
              dynamicImports: asset.dynamicImports,
              css: [...(asset.viteMetadata?.importedCss ?? [])],
              assets: [...(asset.viteMetadata?.importedAssets ?? [])],
              modules: Object.fromEntries(Object.entries(asset.modules).map(([id, module]) => [normalizeId(id, directory), { renderedLength: module.renderedLength }])),
            } : {}),
          }];
        }));
      },
    }],
  });
  if (!graph) throw new Error('Rollup graph not captured');
  for (const [file, metadata] of Object.entries(graph)) {
    if (sha256(readFileSync(path.join(evidence, label, file))) !== metadata.sha256) throw new Error(`Final emitted asset changed after graph capture: ${file}`);
  }
  if (sourceSnapshot(directory).sha256 !== before.sha256) throw new Error(`${label} source changed during build`);
  const entries = Object.keys(graph).filter((file) => graph[file].entry);
  if (entries.length !== 1) throw new Error(`Expected one app entry, got ${entries.length}`);
  const owner = (module) => {
    const owners = Object.keys(graph).filter((file) => graph[file].modules?.[module]);
    if (owners.length !== 1) throw new Error(`${label}: expected one owner for ${module}, got ${owners.length}`);
    return owners[0];
  };
  const closure = (roots) => {
    const files = new Set();
    const visit = (file) => {
      if (files.has(file)) return;
      if (!graph[file]) throw new Error(`Unresolved emitted dependency ${file}`);
      files.add(file);
      for (const dependency of [...(graph[file].imports ?? []), ...(graph[file].css ?? []), ...(graph[file].assets ?? [])]) visit(dependency);
    };
    roots.forEach(visit);
    return files;
  };
  const total = (files) => {
    const result = { js: { assets: 0, rawBytes: 0, gzipBytes: 0 }, css: { assets: 0, rawBytes: 0, gzipBytes: 0 }, other: { assets: 0, rawBytes: 0, gzipBytes: 0 } };
    for (const file of files) {
      const asset = graph[file];
      result[asset.kind].assets++;
      result[asset.kind].rawBytes += asset.rawBytes;
      result[asset.kind].gzipBytes += asset.gzipBytes;
    }
    return result;
  };
  const startup = closure(entries);
  const rows = Object.fromEntries(scenarios.map(([name, modules]) => {
    const requestedChunks = modules.map(owner);
    const files = closure([...entries, ...requestedChunks]);
    return [name, { requestedChunks: [...new Set(requestedChunks)], total: total(files), beyondStartup: total([...files].filter((file) => !startup.has(file))), files: [...files].sort() }];
  }));
  const journey = ['member-home', 'events-list', 'event-about-empty', 'event-book', 'event-attendees', 'events-list', 'member-home'];
  const loaded = new Set(startup);
  const warmJourney = journey.map((name) => {
    const newFiles = rows[name].files.filter((file) => !loaded.has(file));
    newFiles.forEach((file) => loaded.add(file));
    return { name, additional: total(newFiles), files: newFiles };
  });
  const graphPath = path.join(evidence, `${label}-graph.json`);
  writeFileSync(graphPath, JSON.stringify({ source: before, entries, assets: graph }, null, 2) + '\n');
  return {
    commit,
    commitRole: label === 'baseline' ? 'Exact archived source commit' : 'Checkout HEAD only; sourceSha256 identifies the measured working tree',
    workingTreeDirty: label === 'candidate' && git('status', '--porcelain').length > 0,
    sourceSha256: before.sha256,
    lockSha256: before.files['package-lock.json'],
    viteConfigSha256: before.files['vite.config.ts'],
    graphSha256: sha256(readFileSync(graphPath)),
    graphPath: path.relative(root, graphPath),
    entries,
    scenarios: rows,
    warmJourney,
    boundaries: Object.fromEntries(scenarios.filter(([, modules]) => modules.length).map(([name, modules]) => [name, modules.map((module) => {
      const chunk = owner(module);
      return { module, chunk, eagerAtStartup: startup.has(chunk), dynamicImporters: Object.keys(graph).filter((file) => graph[file].dynamicImports?.includes(chunk)) };
    })])),
  };
}

try {
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24 for paired measurements');
  const baseline = path.join(temp, 'baseline');
  mkdirSync(baseline);
  mkdirSync(path.join(temp, 'empty-env'));
  mkdirSync(evidence, { recursive: true });
  const archive = execFileSync('git', ['archive', baselineCommit], { cwd: root, maxBuffer: 128 * 1024 * 1024 });
  execFileSync('tar', ['-xf', '-', '-C', baseline], { input: archive });
  linkDependencies(baseline);
  if (readFileSync(path.join(baseline, 'package-lock.json'), 'utf8') !== readFileSync(path.join(root, 'package-lock.json'), 'utf8')) throw new Error('Baseline and candidate lockfiles differ; install and compare dependencies explicitly');
  for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key];
  const candidateBefore = sourceSnapshot(root).sha256;
  console.log('Building isolated baseline');
  const baselineResult = await measure('baseline', realpathSync(baseline), baselineCommit);
  console.log('Building candidate into measurement-only output');
  const candidateResult = await measure('candidate', realpathSync(root), candidateCommit);
  if (sourceSnapshot(root).sha256 !== candidateBefore) throw new Error('Candidate changed during paired measurement');
  if (sha256(readFileSync(new URL(import.meta.url))) !== runnerSha256) throw new Error('Measurement runner changed during paired measurement');
  const report = {
    schemaVersion: 'sodc-bundle-comparison/v1',
    measuredAt: new Date().toISOString(),
    node: process.versions.node,
    vite: JSON.parse(readFileSync(path.join(root, 'node_modules/vite/package.json'), 'utf8')).version,
    runnerSha256,
    method: 'Actual application production builds; Rollup static import closure; dynamic imports only added for requested scenarios; emitted assets deduplicated; gzip level 9 per asset.',
    limits: 'Inert public build configuration; no real SDK execution, authentication, data reads, transfer measurements, latency or browser timings. Conditional route scenarios are source-derived, not observed requests. JS files referenced only by Vite preload-map strings are not eager imports. Counts exclude the HTML document. gzip estimates exclude headers and deployed compression differences.',
    baseline: baselineResult,
    candidate: candidateResult,
    delta: Object.fromEntries(scenarios.map(([name]) => [name, Object.fromEntries(['js', 'css', 'other'].map((kind) => [kind, Object.fromEntries(['assets', 'rawBytes', 'gzipBytes'].map((metric) => [metric, candidateResult.scenarios[name].total[kind][metric] - baselineResult.scenarios[name].total[kind][metric]]))]))])),
  };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ output, sha256: sha256(readFileSync(output)), startupGzip: [baselineResult.scenarios.startup.total.js.gzipBytes, candidateResult.scenarios.startup.total.js.gzipBytes] }));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
