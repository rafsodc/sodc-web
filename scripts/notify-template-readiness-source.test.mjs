import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildTemplateSourceContract,
  forwardsParameterField,
  forwardsRequestDataField,
  generatedTemplateManifestKeys,
} from "./__test_helpers__/notify-template-source-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function productionSources(directory, prefix = "") {
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "__tests__" || entry.name.endsWith("-generated")) continue;
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) for (const pair of await productionSources(path.join(directory, entry.name), relative)) files.set(...pair);
    else if (entry.name.endsWith(".ts") && !/\.(test|spec|d)\.ts$/.test(entry.name)) files.set(relative, await readFile(path.join(directory, entry.name), "utf8"));
  }
  return files;
}

describe("source-derived transactional sender catalogue regression", () => {
  let model, contract, sources;
  beforeAll(async () => {
    sources = await productionSources(path.join(root, "functions/src"));
    model = buildTemplateSourceContract(sources);
    contract = JSON.parse(await readFile(path.join(root, "config/notify-template-readiness.json"), "utf8"));
  });

  it("covers every concrete send/lookup key in production with the generated manifest and readiness catalogue", () => {
    const manifest = generatedTemplateManifestKeys(sources.get("generatedEmailTemplateManifest.ts"));
    expect(model.concreteTemplateKeys.length).toBeGreaterThan(0);
    expect(model.concreteTemplateKeys).toEqual(manifest);
    expect(contract.templates.map((row) => row.key).sort()).toEqual(model.concreteTemplateKeys);
  });

  it("derives both revision senders from their actual direct/imported helper calls (Q15)", () => {
    const paths = model.pathsToTemplate("bookingRevision");
    // Pin the resolved source shapes, independently of the JSON under test.
    // Recovery's dependency-selected dispatch is outside this bounded graph.
    expect(paths.map((route) => route.edges.map((edge) => edge.caller.name).concat(route.sink.name)).sort()).toEqual([
      ["reviewBookingRevision", "notifyBookingRevisionEmail"],
      ["submitEventBooking", "sendBookingSubmitNotificationEmails", "notifyBookingRevisionEmail"],
    ].sort());
    const registered = contract.templates.find((row) => row.key === "bookingRevision")?.functions;
    for (const route of paths) expect(registered, `Missing source-derived bookingRevision sender: ${route.sender}`).toContain(route.sender);
  });

  it("derives the dynamic-status activation sender without claiming restricted-only handlers can activate (Q17)", () => {
    const paths = model.pathsToTemplate("membershipActivated");
    const dynamic = paths.filter((route) => route.edges[0] && forwardsRequestDataField(route.edges[0], "newStatus"));
    expect(dynamic.map((route) => route.edges.map((edge) => edge.caller.name).concat(route.sink.name))).toEqual([
      ["updateMembershipStatus", "sendMembershipStatusEmailIfChanged", "notifyMembershipStatusEmailIfNeeded"],
    ]);
    expect(forwardsParameterField(dynamic[0].edges[1], "newStatus")).toBe(true);
    // Both restricted-only sources are reached syntactically, but their fixed
    // statuses are not evidence of an applicable activation path.
    expect(paths.filter((route) => !dynamic.includes(route)).map((route) => route.sender).sort())
      .toEqual(["confirmPotentialLostMember", "resignMembership"]);
    const registered = contract.templates.find((row) => row.key === "membershipActivated")?.functions;
    for (const route of dynamic) expect(registered, `Missing source-derived membershipActivated sender: ${route.sender}`).toContain(route.sender);
  });
});

describe("bounded source-contract support", () => {
  it("resolves named import aliases and ignores comments/string-shaped fake sends", () => {
    const model = buildTemplateSourceContract(new Map([
      ["sender.ts", 'export async function send() { await mailer.sendEmail({templateName: "real"}); }'],
      ["endpoint.ts", `import {onCall as callable} from "firebase-functions/v2/https";
        import {send as deliver} from "./sender";
        // mailer.sendEmail({templateName: "comment"});
        const unrelated = 'sendEmail({templateName: "string"})';
        export const endpoint = callable({}, async (request) => { await deliver(); });`],
    ]));
    expect(model.concreteTemplateKeys).toEqual(["real"]);
    expect(model.pathsToTemplate("real").map((route) => route.sender)).toEqual(["endpoint"]);
  });

  it("does not invent a direct call path through dependency-selected dispatch", () => {
    const model = buildTemplateSourceContract(new Map([
      ["endpoint.ts", `import {onCall} from "firebase-functions/v2/https";
        function send() { return mailer.sendEmail({templateName: "real"}); }
        export const endpoint = onCall({}, async () => { await (dependencies.send ?? send)(); });`],
    ]));
    expect(model.concreteTemplateKeys).toEqual(["real"]);
    expect(model.pathsToTemplate("real")).toEqual([]);
  });
});
