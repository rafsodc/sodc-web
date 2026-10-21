import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventory = [];
const onboarding = new Set(["CreateUserProfile", "CheckUserProfileExists"]);
for (const connector of ["api", "booking-service", "authorization-service"]) {
  for (const file of fs.readdirSync(path.join(root, "dataconnect", connector)).filter(name => name.endsWith(".gql")).sort()) {
    const source = fs.readFileSync(path.join(root, "dataconnect", connector, file), "utf8");
    const starts = [...source.matchAll(/^(query|mutation)\s+(\w+)/gm)];
    for (let i = 0; i < starts.length; i++) {
      const match = starts[i]; const operation = source.slice(match.index, starts[i + 1]?.index ?? source.length);
      const header = operation.slice(0, operation.indexOf("{"));
      let classification;
      if (header.includes("@auth(level: NO_ACCESS)")) classification = "service-only";
      else if (onboarding.has(match[2]) && header.includes("email_verified == true")) classification = "onboarding-own-profile";
      else if (header.includes("auth.token.enabled == true")) {
        classification = header.includes("auth.token.admin == true") ? "current-admin" : "current-member";
        for (const marker of ["currentAuthorization: userSecurityState", "userId_expr: \"auth.uid\"", "@redact", "ACCESS_REVOKED", "SESSION_VERSION_STALE", "auth.token.securityVersion", "this.membershipStatus == this.user.membershipStatus", "this.syncStatus == 'READY'"])
          if (!operation.includes(marker)) throw new Error(`${match[2]} missing current authorization check: ${marker}`);
        if (classification === "current-admin" && !operation.includes('adminReady @check(expr: "this == true", message: "ACCESS_REVOKED")')) throw new Error(`${match[2]} lacks current admin readiness check`);
        if (match[1] === "mutation" && (!header.includes("@transaction") || operation.indexOf("currentAuthorization:") > operation.search(/\w+_(?:insert|upsert|update|delete)/))) throw new Error(`${match[2]} must check before writing transactionally`);
      } else throw new Error(`${match[2]} lacks an explicit authorization classification`);
      inventory.push({connector, file, operation: match[2], kind: match[1], classification});
    }
  }
}
const target = path.join(root, "docs/security/authorization-operations.json");
const result = JSON.stringify(inventory, null, 2) + "\n";
if (process.argv.includes("--write")) fs.writeFileSync(target, result);
else if (fs.readFileSync(target, "utf8") !== result) throw new Error("Authorization inventory drift: run node scripts/check-authorization-inventory.mjs --write and review");
console.log(`Verified ${inventory.length} explicitly classified connector operations`);
