#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const hash = value => createHash("sha256").update(value).digest("hex");
const lowerFirst = value => value[0].toLowerCase() + value.slice(1);
const plural = value => value.endsWith("y") ? value.slice(0, -1) + "ies" : value.endsWith("s") ? value + "es" : value + "s";
// Only independent account metadata is eligible for automatic removal. Domain
// activity, shared snapshots and operator actions require a reviewed extension.
const removable = {
  LegacyUserIdentity: "userId", UserUserGroup: "userId",
  SectionAnnouncementOptOut: "userId", CallableInvocation: "userId",
  CallableRateLimitBucket: "userId", UserSecurityState: "userId",
  SecurityTransition: "userId", PotentialLostReview: "userId",
};

export function inventoryTables(source) {
  const clean = source.replace(/#[^\n]*/g, "");
  const tables = [...clean.matchAll(/type\s+(\w+)\s+(@table[^{}]*)\{([^}]+)\}/g)].map(([, name, , body]) => ({
    name, fields: [...body.matchAll(/^\s*(\w+):\s*([\w[\]!]+)/gm)].map(([, name, type]) => ({name, type: type.replace(/[[\]!]/g, "")})),
  }));
  const declared = [...clean.matchAll(/type\s+(\w+)/g)].map(match => match[1]);
  if (!tables.length || tables.length !== declared.length) throw new Error("SCHEMA_PARSE_INCOMPLETE");
  const names = new Set(declared);
  return tables.map(table => ({...table, field: lowerFirst(table.name), collection: plural(lowerFirst(table.name)),
    selection: table.fields.map(field => names.has(field.type)
      ? field.name + " { " + tables.find(t => t.name === field.type).fields.filter(f => f.name === "id").map(f => f.name).join(" ") + " }"
      : field.name).join(" "),
  }));
}

export function classify(table, row, {uid, email}) {
  const tokens = [uid, email.toLowerCase(), hash(email.trim().toLowerCase())];
  const text = JSON.stringify(row).toLowerCase();
  if (!tokens.some(token => text.includes(token.toLowerCase()))) return "unrelated";
  if (table.name === "User") return row.id === uid && row.email.toLowerCase() === email.toLowerCase() && !row.stripeCustomerId ? "delete" : "blocked";
  const owner = removable[table.name];
  if (!owner || (row[owner] ?? row.user?.id) !== uid) return "blocked";
  if (table.name === "UserSecurityState" && (row.desiredAdmin || row.adminReady || row.syncStatus !== "READY")) return "blocked";
  const completedDeletionHold = row.actorKind === "ADMIN" && row.reason === "ACCOUNT_DELETION" &&
    row.authDisabled === true && row.desiredAdmin === false && row.syncStatus === "READY";
  if (table.name === "SecurityTransition" && (row.syncStatus === "PENDING" || (row.actorId !== uid && !completedDeletionHold))) return "blocked";
  // A review can contain another member's or operator's evidence.
  if (table.name === "PotentialLostReview") return "blocked";
  return "delete";
}

export function parseOptions(args) {
  const values = {};
  const flags = new Set(["--apply", "--no-retention", "--writers-paused", "--external-reviewed"]);
  const keys = new Set(["--project", "--email", "--uid", "--case", "--receipt"]);
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (Object.hasOwn(values, key)) throw new Error("DUPLICATE_OPTION");
    if (flags.has(key)) values[key] = true;
    else if (keys.has(key) && args[i + 1] && !args[i + 1].startsWith("--")) values[key] = args[++i];
    else throw new Error("INVALID_OPTION");
  }
  for (const key of keys) if (!values[key]) throw new Error("MISSING_OPTION_" + key.slice(2).toUpperCase());
  const projects = Object.values(JSON.parse(readFileSync(path.join(root, ".firebaserc"), "utf8")).projects);
  if (!projects.includes(values["--project"])) throw new Error("UNKNOWN_PROJECT");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values["--email"])) throw new Error("INVALID_EMAIL");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(values["--case"])) throw new Error("INVALID_CASE_REFERENCE");
  if (values["--apply"] && !["--no-retention", "--writers-paused", "--external-reviewed"].every(key => values[key])) throw new Error("APPLY_ATTESTATIONS_REQUIRED");
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.DATA_CONNECT_EMULATOR_HOST) throw new Error("EMULATOR_OVERRIDE_FORBIDDEN");
  return values;
}

