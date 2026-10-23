import { expect, test, type Page } from "@playwright/test";
import { createServer } from "node:http";

const enabled = process.env.SODC_SESSION_E2E === "1";
const accountA = { email: process.env.SODC_E2E_A_EMAIL ?? "", password: process.env.SODC_E2E_A_PASSWORD ?? "", marker: process.env.SODC_E2E_A_MARKER ?? "" };
const accountB = { email: process.env.SODC_E2E_B_EMAIL ?? "", password: process.env.SODC_E2E_B_PASSWORD ?? "", marker: process.env.SODC_E2E_B_MARKER ?? "" };
test.skip(!enabled, "Opt in only with disposable local emulator identities.");
const awayServer = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "public,max-age=300" });
  response.end("<!doctype html><title>Local acceptance</title><p>Local acceptance away page</p>");
});
let awayURL: string;
test.beforeAll(async () => {
  await new Promise<void>(resolve => awayServer.listen(0, "127.0.0.1", resolve));
  const address = awayServer.address();
  if (!address || typeof address === "string") throw new Error("Local acceptance server did not bind.");
  awayURL = `http://127.0.0.1:${address.port}/`;
});
test.afterAll(async () => {
  if (awayServer.listening) await new Promise<void>((resolve, reject) => awayServer.close(error => error ? reject(error) : resolve()));
});
test.beforeEach(async ({ context }) => {
  // A localhost page can still be misconfigured to use production Firebase.
  // Block remote HTTP requests before any credential is submitted.
  await context.route("**/*", (route) => {
    const hostname = new URL(route.request().url()).hostname;
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ? route.continue() : route.abort();
  });
  await context.routeWebSocket("**/*", (socket) => {
    const hostname = new URL(socket.url()).hostname;
    if (["localhost", "127.0.0.1", "[::1]"].includes(hostname)) socket.connectToServer();
    else socket.close({ code: 1008, reason: "Only local emulator traffic is allowed" });
  });
  for (const value of [...Object.values(accountA), ...Object.values(accountB)]) expect(value).not.toBe("");
  expect(accountA.marker).not.toBe(accountB.marker);
});
async function signIn(page: Page, account: typeof accountA, destination = "/account") {
  await page.goto(destination);
  await page.getByLabel("Email", { exact: true }).fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("main").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(account.marker);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await page.waitForURL(/\/account/);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
}
async function dismissCookies(page: Page) {
  const banner = page.getByRole("region", { name: "Cookies and browser storage", exact: true });
  if (await banner.isVisible()) await banner.getByRole("button", { name: "Decline preference cookies", exact: true }).click();
}

for (const route of ["/profile", "/account/settings"]) {
  test(`cold reload preserves the ${route} email-link destination`, async ({ page }) => {
    const destination = `${route}?from=email#preferences`;
    await signIn(page, accountA, destination);
    const content = route === "/profile"
      ? page.getByRole("textbox", { name: /^First Name/ })
      : page.getByRole("heading", { name: "Announcement emails", exact: true });
    await expect(content).toBeVisible();
    expect(new URL(page.url()).pathname + new URL(page.url()).search + new URL(page.url()).hash).toBe(destination);
    await page.reload();
    await expect(content).toBeVisible();
    const url = new URL(page.url());
    expect(`${url.pathname}${url.search}${url.hash}`).toBe(destination);
  });
}

test("own membership save refreshes access and resumes the profile", async ({ page }) => {
  await signIn(page, accountA);
  await page.goto("/profile");
  await expect(page.getByTestId("membership-status-select")).toContainText("Regular");
  await dismissCookies(page);
  for (const label of ["Reserve", "Regular"]) {
    await page.getByTestId("membership-status-select").getByRole("combobox").click();
    await page.getByRole("option", { name: label, exact: true }).click();
    await page.getByRole("main").getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Profile updated successfully!" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^First Name/ })).toBeVisible();
    await expect(page.getByTestId("membership-status-select")).toContainText(label);
    await expect(page.getByRole("button", { name: "Account menu" })).toContainText(accountA.marker);
  }
});

