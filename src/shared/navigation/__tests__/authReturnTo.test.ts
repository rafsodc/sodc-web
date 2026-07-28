import { describe, expect, it } from "vitest";
import { accountSignInPath, safeReturnTo } from "../authReturnTo";

describe("auth return targets", () => {
  it("preserves an internal file route including query and hash", () => {
    expect(
      safeReturnTo("?returnTo=%2Fsections%2Fsection-1%2Ffiles%2Ffile-1%3Fdownload%3D1%23file"),
    ).toBe("/sections/section-1/files/file-1?download=1#file");
  });

  it.each([
    "https://evil.example/file",
    "//evil.example/file",
    "/\\evil.example/file",
    "/account",
  ])("rejects unsafe target %s", (target) => {
    expect(safeReturnTo(`?returnTo=${encodeURIComponent(target)}`)).toBeNull();
  });

  it("builds a sign-in URL with an encoded internal return target", () => {
    expect(accountSignInPath("/sections/a/files/b")).toBe(
      "/account?returnTo=%2Fsections%2Fa%2Ffiles%2Fb",
    );
  });
});
