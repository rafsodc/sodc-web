import { cp, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";

export const AUTHORIZATION_PROJECTS = ["sodc-web", "sodc-web-beta", "sodc-web-production"];
export const LEGACY_POTENTIAL_LOST_OPERATIONS = ["ConfirmPotentialLostWithSecurityState", "ConfirmPotentialLost"];

const LEGACY_SECTION_ADMIN_OPERATIONS = new Set([
  "CreateEvent", "UpdateEvent", "DeleteEvent", "CreateTicketType", "UpdateTicketType", "DeleteTicketType",
  "GetEventsForSection", "GetEventById", "ListEventBookingsForAdmin", "ListTicketOrdersForAdmin",
  "ListBookingPaymentAdjustmentsForAdmin", "ListSectionTicketAccessGroups",
]);

function removeGuardSelection(source, marker) {
  let result = source;
  for (;;) {
    const start = result.indexOf(marker);
    if (start < 0) return result;
    let quote = false; let escaped = false; let parentheses = 0; let braces = 0; let selection = -1; let end = -1;
    for (let index = start; index < result.length; index++) {
      const char = result[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quote = false;
        continue;
      }
      if (char === '"') {quote = true; continue;}
      if (char === "(") parentheses++;
      else if (char === ")") parentheses--;
      else if (char === "{" && parentheses === 0) {
        if (selection < 0) selection = index;
        braces++;
      } else if (char === "}" && selection >= 0 && parentheses === 0 && --braces === 0) {end = index + 1; break;}
    }
    if (end < 0) throw new Error("Cannot identify authorization guard selection; refusing compatibility artifact");
    result = result.slice(0, start) + result.slice(end);
  }
}

/** Legacy-only sealed artifacts retain the old administrator boundary. They must
 * not emit dangling current-state references or grant the new moderator scope
 * before current authority has been backfilled. Checked-in strict sources are
 * never changed by this transformation.
 */
export function compatibilityOperationSource(source) {
  const starts = [...source.matchAll(/^(?:query|mutation)\s+(\w+)/gm)];
  const chunks = starts.length ? [source.slice(0, starts[0].index)] : [source];
  for (let index = 0; index < starts.length; index++) {
    let operation = source.slice(starts[index].index, starts[index + 1]?.index ?? source.length);
    const scoped = operation.includes("managementScope:");
    if (scoped) {
      if (!LEGACY_SECTION_ADMIN_OPERATIONS.has(starts[index][1]) || !operation.includes("SECTION_MODERATOR_REQUIRED") ||
          !operation.includes('@auth(expr: "auth.token.enabled == true")')) {
        throw new Error("Unknown section management scope; refusing compatibility artifact");
      }
      operation = operation.replace('@auth(expr: "auth.token.enabled == true")', '@auth(expr: "auth.token.admin == true && auth.token.enabled == true")');
    }
    for (const marker of ["currentAuthorization: userSecurityState", "managementScope:", "audienceGroup:", "managementBooking:"]) {
      operation = removeGuardSelection(operation, marker);
    }
    if (/response(?:\.query)?\.currentAuthorization/.test(operation)) throw new Error("Unresolved current authority reference; refusing compatibility artifact");
    chunks.push(operation);
  }
  // Preserve malformed-source refusal even when no complete named definition exists.
  if (!starts.length && source.includes("currentAuthorization: userSecurityState")) throw new Error("Unknown current authorization source; refusing compatibility artifact");
  return chunks.join("").replace(/query\s+@redact\s*\{\s*\}/g, "");
}

/** Source preparation only. This function never authenticates, deploys, or changes checked-in sources. */
export async function prepareAuthorizationRollout({repositoryRoot, output, projectId, expiresAt, now = new Date()}) {
  if (!AUTHORIZATION_PROJECTS.includes(projectId)) throw new Error("Explicit supported --project required");
  const expiry = new Date(expiresAt);
  if (!expiresAt || !Number.isFinite(expiry.getTime()) || expiry <= now || expiry.getTime() - now.getTime() > 48 * 3600_000) {
    throw new Error("An explicit --expires timestamp within the next 48 hours is required");
  }
  if (!path.isAbsolute(output ?? "") || !path.relative(repositoryRoot, output).startsWith(`..${path.sep}`)) throw new Error("--output must be an absolute new directory outside the checkout");
  const [canonicalRoot, canonicalParent] = await Promise.all([realpath(repositoryRoot), realpath(path.dirname(output))]);
  if (!path.relative(canonicalRoot, path.join(canonicalParent, path.basename(output))).startsWith(`..${path.sep}`)) throw new Error("--output symlink resolves inside the checkout");
  await mkdir(output); // Fail on any existing artifact; never overwrite a reviewed source tree.
  await cp(path.join(repositoryRoot, "dataconnect"), path.join(output, "dataconnect"), {recursive: true,
    filter: source => !source.split(path.sep).includes(".dataconnect")});
  const connectorRoot = path.join(output, "dataconnect");
  for (const connector of ["api", "booking-service", "authorization-service"]) {
    const directory = path.join(connectorRoot, connector);
    // Prevent generated outputs/package installs from escaping this temporary artifact.
    await writeFile(path.join(directory, "connector.yaml"), `connectorId: ${connector}\n`);
    if (connector !== "api") continue;
    for (const file of (await readdir(directory)).filter(file => file.endsWith(".gql"))) {
      const target = path.join(directory, file);
      const source = await readFile(target, "utf8");
      if (LEGACY_POTENTIAL_LOST_OPERATIONS.some(name => new RegExp(`mutation\\s+${name}\\s*\\(`).test(source))) {
        throw new Error("Legacy Potential Lost writers must remain outside strict API sources");
      }
      await writeFile(target, compatibilityOperationSource(source));
    }
  }
  // These historical writers intentionally bypass current admin safety. They
  // belong only to the reviewed compatibility artifact, never default sources
  // or generated SDKs. Preserve both deployed Functions generations unchanged.
  const legacy = await readFile(path.join(repositoryRoot, "scripts/authorization-compatibility/member-review.gql"), "utf8");
  await writeFile(path.join(connectorRoot, "api/legacy-member-review.gql"), legacy);
  await writeFile(path.join(output, "firebase.json"), JSON.stringify({dataconnect: {source: "dataconnect"}}, null, 2) + "\n");
  await writeFile(path.join(output, "AUTHORIZATION-ROLLOUT.json"), JSON.stringify({
    schemaVersion: "sodc-authorization-compatibility/v1", projectId, createdAt: now.toISOString(), expiresAt: expiry.toISOString(),
    compatibilityOnlyOperations: LEGACY_POTENTIAL_LOST_OPERATIONS,
    purpose: "Temporary additive API deployment before security-state backfill and strict API cutover. Legacy claim checks remain. No deploy has occurred.",
    warning: "This artifact does not enforce current-authorization revocation. Never use after strict API cutover. Delete after migration or expiry.",
  }, null, 2) + "\n");
  return output;
}
