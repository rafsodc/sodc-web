import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { access, lstat, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createHostingSnapshot,
  makeImmutableHostingConfig,
} from "./hosting-cache-config.mjs";
import { deployHosting } from "./deploy-hosting.mjs";

const gitSha = "a".repeat(40);
const currentAssets = [
  "/assets/index-Ab12Cd_3.js",
  "/assets/PageContainer-Zx98-_Q2.css",
];
const directories = [];

function baseHosting() {
  return {
    public: "dist",
    ignore: ["firebase.json", "**/.*", "**/node_modules/**", "**/ignored-*.js"],
    headers: [
      { source: "**", headers: [{ key: "Content-Security-Policy", value: "default-src 'self'" }] },
      { source: "!/@(assets)/**", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/index.html", headers: [{ key: "X-HTML-Policy", value: "retained" }] },
    ],
    rewrites: [
      { source: "/unsubscribe", function: "unsubscribeAnnouncement", region: "europe-west2" },
      { source: "!/@(assets)/**", destination: "/index.html" },
    ],
  };
}

function immutableRules(hosting) {
  return hosting.headers.filter((rule) => rule.headers.some((header) =>
    header.key.toLowerCase() === "cache-control" && /\bimmutable\b/i.test(header.value),
  ));
}

async function writeJson(file, value) {
  await writeFile(file, JSON.stringify(value, null, 2));
}

async function fixture(environment = "dev") {
  const root = await mkdtemp(path.join(tmpdir(), "sodc-hosting-cache-test-"));
  directories.push(root);
  await mkdir(path.join(root, "dist/assets"), { recursive: true });
  const firebaseRc = '{\n  "projects": { "dev": "sodc-web", "beta": "sodc-web-beta", "prod": "sodc-web-production" }\n}\n';
  await writeFile(path.join(root, ".firebaserc"), firebaseRc);
  await writeJson(path.join(root, "firebase.json"), {
    hosting: baseHosting(),
    functions: [{ source: "functions", predeploy: ["must not be copied"] }],
    dataconnect: { source: "dataconnect" },
    storage: { rules: "storage.rules" },
  });
  await writeJson(path.join(root, "dist/deployment-manifest.json"), {
    schemaVersion: "sodc-deployment-manifest/v1",
    environment,
    gitSha,
  });
  for (const [name, content] of Object.entries({
    "index.html": "<html>original entry</html>",
    "assets/index-Ab12Cd_3.js": "original entry javascript",
    "assets/PageContainer-Zx98-_Q2.css": "original stylesheet",
    "assets/runtime.js": "unhashed javascript",
    "assets/index-Ab12Cd_3.js.map": "source map",
    "assets/ignored-A1b2C3d4.js": "ignored javascript",
    "assets/view-A1b2C3d4.html": "asset html",
    "favicon.ico": "icon",
  })) {
    await writeFile(path.join(root, "dist", name), content);
  }
  return { root, firebaseRc };
}

async function snapshot(root, options = {}) {
  const result = await createHostingSnapshot(root, { environment: "dev", gitSha, ...options });
  directories.push(result.directory);
  return result;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("release-specific immutable Hosting headers", () => {
  it("clones the Hosting configuration and retains global, HTML and rewrite policies", () => {
    const original = baseHosting();
    const before = structuredClone(original);
    const result = makeImmutableHostingConfig(original, currentAssets, "/tmp/frozen-public");

    expect(original).toEqual(before);
    expect(result).not.toBe(original);
    expect(result.public).toBe("/tmp/frozen-public");
    expect(result.ignore).toEqual(original.ignore);
    expect(result.rewrites).toEqual(original.rewrites);
    expect(result.headers.slice(0, original.headers.length)).toEqual(original.headers);
    result.headers[0].headers[0].value = "changed snapshot policy";
    expect(original.headers[0].headers[0].value).toBe("default-src 'self'");
  });

  it("grants one year only to literal current-build JS and CSS paths", () => {
    const result = makeImmutableHostingConfig(baseHosting(), [...currentAssets, currentAssets[0]], "/tmp/frozen-public");
    const rules = immutableRules(result);
    const allCacheGrants = result.headers.filter((rule) => rule.headers.some((header) =>
      header.key.toLowerCase() === "cache-control" && /\b(?:s-maxage|max-age)\s*=\s*[1-9]\d*/i.test(header.value),
    ));

    expect(rules.map((rule) => rule.source).sort()).toEqual([...currentAssets].sort());
    expect(allCacheGrants.map((rule) => rule.source).sort()).toEqual([...currentAssets].sort());
    for (const rule of rules) {
      expect(rule.source).not.toMatch(/[*?{}()!\\]/);
      expect(rule.regex).toBeUndefined();
      const cache = rule.headers.find((header) => header.key.toLowerCase() === "cache-control");
      expect(cache.value).toMatch(/\bpublic\b/i);
      expect(cache.value).toMatch(/\bmax-age\s*=\s*31536000\b/i);
    }
    for (const excluded of [
      "/assets/index-OldHash1.js", "/assets/unknown-NewHash1.js", "/assets/runtime.js",
      "/index.html", "/deployment-manifest.json", "/assets/index-Ab12Cd_3.js.map",
    ]) {
      expect(rules.some((rule) => rule.source === excluded)).toBe(false);
    }
  });

  it("does not grant immutable caching to fingerprinted files excluded by Hosting ignore", () => {
    const ignoredAsset = "/assets/ignored-A1b2C3d4.js";
    const result = makeImmutableHostingConfig(baseHosting(), [...currentAssets, ignoredAsset], "/tmp/frozen-public");

    expect(immutableRules(result).map((rule) => rule.source).sort()).toEqual([...currentAssets].sort());
    expect(() => makeImmutableHostingConfig(baseHosting(), [ignoredAsset], "/tmp/frozen-public")).toThrow();
  });

  it("refuses existing immutable rules instead of carrying a previous release's cache grant forward", () => {
    const hosting = baseHosting();
    hosting.headers.push({
      source: "/assets/previous-OldHash1.js",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    });

    expect(() => makeImmutableHostingConfig(hosting, currentAssets, "/tmp/frozen-public")).toThrow();
  });

  it.each([
    "/assets/*.js", "/assets/index.js", "/assets/index-1234567.js", "/assets/index-123456789.js",
    "/assets/nested/index-Ab12Cd_3.js", "/assets/index-Ab12Cd_3.js.map", "/assets/index-Ab12Cd_3.html",
    "/assets/../index-Ab12Cd_3.js", "/index.html",
  ])("refuses an unsafe or non-fingerprinted immutable path: %s", (assetPath) => {
    expect(() => makeImmutableHostingConfig(baseHosting(), [assetPath], "/tmp/frozen-public")).toThrow();
  });
});

describe("immutable Hosting deployment snapshot", () => {
  it("copies a bound build and emits Hosting-only configuration with exact eligible asset rules", async () => {
    const { root, firebaseRc } = await fixture();
    await mkdir(path.join(root, "dist/assets/nested"));
    await writeFile(path.join(root, "dist/assets/nested/chunk-Ab12Cd_3.js"), "nested javascript");
    const result = await snapshot(root);
    const config = JSON.parse(await readFile(result.configPath, "utf8"));

    expect(Object.keys(config)).toEqual(["hosting"]);
    expect(result.publicDirectory).toBe(path.join(result.directory, "public"));
    expect(config.hosting.public).toBe(result.publicDirectory);
    expect(path.isAbsolute(config.hosting.public)).toBe(true);
    expect(result.assetPaths.slice().sort()).toEqual([...currentAssets].sort());
    expect(immutableRules(config.hosting).map((rule) => rule.source).sort()).toEqual([...currentAssets].sort());
    expect(await readFile(path.join(result.directory, ".firebaserc"), "utf8")).toBe(firebaseRc);
    expect(config.hosting.rewrites).toEqual(baseHosting().rewrites);
    expect(config.hosting.headers.slice(0, baseHosting().headers.length)).toEqual(baseHosting().headers);
    expect((await lstat(path.join(result.publicDirectory, "assets/index-Ab12Cd_3.js"))).isSymbolicLink()).toBe(false);
  });

  it("keeps copied bytes, manifest and cache rules frozen when dist and repository config change", async () => {
    const { root } = await fixture();
    const result = await snapshot(root);
    const configBefore = await readFile(result.configPath, "utf8");
    const manifestBefore = await readFile(path.join(result.publicDirectory, "deployment-manifest.json"), "utf8");

    await writeFile(path.join(root, "dist/assets/index-Ab12Cd_3.js"), "replacement bytes under old name");
    await rm(path.join(root, "dist/assets/PageContainer-Zx98-_Q2.css"));
    await writeFile(path.join(root, "dist/assets/newest-NewHash1.js"), "later build");
    await writeFile(path.join(root, "dist/index.html"), "replacement html");
    await writeJson(path.join(root, "dist/deployment-manifest.json"), { environment: "prod", gitSha: "b".repeat(40) });
    await writeJson(path.join(root, "firebase.json"), { hosting: { public: "elsewhere" } });

    expect(await readFile(path.join(result.publicDirectory, "assets/index-Ab12Cd_3.js"), "utf8")).toBe("original entry javascript");
    expect(await readFile(path.join(result.publicDirectory, "assets/PageContainer-Zx98-_Q2.css"), "utf8")).toBe("original stylesheet");
    expect(await readFile(path.join(result.publicDirectory, "index.html"), "utf8")).toBe("<html>original entry</html>");
    expect(await readFile(path.join(result.publicDirectory, "deployment-manifest.json"), "utf8")).toBe(manifestBefore);
    expect(await readFile(result.configPath, "utf8")).toBe(configBefore);
    await expect(access(path.join(result.publicDirectory, "assets/newest-NewHash1.js"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it.each([
    ["unknown deployment environment", async () => {}, { environment: "qa" }],
    ["manifest environment mismatch", async (root) => {
      await writeJson(path.join(root, "dist/deployment-manifest.json"), { schemaVersion: "sodc-deployment-manifest/v1", environment: "prod", gitSha });
    }],
    ["manifest revision mismatch", async (root) => {
      await writeJson(path.join(root, "dist/deployment-manifest.json"), { schemaVersion: "sodc-deployment-manifest/v1", environment: "dev", gitSha: "b".repeat(40) });
    }],
    ["wrong Firebase project alias", async (root) => {
      await writeJson(path.join(root, ".firebaserc"), { projects: { dev: "sodc-web-production" } });
    }],
    ["missing Firebase project alias", async (root) => {
      await writeJson(path.join(root, ".firebaserc"), { projects: {} });
    }],
    ["missing deployment manifest", async (root) => {
      await rm(path.join(root, "dist/deployment-manifest.json"));
    }],
    ["missing build directory", async (root) => {
      await rm(path.join(root, "dist"), { recursive: true });
    }],
    ["no eligible non-ignored fingerprinted assets", async (root) => {
      await Promise.all(currentAssets.map((asset) => rm(path.join(root, "dist", asset.slice(1)))));
    }],
  ])("refuses %s before producing a deployable snapshot", async (_label, change, options) => {
    const { root } = await fixture();
    await change(root);
    await expect(snapshot(root, options)).rejects.toThrow();
  });

  it.each(["file", "directory", "public-root"])("rejects a symbolic-link %s in the deployment input", async (kind) => {
    const { root } = await fixture();
    if (kind === "file") {
      await symlink(path.join(root, "dist/index.html"), path.join(root, "dist/assets/linked-Ab12Cd_3.js"));
    } else if (kind === "directory") {
      await symlink(path.join(root, "dist/assets"), path.join(root, "dist/linked-assets"), "dir");
    } else {
      await rename(path.join(root, "dist"), path.join(root, "outside-public"));
      await symlink(path.join(root, "outside-public"), path.join(root, "dist"), "dir");
    }
    await expect(snapshot(root)).rejects.toThrow();
  });

  it("allows the caller to remove the complete temporary snapshot", async () => {
    const { root } = await fixture();
    const result = await snapshot(root);
    await access(result.configPath);
    await result.remove();
    await expect(access(result.directory)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(root, "dist/assets/index-Ab12Cd_3.js"), "utf8")).toBe("original entry javascript");
  });
});

describe("Hosting-only deployment runner", () => {
  const projects = { dev: "sodc-web", beta: "sodc-web-beta", prod: "sodc-web-production" };

  it.each(Object.entries(projects).flatMap(([environment, projectId]) => [
    [environment, projectId, false],
    [environment, projectId, true],
  ]))("scopes %s to %s and removes its snapshot when deployment failure is %s", async (environment, projectId, fail) => {
    const { root } = await fixture(environment);
    const commands = [];
    let configPath;
    const execute = (command, args, cwd) => {
      commands.push(command);
      expect(cwd).toBe(root);
      if (command === "git") {
        expect(args).toEqual(["rev-parse", "HEAD"]);
        return `${gitSha}\n`;
      }
      expect(command).toBe("firebase");
      expect(args[0]).toBe("deploy");
      expect(args).toContain("--only");
      expect(args[args.indexOf("--only") + 1]).toBe("hosting");
      expect(args).toContain("--project");
      expect(args[args.indexOf("--project") + 1]).toBe(projectId);
      expect(args).toContain("--non-interactive");
      expect(args).toContain("--config");
      configPath = args[args.indexOf("--config") + 1];
      directories.push(path.dirname(configPath));
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      expect(Object.keys(config)).toEqual(["hosting"]);
      expect(readFileSync(path.join(config.hosting.public, "assets/index-Ab12Cd_3.js"), "utf8")).toBe("original entry javascript");
      if (fail) throw new Error("fixture deploy rejection");
      return "fixture deploy completed";
    };

    const deployment = deployHosting(root, environment, execute);
    if (fail) await expect(deployment).rejects.toThrow("fixture deploy rejection");
    else await deployment;

    expect(commands).toEqual(["git", "firebase"]);
    await expect(access(path.dirname(configPath))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(root, "dist/assets/index-Ab12Cd_3.js"), "utf8")).toBe("original entry javascript");
  });

  it("refuses stale dist before invoking the Firebase executor", async () => {
    const { root } = await fixture();
    const commands = [];
    const execute = (command, args) => {
      commands.push(command);
      expect(command).toBe("git");
      expect(args).toEqual(["rev-parse", "HEAD"]);
      return `${"b".repeat(40)}\n`;
    };

    await expect(deployHosting(root, "dev", execute)).rejects.toThrow(/manifest|revision|rebuild/i);
    expect(commands).toEqual(["git"]);
  });
});
