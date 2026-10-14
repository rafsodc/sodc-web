import { createHash } from "node:crypto";

export function announcementEmailOptOutId(sectionId: string, email: string): string {
  return createHash("sha256").update(`${sectionId.replace(/-/g, "").toLowerCase()}:${email.trim().toLowerCase()}`).digest("hex");
}
