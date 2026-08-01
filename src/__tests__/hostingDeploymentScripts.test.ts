import { describe, expect, it } from "vitest";
import packageJsonText from "../../package.json?raw";
import firebaseRcText from "../../.firebaserc?raw";

interface PackageJson {
  scripts: Record<string, string>;
}

interface FirebaseRc {
  projects: Record<string, string>;
}

const packageJson = JSON.parse(packageJsonText) as PackageJson;
const firebaseRc = JSON.parse(firebaseRcText) as FirebaseRc;

const deployments = {
  dev: { mode: "development", projectId: "sodc-web" },
  beta: { mode: "staging", projectId: "sodc-web-beta" },
  prod: { mode: "production", projectId: "sodc-web-production" },
} as const;

describe("environment-safe Hosting scripts", () => {
  it.each(Object.entries(deployments))(
    "builds and deploys %s with its paired Vite mode and Firebase alias",
    (alias, { mode, projectId }) => {
      expect(firebaseRc.projects[alias]).toBe(projectId);
      expect(packageJson.scripts[`build:${alias}`]).toBe(
        `tsc -b && vite build --mode ${mode}`
      );
      expect(packageJson.scripts[`deploy:hosting:${alias}`]).toBe(
        `npm run build:${alias} && firebase deploy --only hosting --project ${alias}`
      );
    }
  );

  it("does not expose a deploy command that can reuse an existing dist directory", () => {
    const hostingDeployScripts = Object.entries(packageJson.scripts).filter(([name]) =>
      name.startsWith("deploy:hosting:")
    );

    expect(hostingDeployScripts).toHaveLength(3);
    for (const [name, command] of hostingDeployScripts) {
      const alias = name.slice("deploy:hosting:".length);
      expect(command.startsWith(`npm run build:${alias} && `)).toBe(true);
    }
  });
});
