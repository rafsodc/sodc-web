import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

type AuthExpectation = {
  op: string;
  mustInclude: string;
};

function readApiFile(fileName: string): string {
  const p = path.resolve(process.cwd(), "..", "dataconnect", "api", fileName);
  return fs.readFileSync(p, "utf8");
}

function extractOperationBlock(source: string, operationName: string): string {
  const idx = source.indexOf(operationName);
  if (idx < 0) throw new Error(`Operation not found: ${operationName}`);
  const start = source.lastIndexOf("\n", idx);
  const end = source.indexOf("\n}", idx);
  return source.slice(start >= 0 ? start : 0, end >= 0 ? end + 2 : source.length);
}

function assertAuth(source: string, checks: AuthExpectation[]): void {
  for (const check of checks) {
    const block = extractOperationBlock(source, check.op);
    expect(block).toContain(check.mustInclude);
  }
}

describe("Data Connect auth contracts", () => {
  it("Phase A: critical booking/payment/admin operations keep strict auth", () => {
    const queries = readApiFile("queries.gql");
    const bookingMutations = readApiFile("booking-mutations.gql");
    const adminSdk = readApiFile("admin-mutations.gql");

    assertAuth(queries, [
      { op: "query ListEventBookingsForAdmin", mustInclude: '@auth(expr: "auth.token.admin == true && auth.token.enabled == true")' },
      { op: "query ListGuestTicketRequestsForAdmin", mustInclude: '@auth(expr: "auth.token.admin == true && auth.token.enabled == true")' },
      { op: "query ListTicketOrdersForAdmin", mustInclude: '@auth(expr: "auth.token.admin == true && auth.token.enabled == true")' },
      { op: "query GetMyTicketOrderById", mustInclude: '@auth(expr: "auth.token.enabled == true")' },
    ]);

    assertAuth(bookingMutations, [
      { op: "mutation CreateGuestTicketRequest", mustInclude: '@auth(expr: "auth.token.enabled == true")' },
      { op: "mutation AdminReviewGuestTicketRequest", mustInclude: '@auth(expr: "auth.token.admin == true && auth.token.enabled == true")' },
    ]);

    assertAuth(adminSdk, [
      { op: "query GetUserForCheckout", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "query GetTicketTypeForCheckout", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "mutation CreateTicketOrderForCheckout", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "query GetTicketOrderForWebhook", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "mutation MarkTicketOrderPaidFromWebhook", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "query GetBookingsForBookerAndEvent", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "mutation UpdateBookingStatusFromCallable", mustInclude: "@auth(level: NO_ACCESS)" },
      { op: "mutation UpdateBookingPreferencesFromCallable", mustInclude: "@auth(level: NO_ACCESS)" },
    ]);
  });

  it("Phase B: all operations declare an @auth directive", () => {
    const apiDir = path.resolve(process.cwd(), "..", "dataconnect", "api");
    const files = fs.readdirSync(apiDir).filter((f) => f.endsWith(".gql"));

    const opHeader = /(query|mutation)\s+([A-Za-z0-9_]+)/g;
    for (const file of files) {
      const source = fs.readFileSync(path.join(apiDir, file), "utf8");
      const matches = [...source.matchAll(opHeader)];
      if (matches.length === 0) continue;
      for (const m of matches) {
        const start = m.index ?? 0;
        const end = source.indexOf("{", start);
        const header = source.slice(start, end >= 0 ? end : start + 400);
        expect(header).toContain("@auth(");
      }
    }
  });
});
