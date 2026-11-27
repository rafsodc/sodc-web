import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildDeployments, type BuiltDeployment } from "./support/deploymentBuilds";
import { startDeploymentServer, type DeploymentServer } from "./support/deploymentServer";

let actualApp: BuiltDeployment;
let localFixture: BuiltDeployment;
let cachedFixture: BuiltDeployment;
const fixtureStyles = { A: "", B: "" };
const servers = new Set<DeploymentServer>();
const recoveryHeading = (page: Page) => page.getByRole("heading", { name: "This page couldn’t load", exact: true });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  actualApp = await buildDeployments("app");
  localFixture = await buildDeployments("fixture");
  cachedFixture = await buildDeployments("fixture");
  // The inert fixture otherwise emits no CSS. These temporary build outputs
  // exercise both immutable resource types without changing its source or the
  // unchanged deployment-recovery builds above.
  for (const build of ["A", "B"] as const) {
    const css = `:root { --deployment-cache-build: ${build}; }\n`;
    const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);
    const stylesheet = `/assets/cache-probe-${hash}.css`;
    fixtureStyles[build] = stylesheet;
    await writeFile(path.join(cachedFixture.directories[build], stylesheet.slice(1)), css);
    const index = path.join(cachedFixture.directories[build], "index.html");
    const html = await readFile(index, "utf8");
    await writeFile(index, html.replace("</head>", `<link rel="stylesheet" href="${stylesheet}" /></head>`));
  }
});
test.afterAll(async () => {
  await actualApp?.remove();
  await localFixture?.remove();
  await cachedFixture?.remove();
});
test.afterEach(async () => {
  for (const server of servers) await server.close();
  servers.clear();
});
test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1", "[::1]"].includes(host) ? route.continue() : route.abort();
  });
  await context.routeWebSocket("**/*", socket => {
    if (["localhost", "127.0.0.1", "[::1]"].includes(new URL(socket.url()).hostname)) socket.connectToServer();
    else socket.close({ code: 1008, reason: "Only local fixture traffic is allowed" });
  });
});

async function serverFor(build: BuiltDeployment, cacheAssets = false) {
  const server = await startDeploymentServer(build.directories, { cacheAssets });
  servers.add(server);
  return server;
}
async function dismissCookies(page: Page) {
  const banner = page.getByRole("region", { name: "Cookies and browser storage", exact: true });
  if (await banner.isVisible()) await banner.getByRole("button", { name: "Decline preference cookies", exact: true }).click();
}
async function assertManualRecovery(page: Page) {
  await expect(recoveryHeading(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reload page", exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("Unsaved changes may be lost; check any recent save before trying it again.");
}
async function blockStorage(context: BrowserContext) {
  await context.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    for (const key of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException("Local test storage blocked", "SecurityError"); } });
    }
  });
}

