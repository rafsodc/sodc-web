#!/usr/bin/env node
/* global window, document, location, getComputedStyle, requestAnimationFrame */
import process from 'node:process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { fixture, installSyntheticTransport } from '../../e2e/performance/startup/fixture.mjs';
import { summarizeStartupSamples } from './startup-statistics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((result, value, index, array) => {
  if (value.startsWith('--')) result.push([value.slice(2), array[index + 1]]);
  return result;
}, []));
if (!args.assets || !args.output) throw new Error('Usage: node scripts/performance/startup-browser.mjs --assets <paired-assets-directory> --output <report.json> [--pairs 10] [--profile normal|slow|both] [--journey member|admin|public|guest|register|reset|both|signed-out|all]');
const assets = path.resolve(args.assets);
const output = path.resolve(args.output);
const pairs = Number(args.pairs ?? 10);
if (!Number.isInteger(pairs) || pairs < 1 || pairs > 50) throw new Error('pairs must be an integer from 1 to 50');
const profiles = { normal: { latency: 0, downloadThroughput: -1, uploadThroughput: -1, cpu: 1 },
  slow: { latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, cpu: 4 } };
const selectedProfiles = args.profile && args.profile !== 'both' ? [args.profile] : Object.keys(profiles);
if (selectedProfiles.some(name => !profiles[name])) throw new Error('unknown profile');
const allJourneys = ['member', 'admin', 'public', 'guest', 'register', 'reset'];
const journeyGroups = { both: ['member', 'admin'], 'signed-out': ['public', 'guest', 'register', 'reset'], all: allJourneys };
const journeys = journeyGroups[args.journey ?? 'both'] ?? [args.journey];
if (journeys.some(name => !allJourneys.includes(name))) throw new Error('unknown journey');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function inventory(directory, prefix = '') {
  const result = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await inventory(path.join(directory, entry.name), relative));
    else if (entry.isFile()) result[relative] = sha256(await readFile(path.join(directory, entry.name)));
    else throw new Error('nonregular-asset');
  }
  return result;
}
const binding = { harnessSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  fixtureSha256: sha256(await readFile(path.join(root, 'e2e/performance/startup/fixture.mjs'))),
  statisticsSha256: sha256(await readFile(path.join(root, 'scripts/performance/startup-statistics.mjs'))), variants: {} };
