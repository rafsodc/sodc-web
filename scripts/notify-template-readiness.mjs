#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { createReport, emitReport, exitCodeFor, parseJsonOutput, resolveTarget, result } from "./deployment-check-lib.mjs";
import { checkNotifyTemplateReadiness, readNotifyTemplateBindings, validTemplateReadinessContract } from "./notify-template-readiness-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execute = promisify(execFile);
const help = "Usage: npm run deployment:template-readiness -- --env <dev|beta|prod> [--json] [--out <path>]\nRead-only template ID configuration audit. No secret values, Notify calls, sends or repairs.";

export async function runTemplateReadinessAudit(repositoryRoot, environment, provider) {
  const json = async (file) => JSON.parse(await readFile(path.join(repositoryRoot, file), "utf8"));
  const [rc, configuration, contract] = await Promise.all([
    json(".firebaserc"), json("config/deployment-check.json"), json("config/notify-template-readiness.json"),
  ]);
  const target = resolveTarget(rc, configuration, environment);
  if (!validTemplateReadinessContract(contract)) throw new Error("invalid-template-contract");
  async function run(args) {
    const { stdout } = await execute("gcloud", args, { cwd: repositoryRoot, encoding: "utf8", timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024, env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" } });
    return stdout;
  }
  let token;
  const accessToken = async () => token ??= (await run(["auth", "print-access-token"])).trim();
  const source = provider ?? {
    functions: async () => parseJsonOutput(await run(["functions", "list", "--v2", `--regions=${target.region}`,
      "--project", target.projectId, "--format=json"])),
    bindings: () => readNotifyTemplateBindings({ projectId: target.projectId, region: target.region,
      service: configuration.dataConnect.service, accessToken }),
  };
  let outcome;
  try {
    const functions = await source.functions();
    outcome = await checkNotifyTemplateReadiness({ contract, functions, loadBindings: () => source.bindings() });
  } catch {
    outcome = { status: "fail", summary: "Transactional template readiness audit could not read the target Function metadata.",
      details: { reason: "functions-metadata-read-failed" } };
  }
  return createReport(target, [result("gov-notify-template-readiness", outcome.status, outcome.summary, outcome.details)]);
}

async function main() {
  let options;
  try {
    const parsed = parseArgs({ options: { env: { type: "string" }, json: { type: "boolean", default: false },
      out: { type: "string" }, help: { type: "boolean", default: false } } });
    options = parsed.values;
    if (options.help) { console.log(help); return; }
    if (!["dev", "beta", "prod"].includes(options.env)) throw new Error();
  } catch {
    console.error(help); process.exitCode = 2; return;
  }
  try {
    const report = await runTemplateReadinessAudit(root, options.env);
    await emitReport(report, options);
    process.exitCode = exitCodeFor(report.results);
  } catch {
    console.error("Template readiness audit stopped: invalid local configuration or unavailable output file.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