async function actualTaskAsset() {
  const files = (await readdir(path.join(actualApp.directories.A, "assets")))
    .filter(name => /^mui-task-.+\.js$/.test(name));
  expect(files).toHaveLength(1);
  return `/assets/${files[0]}`;
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`actual app defers shared controls until first use in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    const server = await serverFor(actualApp);
    const task = await actualTaskAsset();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.url);
    await expect(page.getByRole("heading", { name: "Royal Air Force | SODC", exact: true })).toBeVisible();
    await dismissCookies(page);
    expect(server.requests.filter(request => request.pathname === task)).toHaveLength(0);

    await page.getByRole("main").getByRole("button", { name: "Sign in", exact: true }).click();
    const email = page.getByRole("textbox", { name: "Email", exact: true });
    await expect(email).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await email.fill("local-reader@example.test");
    await expect(email).toBeFocused();
    expect(server.requests.filter(request => request.pathname === task).map(request => request.status)).toEqual([200]);
    const outline = page.locator(".MuiOutlinedInput-notchedOutline").first();
    await expect(outline).toHaveCSS("border-style", "solid");
    expect((await email.boundingBox())!.width).toBeGreaterThan(100);
    const initialBackground = await page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor);
    await page.getByRole("button", { name: /^Appearance:/ }).click();
    await page.getByRole("menuitem", { name: colorScheme === "light" ? /Dark/ : /Light/ }).click();
    await expect.poll(() => page.locator("body").evaluate(element => getComputedStyle(element).backgroundColor))
      .not.toBe(initialBackground);
    await expect(email).toHaveValue("local-reader@example.test");
    expect(server.requests.filter(request => request.pathname === task)).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(server.acceptedBusinessWrites).toBe(0);
  });
}

test("a missing actual shared-control chunk requires explicit reload", async ({ page }) => {
  const server = await serverFor(actualApp);
  const task = await actualTaskAsset();
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto(server.url);
  await expect(page.getByRole("heading", { name: "Royal Air Force | SODC", exact: true })).toBeVisible();
  await dismissCookies(page);
  server.failAsset(task);
  await page.getByRole("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await assertManualRecovery(page);
  expect(loads).toBe(1);
  expect(server.requests.filter(request => request.pathname === task).map(request => request.status)).toEqual([404]);
  server.failAsset(null);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
  expect(loads).toBe(2);
  expect(server.requests.filter(request => request.pathname === task).map(request => request.status)).toEqual([404, 200]);
  expect(server.acceptedBusinessWrites).toBe(0);
});

for (const responseMode of ["404", "html200"] as const) {
  test(`actual app A→B: obsolete lazy asset ${responseMode}, explicit reload and history`, async ({ page }) => {
    const server = await serverFor(actualApp);
    server.missingAssets(responseMode);
    let loads = 0;
    page.on("load", () => { loads++; });
    await page.goto(server.url + "/account");
    await expect(page.getByRole("main").getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await dismissCookies(page);
    expect(server.requests.some(request => request.pathname === actualApp.featureAssets.A)).toBe(false);
    expect(server.requests.some(request => request.pathname === actualApp.entries.A)).toBe(true);
    server.publish("B");
    await page.getByRole("link", { name: "Forgot password?", exact: true }).click();
    await assertManualRecovery(page);
    expect(new URL(page.url()).pathname).toBe("/account/reset-password");
    expect(loads).toBe(1);
    expect(server.requests.filter(request => request.pathname === actualApp.featureAssets.A).map(request => request.status)).toEqual([responseMode === "404" ? 404 : 200]);
    await page.getByRole("button", { name: "Reload page", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Reset your password — build B", exact: true })).toBeVisible();
    expect(loads).toBe(2);
    expect(server.requests.some(request => request.pathname === actualApp.entries.B && request.status === 200)).toBe(true);
    expect(server.requests.some(request => request.pathname === actualApp.featureAssets.B && request.status === 200)).toBe(true);
    // Actual history may restore A or use the current document. Both remain bounded and recoverable.
    await page.goBack();
    await expect(page.getByRole("main").getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
    await page.goForward();
    await expect.poll(async () => (await recoveryHeading(page).isVisible()) || (await page.getByRole("heading", { name: "Reset your password — build B", exact: true }).isVisible())).toBe(true);
    if (await recoveryHeading(page).isVisible()) {
      test.info().annotations.push({ type: "history", description: "History returned obsolete document A; explicit reload recovered B again." });
      await page.getByRole("button", { name: "Reload page", exact: true }).click();
    } else test.info().annotations.push({ type: "history", description: "History used current document B; no additional recovery was needed." });
    await expect(page.getByRole("heading", { name: "Reset your password — build B", exact: true })).toBeVisible();
    expect(server.acceptedBusinessWrites).toBe(0);
  });
}

test("blocked persistence still supports manual A→B recovery and preserves path/query/fragment", async ({ page, context }) => {
  await blockStorage(context);
  const server = await serverFor(localFixture);
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto(server.url + "/fixture?account=alpha");
  await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
  server.publish("B");
  await page.getByRole("link", { name: "Open lazy feature", exact: true }).click();
  await assertManualRecovery(page);
  const destination = new URL(page.url());
  expect(destination.pathname + destination.search + destination.hash).toBe("/fixture/feature?account=alpha&from=upgrade#review");
  expect(loads).toBe(1);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lazy feature build B", exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash).toBe(destination.pathname + destination.search + destination.hash);
  expect(loads).toBe(2);
  expect(server.acceptedBusinessWrites).toBe(0);
});

test("an unavailable chunk in the same build stays bounded until an explicit reload succeeds", async ({ page }) => {
  const server = await serverFor(localFixture);
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto(server.url + "/fixture?account=alpha");
  await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
  server.failAsset(localFixture.featureAssets.A);
  await page.getByRole("link", { name: "Open lazy feature", exact: true }).click();
  await assertManualRecovery(page);
  expect(loads).toBe(1);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await assertManualRecovery(page);
  expect(loads).toBe(2);
  expect(server.requests.filter(request => request.pathname === localFixture.featureAssets.A && request.status === 404)).toHaveLength(2);
  server.failAsset(null);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lazy feature build A", exact: true })).toBeVisible();
  expect(loads).toBe(3);
  expect(server.acceptedBusinessWrites).toBe(0);
});

test("an offline lazy import presents recovery without a reload loop or side effect", async ({ page, context }) => {
  const server = await serverFor(localFixture);
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto(server.url + "/fixture?account=alpha");
  await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
  server.publish("B");
  await context.setOffline(true);
  await page.getByRole("link", { name: "Open lazy feature", exact: true }).click();
  await assertManualRecovery(page);
  expect(loads).toBe(1);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lazy feature build B", exact: true })).toBeVisible();
  expect(loads).toBe(2);
  expect(server.acceptedBusinessWrites).toBe(0);
});

test("uncertain local save, private draft and account switch never replay a business write during upgrade", async ({ page }) => {
  const server = await serverFor(localFixture);
  let loads = 0;
  page.on("load", () => { loads++; });
  await page.goto(server.url + "/fixture/draft?account=alpha");
  await page.getByRole("textbox", { name: "Local draft", exact: true }).fill("ALPHA PRIVATE UNSAVED DRAFT");
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Save result unknown");
  expect(server.acceptedBusinessWrites).toBe(1);
  server.publish("B");
  await page.getByRole("link", { name: "Open lazy feature", exact: true }).click();
  await assertManualRecovery(page);
  expect(server.acceptedBusinessWrites).toBe(1);
  const dialogPromise = page.waitForEvent("dialog");
  const reloadClick = page.getByRole("button", { name: "Reload page", exact: true }).click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await reloadClick;
  await assertManualRecovery(page);
  await expect(page.locator("body")).toContainText("Current account: Alpha");
  await expect(page.locator("body")).toContainText("Session active");
  expect(loads).toBe(1);
  expect(server.acceptedBusinessWrites).toBe(1);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Local draft", exact: true })).toHaveValue("ALPHA PRIVATE UNSAVED DRAFT");
  await expect(page.getByRole("status")).toContainText("Save result unknown");
  // An uncertain journal entry survives editor remount and does not issue another POST.
  await page.getByRole("button", { name: "Save locally", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Save result unknown");
  expect(server.acceptedBusinessWrites).toBe(1);
  await page.goForward();
  await assertManualRecovery(page);
  await page.getByRole("button", { name: "Switch to Beta", exact: true }).click();
  await expect(page.locator("body")).toContainText("Current account: Beta");
  await expect(page.locator("body")).not.toContainText("ALPHA PRIVATE UNSAVED DRAFT");
  await expect(page.locator("body")).not.toContainText("Current account: Alpha");
  await assertManualRecovery(page);
  await page.getByRole("button", { name: "Reload page", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lazy feature build B", exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("Current account: Beta");
  await page.getByRole("link", { name: "Draft", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Local draft", exact: true })).toHaveValue("");
  expect(server.acceptedBusinessWrites).toBe(1);
  expect(server.requests.filter(request => request.method === "POST")).toHaveLength(1);
});

test("a genuinely browser-cached A document still offers manual recovery after B removes its lazy asset", async ({ browser }) => {
  const server = await serverFor(localFixture);
  // Routing disables HTTP cache. This separate context deliberately has no routes;
  // the fixture HTML's restrictive CSP permits only itself, and no Auth SDK runs.
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    await context.addInitScript(() => {
      window.addEventListener("pageshow", event => {
        if (event.persisted) console.log(`SODC_DEPLOYMENT_CACHE_RESTORE:${document.body.textContent?.includes("Shell build A") ? "A" : "other"}`);
      });
    });
    const page = await context.newPage();
    const restored: string[] = [];
    const remoteRequests: string[] = [];
    page.on("console", message => {
      if (message.text().startsWith("SODC_DEPLOYMENT_CACHE_RESTORE:")) restored.push(message.text().slice("SODC_DEPLOYMENT_CACHE_RESTORE:".length));
    });
    page.on("request", request => {
      if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url()).hostname)) remoteRequests.push(new URL(request.url()).origin);
    });
    await page.goto(server.url + "/fixture?account=alpha");
    await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
    expect(server.requests.some(request => request.pathname === localFixture.featureAssets.A)).toBe(false);
    await page.goto(server.url + "/__away");
    await expect(page.getByText("Local away page", { exact: true })).toBeVisible();
    server.publish("B");
    await page.goBack({ waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
    await expect.poll(() => restored).toContain("A");
    await expect(page.locator("body")).toContainText("Shell build A");
    await page.getByRole("link", { name: "Open lazy feature", exact: true }).click();
    await assertManualRecovery(page);
    expect(server.requests.some(request => request.pathname === localFixture.featureAssets.A && request.status === 404)).toBe(true);
    await page.getByRole("button", { name: "Reload page", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lazy feature build B", exact: true })).toBeVisible();
    expect(server.acceptedBusinessWrites).toBe(0);
    expect(remoteRequests).toEqual([]);
  } finally { await context.close(); }
});

test("immutable emitted JS and CSS survive full navigation while HTML, deep links and the manifest revalidate", async ({ browser }) => {
  const server = await serverFor(cachedFixture, true);
  // Playwright request routing disables the HTTP cache. This context has no
  // interception, no Auth SDK and the fixture's self-only meta CSP.
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    const remoteRequests: string[] = [];
    page.on("request", request => {
      if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url()).hostname)) remoteRequests.push(new URL(request.url()).origin);
    });
    const entryResponse = page.waitForResponse(response => new URL(response.url()).pathname === cachedFixture.entries.A);
    const styleResponse = page.waitForResponse(response => new URL(response.url()).pathname === fixtureStyles.A);
    const first = await page.goto(server.url + "/fixture?account=alpha&visit=first");
    await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
    expect(await (await entryResponse).headerValue("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await (await styleResponse).headerValue("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await first?.headerValue("cache-control")).toBe("no-cache");
    expect(await first?.headerValue("x-content-type-options")).toBe("nosniff");
    expect(await first?.headerValue("x-frame-options")).toBe("DENY");
    expect(await first?.headerValue("content-security-policy")).toContain("object-src 'none'");
    const loadedAssets = server.requests.filter(request => request.pathname.startsWith("/assets/") && request.status === 200).map(request => request.pathname);
    expect(loadedAssets).toContain(cachedFixture.entries.A);
    expect(loadedAssets).toContain(fixtureStyles.A);
    const before = server.requests.length;
    const second = await page.goto(server.url + "/fixture/draft?account=alpha&visit=second");
    await expect(page.getByRole("textbox", { name: "Local draft", exact: true })).toHaveValue("");
    expect(await second?.headerValue("cache-control")).toBe("no-cache");
    expect(server.requests.slice(before).filter(request => loadedAssets.includes(request.pathname))).toEqual([]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--deployment-cache-build").trim())).toBe("A");
    const manifest = await page.evaluate(async () => {
      const response = await fetch("/deployment-manifest.json");
      return { status: response.status, cache: response.headers.get("cache-control"), hardening: response.headers.get("x-content-type-options"), value: await response.json() };
    });
    expect(manifest.status).toBe(200);
    expect(manifest.cache).toBe("no-cache");
    expect(manifest.hardening).toBe("nosniff");
    expect(manifest.value.schemaVersion).toBe("sodc-deployment-manifest/v1");
    expect(server.requests.filter(request => request.pathname.startsWith("/fixture")).map(request => request.status)).toEqual([200, 200]);
    expect(server.acceptedBusinessWrites).toBe(0);
    expect(remoteRequests).toEqual([]);
  } finally { await context.close(); }
});

test("exact build asset rules allow upgrade recovery and rollback after an obsolete lazy asset returned 404", async ({ browser }) => {
  const server = await serverFor(cachedFixture, true);
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    const remoteRequests: string[] = [];
    page.on("request", request => {
      if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url()).hostname)) remoteRequests.push(new URL(request.url()).origin);
    });
    await page.goto(server.url + "/fixture?account=alpha&phase=A");
    await expect(page.getByRole("heading", { name: "Local fixture home", exact: true })).toBeVisible();
    expect(server.requests.some(request => request.pathname === cachedFixture.featureAssets.A)).toBe(false);
    server.publish("B");
    const obsoleteResponse = page.waitForResponse(response => new URL(response.url()).pathname === cachedFixture.featureAssets.A);
    await page.getByRole("link", { name: "Open lazy feature", exact: true }).click();
    await assertManualRecovery(page);
    const missing = await obsoleteResponse;
    expect(missing.status()).toBe(404);
    expect(await missing.headerValue("cache-control")).toBe("no-cache");
    expect(await missing.headerValue("content-type")).not.toContain("text/html");
    await page.getByRole("button", { name: "Reload page", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lazy feature build B", exact: true })).toBeVisible();
    expect(server.requests.some(request => request.pathname === cachedFixture.entries.B && request.status === 200)).toBe(true);
    expect(server.requests.some(request => request.pathname === cachedFixture.featureAssets.B && request.status === 200)).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--deployment-cache-build").trim())).toBe("B");
    server.publish("A");
    await page.goto(server.url + "/fixture/feature?account=alpha&phase=rollback");
    await expect(page.getByRole("heading", { name: "Lazy feature build A", exact: true })).toBeVisible();
    expect(server.requests.filter(request => request.pathname === cachedFixture.featureAssets.A).map(request => request.status)).toEqual([404, 200]);
    // The old missing URL revalidates; A's already-present assets can be reused.
    expect(server.requests.filter(request => request.pathname === cachedFixture.entries.A && request.status === 200)).toHaveLength(1);
    expect(server.requests.filter(request => request.pathname === fixtureStyles.A && request.status === 200)).toHaveLength(1);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--deployment-cache-build").trim())).toBe("A");
    expect(server.acceptedBusinessWrites).toBe(0);
    expect(remoteRequests).toEqual([]);
  } finally { await context.close(); }
});
