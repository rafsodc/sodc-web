import { describe, expect, it } from "vitest";
import firebaseConfigurationSource from "../config/firebase.ts?raw";

describe("Firebase App Check provider", () => {
  it("uses the Fraud Defense score-key provider", () => {
    expect(firebaseConfigurationSource).toContain("ReCaptchaEnterpriseProvider");
    expect(firebaseConfigurationSource).not.toContain("ReCaptchaV3Provider");
  });
});
