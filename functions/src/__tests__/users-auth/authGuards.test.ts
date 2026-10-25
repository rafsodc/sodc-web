import { describe, it, expect } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { requireAdmin, requireAuth, requireEnabled } from "../../helpers";

type RequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  } | null;
};

describe("auth guard helpers", async () => {
  it("requireAuth rejects unauthenticated calls", async () => {
    expect(() => requireAuth({ auth: null } as unknown as never)).toThrow(HttpsError);
    expect(() => requireAuth({} as unknown as never)).toThrow("Sign in required");
  });

  it("requireEnabled rejects users without enabled claim", async () => {
    const req: RequestLike = { auth: { uid: "u1", token: { securityVersion: 1,  enabled: false } } };
    await expect(requireEnabled(req as unknown as never)).rejects.toThrow("Account must be enabled");
  });

  it("requireEnabled rejects unauthenticated calls", async () => {
    await expect(requireEnabled({ auth: null } as unknown as never)).rejects.toThrow("Sign in required");
  });

  it("requireEnabled accepts users with enabled claim", async () => {
    const req: RequestLike = { auth: { uid: "u1", token: { enabled: true, securityVersion: 1 } } };
    await expect(requireEnabled(req as unknown as never)).resolves.toBeUndefined();
  });

  it("requireAdmin rejects non-admin calls", async () => {
    const req: RequestLike = { auth: { uid: "u1", token: { admin: false, enabled: true, securityVersion: 1 } } };
    await expect(requireAdmin(req as unknown as never)).rejects.toThrow("Admins only");
  });

  it("requireAdmin rejects a disabled caller even when the admin claim is true", async () => {
    const req: RequestLike = { auth: { uid: "u1", token: { securityVersion: 1,  admin: true, enabled: false } } };
    await expect(requireAdmin(req as unknown as never)).rejects.toThrow("Account must be enabled");
  });

  it("requireAdmin rejects an admin whose enabled claim is absent", async () => {
    const req: RequestLike = { auth: { uid: "u1", token: { securityVersion: 1,  admin: true } } };
    await expect(requireAdmin(req as unknown as never)).rejects.toThrow("Account must be enabled");
  });

  it("requireAdmin rejects unauthenticated calls", async () => {
    await expect(requireAdmin({ auth: null } as unknown as never)).rejects.toThrow("Sign in required");
  });

  it("requireAdmin accepts admin calls", async () => {
    const req: RequestLike = { auth: { uid: "u1", token: { admin: true, enabled: true, securityVersion: 1 } } };
    await expect(requireAdmin(req as unknown as never)).resolves.toBeUndefined();
  });
});