for (const variant of ['baseline', 'candidate']) {
  const graph = JSON.parse(await readFile(path.join(assets, `${variant}-graph.json`), 'utf8'));
  const files = await inventory(path.join(assets, variant));
  for (const [file, item] of Object.entries(graph.assets)) {
    if (files[file] !== item.sha256) throw new Error(`asset-graph-mismatch:${variant}:${file}`);
  }
  binding.variants[variant] = { graphSha256: sha256(await readFile(path.join(assets, `${variant}-graph.json`))), source: graph.source, files };
}
// Read and compress both variants before any sample. Server disk/compression
// work must not be included in the browser's parse/network comparison.
const cache = new Map();
for (const variant of ['baseline', 'candidate']) for (const file of Object.keys(binding.variants[variant].files)) {
  const target = path.join(assets, variant, file);
  const bytes = await readFile(target);
  const gzip = ['.html', '.js', '.css', '.json', '.svg'].includes(path.extname(target)) ? gzipSync(bytes, { level: 9 }) : null;
  cache.set(target, { bytes, gzip });
}
let active = 'baseline';
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  let relative;
  try { relative = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html'; }
  catch { response.writeHead(400).end(); return; }
  const base = path.join(assets, active);
  let target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) { response.writeHead(400).end(); return; }
  if (!cache.has(target)) {
    if (pathname.startsWith('/assets/') || path.extname(pathname)) { response.writeHead(404).end(); return; }
    target = path.join(base, 'index.html');
    if (!cache.has(target)) { response.writeHead(404).end(); return; }
  }
  const extension = path.extname(target);
  const contentType = ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' })[extension] ?? 'application/octet-stream';
  const { bytes, gzip } = cache.get(target);
  const compressed = gzip && /\bgzip\b/.test(request.headers['accept-encoding'] ?? '');
  const body = compressed ? gzip : bytes;
  response.writeHead(200, { 'content-type': contentType, 'cache-control': pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache',
    'content-length': body.length, ...(compressed ? { 'content-encoding': 'gzip', vary: 'Accept-Encoding' } : {}) });
  response.end(request.method === 'HEAD' ? undefined : body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chromium', headless: true });
const report = { schema: 1, label: 'Real production App and SDK; invented local data and intercepted transports',
  appCheck: 'Real App Check SDK with synthetic enterprise loader and exchange; no attestation measured',
  limitations: ['Local Chromium synthetic transport timings are not live Dev/Production Firebase latency or real authentication performance.',
    'Transport interception disables browser HTTP cache; each fresh context is cold and later steps reuse evaluated modules.',
    'Gzip level 9 loopback assets; CDP throttling applies to browser asset requests, intercepted synthetic responses are not a network-service model.',
    'Only member/admin seed an unsigned synthetic Auth token; public/guest/register/reset remain signed out. Invented read responses exclude backend authorization, writes, payments, email and real App Check.'],
  createdAt: new Date().toISOString(), browser: browser.version(), viewport: { width: 1280, height: 800 }, profiles, pairs, journeys, binding, samples: [] };
const sectionPath = `/sections/${fixture.sectionId}`;
const eventPath = `${sectionPath}/events/${fixture.eventId}`;
const entryPaths = { member: '', admin: `${sectionPath}/manage`, public: '',
  guest: `/guest-ticket#${fixture.guestToken}`, register: '/register', reset: '/account/reset-password' };
const coldNames = { member: 'cold-home', admin: 'cold-admin-hub', public: 'cold-public-home',
  guest: 'cold-guest-ticket', register: 'cold-register', reset: 'cold-password-reset' };
const authFormReady = ({ path, passwords, submit }) => {
  const inputs = [...document.querySelectorAll('form input')];
  return location.pathname === path && !document.querySelector('#account-menu-button') &&
    document.querySelector('form input[type="email"]') && document.querySelectorAll('form input[type="password"]').length === passwords &&
    [...document.querySelectorAll('form button')].some(el => el.textContent === submit) &&
    inputs.every(input => !input.disabled && input.getBoundingClientRect().height > 10 &&
      getComputedStyle(input).fontFamily.includes('Roboto') && parseFloat(getComputedStyle(input).paddingLeft) > 0) &&
    !document.querySelector('[role="progressbar"]');
};
const authForms = { signIn: { path: '/account', passwords: 1, submit: 'Sign in' },
  register: { path: '/register', passwords: 2, submit: 'Create account' },
  reset: { path: '/account/reset-password', passwords: 0, submit: 'Send reset link' } };
async function armReadiness(page, predicate, data) {
  const key = `${Date.now()}:${Math.random()}`;
  await page.evaluate(({ text, data, key }) => {
    const predicate = (0, eval)(`(${text})`);
    let first;
    const observe = () => {
      if (!predicate(data)) first = undefined;
      else if (first !== undefined) {
        window.__startupReadiness[key] = { firstCorrectAt: first, confirmedAt: performance.now() }; return;
      } else first = performance.now();
      requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  }, { text: predicate.toString(), data, key });
  return key;
}
async function waitReadiness(page, key) {
  const handle = await page.waitForFunction(key => window.__startupReadiness[key], key, { timeout: 45000, polling: 'raf' });
  const result = await handle.jsonValue();
  await handle.dispose();
  return result;
}
async function stable(page, predicate, data) { return waitReadiness(page, await armReadiness(page, predicate, data)); }
async function run(variant, profile, pair, position, journey) {
  active = variant;
  const context = await browser.newContext({ viewport: report.viewport, serviceWorkers: 'block' });
  const ledger = { synthetic: [], blocked: [] };
  await installSyntheticTransport(context, origin, ledger, { journey });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profiles[profile].latency,
    downloadThroughput: profiles[profile].downloadThroughput, uploadThroughput: profiles[profile].uploadThroughput });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profiles[profile].cpu });
  await cdp.send('Performance.enable');
  const sample = { variant, profile, journey, authState: ['member', 'admin'].includes(journey) ? 'synthetic-signed-in' : 'signed-out',
    pair, position, status: 'running', steps: [], ledger, errors };
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
  const step = async (name, action, predicate, data) => {
    if (args.debug) process.stdout.write(`starting ${name}\n`);
    const before = await page.evaluate(() => performance.now());
    const cpuBefore = await metrics();
    const firstResource = await page.evaluate(() => performance.getEntriesByType('resource').length);
    await page.evaluate(() => { window.__startupActionStart = null; });
    const readyKey = await armReadiness(page, predicate, data);
    await action();
    const ready = await waitReadiness(page, readyKey);
    const actionStart = await page.evaluate(() => window.__startupActionStart);
    if (actionStart === null) throw new Error('missing-browser-action-mark');
    const cpuAfter = await metrics();
    const detail = await page.evaluate(({ firstResource }) => ({
      resources: performance.getEntriesByType('resource').slice(firstResource).map(entry => ({
        path: new URL(entry.name).pathname, duration: entry.duration, transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
      })), observations: window.__startupObservations,
    }), { firstResource });
    sample.steps.push({ name, durationMs: ready.confirmedAt - actionStart, firstCorrectMs: ready.firstCorrectAt - actionStart,
      driverActionOverheadMs: actionStart - before, cpuSeconds: Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(key => [key, cpuAfter[key] - cpuBefore[key]])), ...detail });
    if (ledger.blocked.length || errors.length) throw new Error('unexpected-network-or-browser-error');
  };
  const exerciseAuthForm = async kind => {
    const form = page.locator('form');
    await form.getByRole('textbox', { name: 'Email', exact: true }).fill(fixture.email);
    // Invented local input only. Never submit, create an account or request mail.
    if (kind !== 'reset') await form.getByLabel(/^Password/).fill('Unsaved-synthetic-form-input-123');
    if (kind === 'register') await form.getByLabel(/^Confirm Password/).fill('Unsaved-synthetic-form-input-123');
    if (await form.getByRole('textbox', { name: 'Email', exact: true }).inputValue() !== fixture.email ||
        !(await form.getByRole('button', { name: authForms[kind].submit, exact: true }).isEnabled())) throw new Error('auth-form-not-interactive');
    sample.formStyles ??= {};
    sample.formStyles[kind] = await form.getByRole('textbox', { name: 'Email', exact: true }).evaluate(element => ({
      height: element.getBoundingClientRect().height, fontFamily: getComputedStyle(element).fontFamily,
      padding: getComputedStyle(element).padding }));
  };
  try {
    await page.goto(origin + entryPaths[journey], { waitUntil: 'domcontentloaded' });
    const coldHandle = await page.waitForFunction(() => window.__startupColdReady, undefined, { timeout: 45000 });
    const coldReady = await coldHandle.jsonValue();
    await coldHandle.dispose();
    sample.steps.push({ name: coldNames[journey], durationMs: coldReady.confirmedAt, firstCorrectMs: coldReady.firstCorrectAt,
      ...(await page.evaluate(() => ({
      navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()),
      resources: performance.getEntriesByType('resource').map(entry => ({ path: new URL(entry.name).pathname,
        duration: entry.duration, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize })),
      observations: window.__startupObservations }))), documentCpuMetrics: await metrics() });
    if (journey === 'public') {
      await step('first-sign-in', () => page.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click(), authFormReady, authForms.signIn);
      await exerciseAuthForm('signIn');
      await step('first-register', () => page.getByRole('link', { name: 'Create an account', exact: true }).click(), authFormReady, authForms.register);
      await exerciseAuthForm('register');
      await page.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click();
      await stable(page, authFormReady, authForms.signIn);
      await step('first-password-reset', () => page.getByRole('link', { name: 'Forgot password?', exact: true }).click(), authFormReady, authForms.reset);
      await exerciseAuthForm('reset');
    } else if (journey === 'register' || journey === 'reset') {
      await exerciseAuthForm(journey);
    } else if (journey === 'guest') {
      const dietary = page.getByRole('textbox', { name: 'Dietary requirements', exact: true });
      await dietary.fill('Unsaved synthetic dietary draft');
      if (await dietary.inputValue() !== 'Unsaved synthetic dietary draft' ||
          !(await page.getByRole('button', { name: 'Save dietary requirements', exact: true }).isEnabled()) ||
          !(await page.getByRole('button', { name: 'Pay £25.00', exact: true }).isEnabled())) throw new Error('guest-ticket-not-interactive');
      sample.formStyle = await dietary.evaluate(element => ({ height: element.getBoundingClientRect().height,
        fontFamily: getComputedStyle(element).fontFamily, padding: getComputedStyle(element).padding }));
    }
    if (journey === 'member') {
      await step('first-section', () => page.locator(`a[href="${sectionPath}"]`).last().click(),
        ({ title }) => location.pathname === title.path && [...document.querySelectorAll('a')].some(el => el.textContent.includes(title.name)) &&
          !!document.querySelector('.page-header') && !document.querySelector('[role="progressbar"]'), { title: { path: sectionPath, name: fixture.eventTitle } });
      await step('first-about', () => page.locator(`a[href="${eventPath}"]`).first().click(),
        ({ path }) => location.pathname === path && document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'About' &&
          !![...document.querySelectorAll('[role="tabpanel"] h4')].find(el => el.textContent === 'Synthetic programme') &&
          document.body.innerText.includes('BOOKING WINDOW') && !document.querySelector('[role="progressbar"]'), { path: eventPath });
      await step('first-book', () => page.getByRole('tab', { name: 'Book', exact: true }).click(),
        ({ path }) => location.pathname === path && new URLSearchParams(location.search).get('tab') === 'book' &&
          document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Book' &&
          document.body.innerText.includes('Book this event') && document.body.innerText.includes('Synthetic member ticket') &&
          !!document.querySelector('input[type="radio"]') && !document.querySelector('[role="progressbar"]'), { path: eventPath });
      // Return through the real breadcrumb, then activate its real admin action.
      await page.locator(`a[href="${sectionPath}"]`).last().click();
      await stable(page, () => !!document.querySelector('a[href$="/manage"]') && !document.querySelector('[role="progressbar"]'));
      await step('first-admin-hub', () => page.locator(`a[href="${sectionPath}/manage"]`).click(),
        ({ path }) => location.pathname === path && !!document.querySelector('a[href$="/manage/events"]') &&
          !!document.querySelector('a[href$="/manage/files"]') && !document.querySelector('[role="progressbar"]'), { path: `${sectionPath}/manage` });
    }
    if (journey === 'member' || journey === 'admin') {
      await step('first-admin-events', () => page.locator(`a[href="${sectionPath}/manage/events"]`).first().click(),
        ({ path }) => location.pathname === path && document.body.innerText.includes('Synthetic startup symposium') &&
          !![...document.querySelectorAll('button,a')].find(el => el.textContent === 'Add event') && !document.querySelector('[role="progressbar"]'), { path: `${sectionPath}/manage/events` });
      await step('first-event-form', () => page.getByRole('link', { name: 'Add event', exact: true }).click(),
        ({ path }) => location.pathname === path && new URLSearchParams(location.search).get('edit') === 'new-event' &&
          !!document.querySelector('[role="dialog"] input') &&
          !![...document.querySelectorAll('[role="dialog"] label')].find(el => el.textContent.includes('Title')) &&
          document.querySelector('[role="dialog"] input').getBoundingClientRect().height > 10 &&
          getComputedStyle(document.querySelector('[role="dialog"] input')).fontFamily.includes('Roboto'), { path: `${sectionPath}/manage/events` });
      const dialog = page.getByRole('dialog');
      const title = dialog.getByRole('textbox', { name: /^Title/ });
      await title.fill('Unsaved synthetic performance draft');
      if (await title.inputValue() !== 'Unsaved synthetic performance draft') throw new Error('draft-input-not-retained');
      sample.formStyle = await title.evaluate(element => ({ height: element.getBoundingClientRect().height,
        fontFamily: getComputedStyle(element).fontFamily, padding: getComputedStyle(element).padding,
        dialogVisible: !!element.closest('[role="dialog"]')?.getBoundingClientRect().width }));
      if (!(sample.formStyle.height > 10 && sample.formStyle.dialogVisible)) throw new Error('form-style-not-ready');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    if (ledger.blocked.length || errors.length) throw new Error('unexpected-network-or-browser-error');
    sample.status = 'passed';
  } catch (error) {
    sample.status = 'failed'; sample.failure = error.message;
    sample.failurePage = await page.locator('body').innerText().catch(() => 'unavailable');
    sample.failureUrl = page.url().replace(origin, '<loopback>');
  } finally { await context.close(); }
  report.samples.push(sample);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${profile} ${journey} pair ${pair} ${variant}: ${sample.status}${sample.failure ? ` (${sample.failure})` : ''}\n`);
  return sample.status === 'passed';
}
try {
  for (const profile of selectedProfiles) for (const journey of journeys) for (let pair = 0; pair < pairs; pair++) {
    const order = pair % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'];
    for (let position = 0; position < order.length; position++) {
      const passed = await run(order[position], profile, pair + 1, position + 1, journey);
      if (!passed && args['keep-going'] !== 'true') throw new Error('sample-failed-see-retained-report');
    }
  }
  for (const variant of ['baseline', 'candidate']) if (JSON.stringify(await inventory(path.join(assets, variant))) !== JSON.stringify(binding.variants[variant].files)) throw new Error('assets-changed-during-measurement');
  if (binding.harnessSha256 !== sha256(await readFile(fileURLToPath(import.meta.url))) ||
      binding.fixtureSha256 !== sha256(await readFile(path.join(root, 'e2e/performance/startup/fixture.mjs'))) ||
      binding.statisticsSha256 !== sha256(await readFile(path.join(root, 'scripts/performance/startup-statistics.mjs')))) throw new Error('measurement-source-changed');
  report.completedAt = new Date().toISOString();
  report.complete = report.samples.length === selectedProfiles.length * journeys.length * pairs * 2 && report.samples.every(sample => sample.status === 'passed');
  report.summary = summarizeStartupSamples(report.samples, selectedProfiles, journeys);
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  if (!report.complete) process.exitCode = 1;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
