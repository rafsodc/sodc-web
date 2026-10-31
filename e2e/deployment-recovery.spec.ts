import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { buildDeployments, type BuiltDeployment } from "./support/deploymentBuilds";
import { startDeploymentServer, type DeploymentServer } from "./support/deploymentServer";

let actualApp: BuiltDeployment;
let localFixture: BuiltDeployment;
const servers = new Set<DeploymentServer>();
const recoveryHeading = (page: Page) => page.getByRole("heading", { name: "This page couldn’t load", exact: true });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  actualApp = await buildDeployments("app");
  localFixture = await buildDeployments("fixture");
});
test.afterAll(async () => {
  await actualApp?.remove();
  await localFixture?.remove();
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

async function serverFor(build: BuiltDeployment) {
  const server = await startDeploymentServer(build.directories);
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
