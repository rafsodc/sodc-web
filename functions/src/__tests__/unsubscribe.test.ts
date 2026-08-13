import { describe, expect, it, vi } from "vitest";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import {
  handleUnsubscribeRequest,
  signUnsubscribeToken,
} from "../unsubscribe";

const SECRET = "unsubscribe-secret-that-is-long-enough";

function token(overrides: Partial<{
  userId: string;
  sectionId: string;
  sectionName: string;
  exp: number;
}> = {}): string {
  return signUnsubscribeToken({
    userId: "user-1",
    sectionId: "section-1",
    sectionName: "Signals & Cyber",
    exp: Date.now() + 60_000,
    ...overrides,
  }, SECRET);
}

function request(overrides: Partial<{
  method: string;
  query: Record<string, unknown>;
  body: Record<string, unknown>;
}> = {}): Request {
  return {
    method: "GET",
    query: { token: token() },
    body: {},
    ...overrides,
  } as unknown as Request;
}

function response(): Response {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    type: vi.fn(),
    send: vi.fn(),
    redirect: vi.fn(),
  } as unknown as Response;
  for (const method of ["status", "type"] as const) {
    (res[method] as ReturnType<typeof vi.fn>).mockReturnValue(res);
  }
  return res;
}

describe("unsubscribeAnnouncement", () => {
  it("renders confirmation for a valid GET without changing preferences", async () => {
    const optOut = vi.fn();
    const res = response();

    await handleUnsubscribeRequest(request(), res, SECRET, { optOut });

    expect(optOut).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Confirm unsubscribe"));
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
  });

  it("keeps an automated link-scanner GET side-effect-free", async () => {
    const optOut = vi.fn();
    const res = response();

    await handleUnsubscribeRequest(request({ method: "GET" }), res, SECRET, { optOut });

    expect(optOut).not.toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("processes an RFC 8058 one-click POST", async () => {
    const optOut = vi.fn().mockResolvedValue(undefined);
    const res = response();

    await handleUnsubscribeRequest(request({ method: "POST" }), res, SECRET, { optOut });

    expect(optOut).toHaveBeenCalledWith({ userId: "user-1", sectionId: "section-1" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith("OK");
  });

  it("processes browser confirmation and redirects to a token-free URL", async () => {
    const optOut = vi.fn().mockResolvedValue(undefined);
    const res = response();
    const signedToken = token();

    await handleUnsubscribeRequest(request({
      method: "POST",
      query: {},
      body: { token: signedToken, browserConfirmation: "1" },
    }), res, SECRET, { optOut });

    expect(optOut).toHaveBeenCalledOnce();
    expect(res.redirect).toHaveBeenCalledWith(
      303,
      "http://localhost:5173/unsubscribe/confirmed?section=Signals+%26+Cyber"
    );
    expect(String((res.redirect as ReturnType<typeof vi.fn>).mock.calls[0]?.[1])).not.toContain(signedToken);
  });

  it("rejects unsupported methods without changing preferences", async () => {
    const optOut = vi.fn();
    const res = response();

    await handleUnsubscribeRequest(request({ method: "PUT" }), res, SECRET, { optOut });

    expect(optOut).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it.each([
    ["missing", request({ query: {} })],
    ["invalid", request({ query: { token: "not-a-valid-token" } })],
    ["expired", request({ query: { token: token({ exp: Date.now() - 1 }) } })],
  ])("rejects a %s token without changing preferences", async (_label, req) => {
    const optOut = vi.fn();
    const res = response();

    await handleUnsubscribeRequest(req, res, SECRET, { optOut });

    expect(optOut).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("escapes section names rendered into the confirmation page", async () => {
    const res = response();

    await handleUnsubscribeRequest(request({
      query: { token: token({ sectionName: "<script>alert(\"x\")</script>" }) },
    }), res, SECRET, { optOut: vi.fn() });

    const html = String((res.send as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
