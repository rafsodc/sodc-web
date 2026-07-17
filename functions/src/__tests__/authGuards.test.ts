import { describe, it, expect } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { requireAdmin, requireAuth, requireEnabled } from "../helpers";

type RequestLike = {
  auth?: {
    uid: string;
    token: Record<string, unknown>;
  } | null;
};

describe("auth guard helpers", () => {
  it("requireAuth rejects unauthenticated calls", () => {
    expect(() => requireAuth({ auth: null } as unknown as never)).toThrow(HttpsError);
    expect(() => requireAuth({} as unknown as never)).toThrow("Sign in required");
  });

  it("requireEnabled rejects users without enabled claim", () => {
    const req: RequestLike = { auth: { uid: "u1", token: { enabled: false } } };
    expect(() => requireEnabled(req as unknown as never)).toThrow("Account must be enabled");
  });

  it("requireEnabled rejects unauthenticated calls", () => {
    expect(() => requireEnabled({ auth: null } as unknown as never)).toThrow("Sign in required");
  });

  it("requireEnabled accepts users with enabled claim", () => {
    const req: RequestLike = { auth: { uid: "u1", token: { enabled: true } } };
    expect(() => requireEnabled(req as unknown as never)).not.toThrow();
  });

  it("requireAdmin rejects non-admin calls", () => {
    const req: RequestLike = { auth: { uid: "u1", token: { admin: false, enabled: true } } };
    expect(() => requireAdmin(req as unknown as never)).toThrow("Admins only");
  });

  it("requireAdmin rejects a disabled caller even when the admin claim is true", () => {
    const req: RequestLike = { auth: { uid: "u1", token: { admin: true, enabled: false } } };
    expect(() => requireAdmin(req as unknown as never)).toThrow("Account must be enabled");
  });

  it("requireAdmin rejects an admin whose enabled claim is absent", () => {
    const req: RequestLike = { auth: { uid: "u1", token: { admin: true } } };
    expect(() => requireAdmin(req as unknown as never)).toThrow("Account must be enabled");
  });

  it("requireAdmin rejects unauthenticated calls", () => {
    expect(() => requireAdmin({ auth: null } as unknown as never)).toThrow("Sign in required");
  });

  it("requireAdmin accepts admin calls", () => {
    const req: RequestLike = { auth: { uid: "u1", token: { admin: true, enabled: true } } };
    expect(() => requireAdmin(req as unknown as never)).not.toThrow();
  });
});