export async function runErasure(options, {auth, dc, receipt}) {
  const uid = options["--uid"], email = options["--email"], apply = options["--apply"] === true;
  const tables = inventoryTables(readFileSync(path.join(root, "dataconnect/schema/schema.gql"), "utf8"));
  const record = (stage, extra = {}) => receipt({version: 1, case: options["--case"], project: options["--project"], subjectHash: hash(uid), at: new Date().toISOString(), stage, ...extra});
  async function identity() {
    let user;
    try { user = await auth.getUser(uid); } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
    if (user && (user.email?.toLowerCase() !== email.toLowerCase() || user.customClaims?.admin)) throw new Error("AUTH_IDENTITY_OR_ADMIN_CONFLICT");
    try {
      const byEmail = await auth.getUserByEmail(email);
      if (byEmail.uid !== uid) throw new Error("EMAIL_BELONGS_TO_DIFFERENT_UID");
    } catch (error) { if (error.code !== "auth/user-not-found") throw error; }
    return user;
  }
  async function scan() {
    const counts = {}, blockers = {};
    for (const table of tables) {
      let offset = 0;
      while (true) {
        // Read every scalar and direct relation, including free text, snapshots,
        // audit actors, email hashes and UID arrays. Never print row contents.
        const result = await dc.executeGraphqlRead(`query ErasureInventory { ${table.collection}(limit: 250, offset: ${offset}) { ${table.selection} } }`);
        if (result.errors?.length) throw new Error("INVENTORY_QUERY_FAILED");
        const rows = result.data?.[table.collection];
        if (!Array.isArray(rows)) throw new Error("INVENTORY_INCOMPLETE");
        for (const row of rows) {
          const action = classify(table, row, {uid, email});
          if (action === "blocked") blockers[table.name] = (blockers[table.name] ?? 0) + 1;
          if (action === "delete") counts[table.name] = (counts[table.name] ?? 0) + 1;
        }
        if (rows.length < 250) break;
        offset += rows.length;
      }
    }
    return {counts, blockers};
  }
  record("STARTED", {apply});
  try {
    const user = await identity();
    let plan = await scan();
    record("INVENTORIED", plan);
    if (Object.keys(plan.blockers).length) throw new Error("LINKED_ACTIVITY_REQUIRES_REVIEW");
    if (!apply) { record("PREVIEW_COMPLETE"); return; }
    if (user) { await auth.updateUser(uid, {disabled: true}); await auth.revokeRefreshTokens(uid); }
    record("AUTH_DISABLED");
    // Re-read after revocation; maintenance must cover all background writers too.
    await identity();
    plan = await scan();
    if (Object.keys(plan.blockers).length) throw new Error("LINKED_ACTIVITY_REQUIRES_REVIEW");
    const operations = Object.entries(removable).filter(([name]) => plan.counts[name]).map(([name, owner], i) =>
      `d${i}: ${lowerFirst(name)}_deleteMany(where: { ${owner}: {eq: $uid} })`);
    if (plan.counts.User) operations.push("profile: user_deleteMany(where: {id: {eq: $uid}, email: {eq: $email}}) @check(expr: \"this == 1\", message: \"ERASURE_IDENTITY_CHANGED\")");
    if (operations.length) {
      const variables = {uid, ...(plan.counts.User ? {email} : {})};
      const result = await dc.executeGraphql(`mutation EraseAccount($uid: String!${plan.counts.User ? ", $email: String!" : ""}) @transaction { ${operations.join("\n")} }`, {variables});
      if (result.errors?.length) throw new Error("DATABASE_ERASURE_FAILED");
    }
    record("DATABASE_ERASED");
    const remaining = await scan();
    if (Object.keys(remaining.counts).length || Object.keys(remaining.blockers).length) throw new Error("DATABASE_VERIFICATION_FAILED");
    // Auth goes last, so partial failure leaves a disabled, identifiable account.
    if (await identity()) await auth.deleteUser(uid);
    if (await identity()) throw new Error("AUTH_VERIFICATION_FAILED");
    record("ACTIVE_STORES_ERASED", {externalReviewRequired: true, backupExpiryRequired: true});
  } catch (error) {
    record("INCOMPLETE", {code: /^[A-Z_]+$/.test(error.message) ? error.message : "OPERATION_FAILED"});
    throw new Error("Erasure incomplete; inspect the receipt and retry the same subject and case.");
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  let app;
  try {
    const options = parseOptions(process.argv.slice(2));
    const [{initializeApp, applicationDefault, deleteApp}, {getAuth}, {getDataConnect}] = await Promise.all([
      import("firebase-admin/app"), import("firebase-admin/auth"), import("firebase-admin/data-connect"),
    ]);
    const receipt = value => appendFileSync(options["--receipt"], JSON.stringify(value) + "\n", {mode: 0o600});
    // Prove the durable receipt can be written before any remote mutation.
    receipt({stage: "OPENED", at: new Date().toISOString()});
    app = initializeApp({projectId: options["--project"], credential: applicationDefault()}, "erasure-" + randomUUID());
    try {
      await runErasure(options, {auth: getAuth(app), dc: getDataConnect({serviceId: "sodc-web-service", location: "europe-west2"}, app), receipt});
    } finally { await deleteApp(app); }
    console.log("Workflow finished. Review the protected receipt for status and remaining obligations.");
  } catch { console.error("Erasure workflow did not complete. Inspect the protected receipt; no completion is implied."); process.exitCode = 1; }
}
