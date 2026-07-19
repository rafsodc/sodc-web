import { describe, expect, it } from "vitest";
import firebaseConfigJson from "../../firebase.json?raw";

interface HostingHeader {
  key: string;
  value: string;
}

interface FirebaseConfig {
  hosting?: {
    headers?: Array<{
      source: string;
      headers: HostingHeader[];
    }>;
    rewrites?: Array<{ source: string }>;
  };
}

const config = JSON.parse(firebaseConfigJson) as FirebaseConfig;

const globalRule = config.hosting?.headers?.find(({ source }) => source === "**");
const headers = new Map(globalRule?.headers.map(({ key, value }) => [key.toLowerCase(), value]));

function cspDirective(name: string): string[] {
  const csp = headers.get("content-security-policy") ?? "";
  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return directive?.split(/\s+/).slice(1) ?? [];
}

describe("Firebase Hosting security headers", () => {
  it("applies the policy to static files and routes before rewrites", () => {
    expect(globalRule).toBeDefined();
    expect(config.hosting?.rewrites?.map(({ source }) => source)).toEqual(
      expect.arrayContaining(["/unsubscribe", "**"])
    );
  });

  it("sets the browser hardening headers", () => {
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("permissions-policy")).toContain("camera=()");
    expect(headers.get("permissions-policy")).toContain("microphone=()");
    expect(headers.get("permissions-policy")).toContain("payment=()");
  });

  it("locks down executable and embeddable content", () => {
    expect(cspDirective("default-src")).toEqual(["'self'"]);
    expect(cspDirective("base-uri")).toEqual(["'self'"]);
    expect(cspDirective("object-src")).toEqual(["'none'"]);
    expect(cspDirective("frame-ancestors")).toEqual(["'none'"]);
    expect(cspDirective("form-action")).toEqual(["'self'"]);
    expect(cspDirective("script-src")).not.toContain("'unsafe-inline'");
    expect(cspDirective("script-src")).not.toContain("'unsafe-eval'");
  });

  it("allows the required Firebase browser APIs in every environment", () => {
    const connectSources = cspDirective("connect-src");

    expect(connectSources).toEqual(
      expect.arrayContaining([
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://firebaseappcheck.googleapis.com",
        "https://firebaseinstallations.googleapis.com",
        "https://firebase.googleapis.com",
        "https://firebasedataconnect.googleapis.com",
        "https://europe-west2-sodc-web.cloudfunctions.net",
        "https://europe-west2-sodc-web-beta.cloudfunctions.net",
        "https://europe-west2-sodc-web-production.cloudfunctions.net",
      ])
    );
  });

  it("allows the documented reCAPTCHA and Firebase Auth frames", () => {
    expect(cspDirective("script-src")).toEqual(
      expect.arrayContaining([
        "https://www.google.com/recaptcha/",
        "https://www.gstatic.com/recaptcha/",
      ])
    );
    expect(cspDirective("frame-src")).toEqual(
      expect.arrayContaining([
        "https://sodc-web.firebaseapp.com",
        "https://sodc-web-beta.firebaseapp.com",
        "https://sodc-web-production.firebaseapp.com",
        "https://www.google.com/recaptcha/",
        "https://recaptcha.google.com/recaptcha/",
      ])
    );
  });

  it("leaves HSTS under Firebase control for the default Hosting domains", () => {
    expect(headers.has("strict-transport-security")).toBe(false);
  });
});
