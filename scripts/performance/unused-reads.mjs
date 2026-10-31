/** Local-only production-built SectionDetail comparison. No Firebase/env/cloud. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { chromium } from "@playwright/test";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const baselineRef = process.env.SODC_PERF_BASELINE ?? "77acae6cc3daba8660b8c9e85bedca7ec8bd7bc2";
const runs = Number(process.env.SODC_PERF_RUNS ?? "10");
if (!Number.isInteger(runs) || runs < 1 || runs > 50) throw new Error("SODC_PERF_RUNS must be 1–50");
const sourcePath = "src/features/sections/components/SectionDetail.tsx";
const baseline = execFileSync("git", ["show", `${baselineRef}:${sourcePath}`], { cwd: repository, encoding: "utf8" });
const candidate = await readFile(path.join(repository, sourcePath), "utf8");
const sha256 = value => createHash("sha256").update(value).digest("hex");
const fixture = path.join(repository, "e2e/performance/unused-reads");
const temporary = await mkdtemp(path.join(os.tmpdir(), "sodc-unused-reads-"));
const output = path.resolve(process.argv[2] ?? path.join(repository, ".firebase/performance/unused-reads.json"));
const samplesOutput = output.replace(/\.json$/, "") + ".samples.jsonl";
const generated = Object.fromEntries(["baseline", "candidate"].map(key => [key, path.join(fixture, `SectionDetail.${key}.tsx`)]));
const stubbed = /(?:authoritativeHooks|config\/firebase|dataConnectExecution|shared\/errors|utils\/firebaseFunctions|query\/invalidation|@dataconnect\/generated)$/;
const surfaces = /(?:components\/(?:PageHeader|FailureState|NavigationBreadcrumbs)|AnnouncementOptOutToggle|SectionDetailViews)$/;
const sectionId = "11111111-1111-4111-8111-111111111111";
const memberSectionId = "11111111-1111-4111-8111-111111111112";
const eventId = "22222222-2222-4222-8222-222222222222";
const events = Array.from({ length: 25 }, (_, index) => ({ id: index ? `synthetic-event-${index}` : eventId, title: `Synthetic event ${index}`, location: "Synthetic venue", startDateTime: "2030-01-01T18:00:00Z", endDateTime: "2030-01-01T21:00:00Z", bookingStartDateTime: "2029-01-01T00:00:00Z", bookingEndDateTime: "2029-12-31T00:00:00Z" }));
const members = Array.from({ length: 1000 }, (_, index) => ({ id: `synthetic-${index}`, firstName: `Synthetic ${index}`, lastName: `Member ${1000 - index}`, email: null, mobileNumber: null, rank: null, sharesContactInfo: false, membershipStatus: "REGULAR" }));
const payload = (operation, id) => {
  if (operation === "getSectionForUser") return { section: { id, name: "Synthetic section", type: id === memberSectionId ? "MEMBERS" : "EVENTS", purposeLinks: [] }, hasAccess: true, canModerate: false };
  if (operation === "getSectionEventsForUser") return { events };
  if (operation === "getSectionMembersMerged") return { members };
  if (operation === "getEventForUser") return { event: { ...events[0], section: { id: sectionId }, ticketTypes: [] } };
  throw new Error("Unknown local read operation");
};
let requests = [];
let unexpectedRequests = 0;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET") { unexpectedRequests++; response.writeHead(405).end(); return; }
    if (url.pathname.startsWith("/__probe/")) {
      const operation = url.pathname.split("/").at(-1);
      const body = JSON.stringify(payload(operation, url.searchParams.get("id")));
      requests.push({ operation, jsonBytes: Buffer.byteLength(body) });
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(body) }).end(body);
      return;
    }
    const asset = url.pathname.startsWith("/assets/") ? path.join(temporary, "dist", path.basename(url.pathname)) : path.join(temporary, "dist/index.html");
    const target = url.pathname.startsWith("/assets/") ? path.join(temporary, "dist/assets", path.basename(asset)) : asset;
    const body = await readFile(target);
    response.writeHead(200, { "Content-Type": target.endsWith(".js") ? "text/javascript" : target.endsWith(".css") ? "text/css" : "text/html", "Cache-Control": "no-store" }).end(body);
  } catch { response.writeHead(404).end(); }
});
let browser;
try {
  const envDir = path.join(temporary, "empty-env"); await mkdir(envDir);
  await build({ configFile: false, root: fixture, envDir, publicDir: false, logLevel: "error", plugins: [
    { name: "actual-section-detail-probe", enforce: "pre",
      resolveId(source, importer) {
        if (source.startsWith("probe:")) return generated[source.slice(6)];
        if (!Object.values(generated).includes(importer)) return;
        if (stubbed.test(source)) return path.join(fixture, "adapters.ts");
        if (surfaces.test(source)) return path.join(fixture, "views.tsx");
        if (source.startsWith(".")) return this.resolve(path.resolve(repository, path.dirname(sourcePath), source), undefined, { skipSelf: true });
      },
      load(id) { if (id === generated.baseline) return baseline; if (id === generated.candidate) return candidate; },
      moduleParsed(info) { if (info.id.includes("/src/config/")) throw new Error("Application configuration must not enter the synthetic probe"); },
    }, react(),
  ], build: { outDir: path.join(temporary, "dist"), emptyOutDir: true, minify: "esbuild" } });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const rows = [];
  const profiles = { normal: { latency: 0, downloadThroughput: -1, uploadThroughput: -1, cpu: 1 }, slow: { latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, cpu: 4 } };
  for (const [profile, throttle] of Object.entries(profiles)) {
    for (const scenario of ["events", "direct", "members", "roundtrip"]) {
      for (let run = 0; run < runs; run++) {
        // Alternate order to reduce systematic warmup/drift bias.
        for (const variant of run % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"]) {
          const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
          const nonlocalRequests = [];
          await context.route("**/*", route => {
            if (new URL(route.request().url()).origin === origin) return route.continue();
            nonlocalRequests.push(new URL(route.request().url()).origin);
            return route.abort();
          });
          const page = await context.newPage();
          const errors = []; page.on("pageerror", error => errors.push(error.message));
          const route = `/sections/${scenario === "members" ? memberSectionId : sectionId}${scenario === "direct" ? `/events/${eventId}` : ""}?variant=${variant}&case=${scenario}`;
          await page.goto(origin + route);
          await page.getByRole("button", { name: "Start component probe" }).waitFor();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Network.enable"); await cdp.send("Performance.enable");
          await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: throttle.latency, downloadThroughput: throttle.downloadThroughput, uploadThroughput: throttle.uploadThroughput });
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle.cpu });
          const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(item => [item.name, item.value]));
          const before = await metric(); requests = [];
          await page.getByRole("button", { name: "Start component probe" }).click();
          await page.waitForFunction(() => globalThis.probe.marks.length === 1);
          if (scenario === "roundtrip") {
            await page.getByRole("button", { name: "Synthetic event 0", exact: true }).click();
            await page.waitForFunction(() => globalThis.probe.marks.length === 2);
            await page.getByRole("button", { name: "Back to events", exact: true }).click();
            await page.waitForFunction(() => globalThis.probe.marks.length === 3);
          }
          await page.waitForFunction(() => globalThis.probe.inFlight === 0);
          await page.waitForTimeout(100);
          const after = await metric();
          const observed = await page.evaluate(() => ({ marks: globalThis.probe.marks, longTasks: globalThis.probe.longTasks, errors: globalThis.probe.errors,
            networkBytes: performance.getEntriesByType("resource").filter(entry => new URL(entry.name).pathname.startsWith("/__probe/")).reduce((sum, entry) => ({ transfer: sum.transfer + entry.transferSize, encodedBody: sum.encodedBody + entry.encodedBodySize, decodedBody: sum.decodedBody + entry.decodedBodySize }), { transfer: 0, encodedBody: 0, decodedBody: 0 }),
          }));
          if (errors.length || observed.errors.length || nonlocalRequests.length) throw new Error(`Probe error: ${JSON.stringify([...errors, ...observed.errors, ...nonlocalRequests])}`);
          rows.push({ profile, scenario, run: run + 1, variant, operations: requests, jsonBytes: requests.reduce((sum, item) => sum + item.jsonBytes, 0), ...observed, cpuMs: Object.fromEntries(["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration"].map(name => [name, (after[name] - before[name]) * 1000])) });
          await context.close();
        }
      }
      process.stdout.write(`${profile}/${scenario}: ${runs} paired runs complete\n`);
    }
  }
  const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
  const summaries = [];
  for (const profile of Object.keys(profiles)) for (const scenario of ["events", "direct", "members", "roundtrip"]) for (const variant of ["baseline", "candidate"]) {
    const group = rows.filter(row => row.profile === profile && row.scenario === scenario && row.variant === variant);
    summaries.push({ profile, scenario, variant, runs: group.length, operationCounts: Object.fromEntries([...new Set(group.flatMap(row => row.operations.map(item => item.operation)))].map(operation => [operation, [...new Set(group.map(row => row.operations.filter(item => item.operation === operation).length))]])), jsonBytes: [...new Set(group.map(row => row.jsonBytes))], browserTransferBytes: [...new Set(group.map(row => row.networkBytes.transfer))], timings: Object.fromEntries(group[0].marks.map(({ phase }) => { const values = group.map(row => row.marks.find(mark => mark.phase === phase).elapsedMs); return [phase, { medianMs: percentile(values, 0.5), p95Ms: percentile(values, 0.95) }]; })), taskMedianMs: percentile(group.map(row => row.cpuMs.TaskDuration), 0.5), longTaskCount: group.reduce((sum, row) => sum + row.longTasks.length, 0) });
  }
  if (sha256(await readFile(path.join(repository, sourcePath), "utf8")) !== sha256(candidate)) throw new Error("Candidate source changed during measurement; rerun after it is frozen");
  const samples = rows.map(row => JSON.stringify(row)).join("\n") + "\n";
  const result = { schemaVersion: "sodc-unused-read-component-probe/v1", createdAt: new Date().toISOString(), baselineRef, sourceSha256: { baseline: sha256(baseline), candidate: sha256(candidate) }, candidateSourceUnchangedAtCompletion: true, versions: { node: process.version, browser: browser.version() }, fixture: { members: members.length, events: events.length, syntheticOnly: true }, profiles, runsPerVariantProfileScenario: runs, samplesArtifact: { file: path.basename(samplesOutput), rows: rows.length, sha256: sha256(samples) }, unexpectedRequests, productionBuild: true, limits: ["Actual SectionDetail source; inert query/auth adapters and lightweight child views. Not the full application or real Firebase latency.", "Assets loaded before throttling/timing. JSON payload bytes exclude HTTP/TLS/compression; read-only GET transport replaces Firebase callable protocol.", "Main-thread task/script/layout metrics and long tasks are not isolated React render duration. No React profiling build used.", "Home/admin/cache-reuse and permission changes are outside this first-slice measurement."], summaries };
  if (unexpectedRequests) throw new Error("Unexpected non-GET requests reached local probe");
  // Commit the small aggregate file; retain raw samples locally by their hash.
  const { summaries: aggregateRows, ...metadata } = result;
  const formatted = JSON.stringify(metadata, null, 2).slice(0, -2) + `,\n  "summaries": [\n${aggregateRows.map(row => "    " + JSON.stringify(row)).join(",\n")}\n  ]\n}\n`;
  await mkdir(path.dirname(output), { recursive: true }); await writeFile(samplesOutput, samples); await writeFile(output, formatted);
  process.stdout.write(`Results: ${output}\nRaw samples: ${samplesOutput}\n`);
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  await rm(temporary, { recursive: true, force: true });
}
