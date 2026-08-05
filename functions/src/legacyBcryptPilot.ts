import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { passwordDisposition } from "./legacyUserMigration";

/**
 * sodc-api's Symfony `auto` hasher resolves to PHP's password_hash(), which stamps
 * bcrypt hashes with the `$2y$` prefix. Firebase Auth's BCRYPT import has not been
 * proven against that specific prefix -- `$2a$`/`$2b$` are far more common in the
 * wild. bcryptjs only produces `$2a$`/`$2b$`, so the prefix is rewritten here.
 * This is safe: for ASCII-only passwords, $2a$/$2b$/$2y$ are the same algorithm,
 * differing only in a historical multi-byte-character bug fix that never applies
 * to a fresh synthetic test password.
 */
const LEGACY_HASH_PREFIX = "$2y$";

export interface SyntheticLegacyCredential {
  password: string;
  hash: string;
}

/**
 * Generates a fresh random password and its `$2y$`-prefixed bcrypt hash, reproducing
 * the exact format the legacy exporter's real hashes are expected to have. Never
 * derived from or usable to recover any real member's credential.
 */
export function generateSyntheticLegacyCredential(
  costFactor = 12
): SyntheticLegacyCredential {
  const password = randomBytes(24).toString("base64url");
  const bcryptjsHash = bcrypt.hashSync(password, costFactor);
  const hash = LEGACY_HASH_PREFIX + bcryptjsHash.slice(LEGACY_HASH_PREFIX.length);
  if (passwordDisposition(hash) !== "compatible-bcrypt") {
    throw new Error(
      "generated synthetic hash did not match the importer's compatible-bcrypt pattern -- " +
        "check BCRYPT_PATTERN in legacyUserMigration.ts against this generator"
    );
  }
  return { password, hash };
}

export interface BcryptPilotOutcome {
  hashImported: boolean;
  signInVerified: boolean;
  costFactor: number;
}

/** True only when the synthetic credential both imported and signed in successfully. */
export function bcryptPilotSucceeded(outcome: BcryptPilotOutcome): boolean {
  return outcome.hashImported && outcome.signInVerified;
}