test("a pending access check hides private data until explicit recovery succeeds", async ({ page, context }) => {
  await signIn(page, accountA);
  let denyNextProfileRead = true;
  let accessPending = true;
  let pendingChecks = 0;
  // Inject one stale read and a pending status at the loopback transport boundary.
  // The retry uses the real emulator callable and refresh path.
  await context.route(url => url.hostname === "127.0.0.1" && url.port === "9399", async route => {
    if (denyNextProfileRead && route.request().method() === "POST" && route.request().postDataJSON()?.operationName === "GetCurrentUser") {
      denyNextProfileRead = false;
      await route.fulfill({ status: 403, json: { error: { code: 403, status: "PERMISSION_DENIED", message: "SESSION_VERSION_STALE" } } });
    } else await route.fallback();
  });
  await context.route("**/getMyAuthorizationStatus", async route => {
    if (accessPending && route.request().method() === "POST") {
      pendingChecks++;
      await route.fulfill({ json: { result: { status: "pending", isAdmin: false, securityVersion: null, tokenVersionCurrent: false, verificationRequired: false } } });
    } else await route.fallback();
  });
  await page.goto("/profile");
  await expect(page.getByRole("alert")).toContainText("Your account access is being updated");
  await expect(page.getByRole("textbox", { name: /^First Name/ })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(accountA.marker);
  expect(denyNextProfileRead).toBe(false);
  expect(pendingChecks).toBe(1);
  accessPending = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toContainText(accountA.marker);
  await page.goto("/profile");
  await expect(page.getByRole("textbox", { name: /^First Name/ })).toBeVisible();
});

test("shared device and another tab never keep A after logout and B login", async ({ page, context }) => {
  await signIn(page, accountA);
  await page.goto("/bookings");
  await page.goto("/payments");
  const other = await context.newPage();
  await other.goto("/");
  await expect(other.getByRole("button", { name: "Account menu" })).toContainText(accountA.marker);
  await logout(page);
  await expect(other.getByRole("button", { name: "Account menu" })).toHaveCount(0);
  await signIn(page, accountB);
  await expect(page.locator("body")).not.toContainText(accountA.marker);
  await expect(other.locator("body")).not.toContainText(accountA.marker);
});

test("first login survives blocked persistence without a document reload loop", async ({ context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { configurable: true, value: undefined });
    for (const name of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(window, name, { configurable: true, get() { throw new DOMException("Test storage blocked", "SecurityError"); } });
    }
  });
  const page = await context.newPage();
  let loads = 0;
  page.on("load", () => { loads++; });
  await signIn(page, accountA);
  expect(loads).toBe(1);
  await logout(page);
  await signIn(page, accountB);
  await expect(page.locator("body")).not.toContainText(accountA.marker);
});

test("actual browser-cache restoration after another-tab logout contains no old private snapshot", async ({ page, context }) => {
  const restoredSnapshots: boolean[] = [];
  page.on("console", message => {
    if (message.text() === "SODC_ACCEPTANCE_RESTORED:clear") restoredSnapshots.push(false);
    if (message.text() === "SODC_ACCEPTANCE_RESTORED:private") restoredSnapshots.push(true);
  });
  await context.addInitScript(({ marker }) => {
    window.addEventListener("pageshow", event => {
      if (event.persisted) console.log(`SODC_ACCEPTANCE_RESTORED:${document.body.textContent?.includes(marker) ? "private" : "clear"}`);
    });
  }, { marker: accountA.marker });
  await signIn(page, accountA);
  await page.goto("/profile");
  await expect(page.getByRole("textbox", { name: /^First Name/ })).toBeVisible();
  await page.goto(awayURL);
  const other = await context.newPage();
  await other.goto("/");
  await logout(other);
  // Cached documents fire pageshow, without a new load event.
  await page.goBack({ waitUntil: "commit" });
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(accountA.marker);
  await expect.poll(() => restoredSnapshots.length).toBeGreaterThan(0);
  expect(restoredSnapshots).not.toContain(true);
});
