import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.SODC_SESSION_E2E === "1";
const accountA = { email: process.env.SODC_E2E_A_EMAIL ?? "", password: process.env.SODC_E2E_A_PASSWORD ?? "", marker: process.env.SODC_E2E_A_MARKER ?? "" };
const accountB = { email: process.env.SODC_E2E_B_EMAIL ?? "", password: process.env.SODC_E2E_B_PASSWORD ?? "", marker: process.env.SODC_E2E_B_MARKER ?? "" };
test.skip(!enabled, "Opt in only with disposable local emulator identities.");
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
async function signIn(page: Page, account: typeof accountA) {
  await page.goto("/account");
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

test("Back/Forward after another-tab logout cannot reveal the old private snapshot", async ({ page, context }, info) => {
  await signIn(page, accountA);
  await page.goto("/payments");
  await page.goto("/account");
  const other = await context.newPage();
  await other.goto("/");
  await logout(other);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(accountA.marker);
  await info.attach("history-check", { body: "Back navigation checked after a second tab signed out; browser BFCache eligibility is engine-dependent.", contentType: "text/plain" });
});
