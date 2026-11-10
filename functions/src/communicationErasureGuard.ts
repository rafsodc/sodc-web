import { createHash } from "node:crypto";
import { getDataConnect } from "firebase-admin/data-connect";
import { FUNCTIONS_REGION } from "./constants";

export const erasureEmailHash = (email: string) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
const db = () => getDataConnect({connector: "api", serviceId: "sodc-web-service", location: FUNCTIONS_REGION});
export async function erasingUserIds(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Set<string>();
  for (let offset = 0; offset < unique.length; offset += 200) {
    const page = unique.slice(offset, offset + 200);
    // Select IDs only and refuse a potentially truncated result.
    const response = await db().executeGraphqlRead<any, {ids: string[]}>(`query ErasingUsers($ids: [String!]!) {
      accountErasures(where: {userId: {in: $ids}}, limit: 10000) {userId}
    }`, {variables: {ids: page}});
    const rows = response.data?.accountErasures;
    if (!Array.isArray(rows) || rows.length >= 10000) throw new Error("ERASURE_GUARD_UNAVAILABLE");
    for (const row of rows) result.add(row.userId);
  }
  return result;
}
export async function isUserErasing(id?: string | null): Promise<boolean> {
  return id ? (await erasingUserIds([id])).has(id) : false;
}
export async function isErasedContact(email: string, currentUserId?: string | null): Promise<boolean> {
  const response = await db().executeGraphqlRead<any, {hash: string}>(`query ErasedContact($hash: String!) {
    accountErasures(where: {emailHash: {eq: $hash}}, limit: 10000) {userId}
  }`, {variables: {hash: erasureEmailHash(email)}});
  const rows = response.data?.accountErasures;
  if (!Array.isArray(rows) || rows.length >= 10000) throw new Error("ERASURE_GUARD_UNAVAILABLE");
  // Re-registering the same address under a new identity remains possible.
  return rows.some(row => !currentUserId || row.userId === currentUserId);
}
export function isErasureWriteDenied(error: unknown): boolean {
  return String(error).includes("ACCOUNT_ERASURE_IN_PROGRESS");
}
