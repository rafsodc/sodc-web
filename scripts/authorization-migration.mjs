#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {lstat, readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {tmpdir} from "node:os";
import {
  MIGRATION_PHASES, MigrationError, assertMigrationEnvironment, assertNode24, assertNoCredentials,
  assertProject, createMigrationPlan, executeMigrationPhase, loadMigrationRun, migrationHash,
  migrationRunDirectory, phasesFor, prepareMigrationRun, recordMigrationGate, summarizeRun, unlockMigrationRun,
} from "./authorization-migration-state.mjs";

const repositoryDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const gates = new Set(["backup", "freeze-scope", "sql-review", "acceptance"]);
const allowed = Object.freeze({
  plan: ["project", "installation"],
  prepare: ["project", "run-id", "operator", "reason", "installation", "artifact-directory", "import-admins"],
  status: ["project", "run-id"],
  audit: ["project", "run-id"],
  gate: ["project", "run-id", "name", "evidence"],
  apply: ["project", "run-id", "phase", "confirm-project"],
  unlock: ["project", "run-id", "reason"],
});
const required = Object.freeze({
  plan: ["project"],
  prepare: ["project", "run-id", "operator", "reason", "installation", "artifact-directory"],
  status: ["project", "run-id"],
  audit: ["project"],
  gate: ["project", "run-id", "name", "evidence"],
  apply: ["project", "run-id", "phase", "confirm-project"],
  unlock: ["project", "run-id", "reason"],
});
const fail = (code, message) => {throw new MigrationError(code, message);};

export function parseMigrationArguments(argv) {
  if (!Array.isArray(argv) || !argv.every(value => typeof value === "string")) fail("ARGUMENTS_INVALID", "Use structured command arguments.");
  if (!argv.length || (argv.length === 1 && ["--help", "-h"].includes(argv[0]))) return {command: "help", flags: {}};
  const [command, ...args] = argv;
  if (!Object.hasOwn(allowed, command)) fail("COMMAND_INVALID", "Choose a documented migration command.");
  const flags = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (!argument.startsWith("--") || !allowed[command].includes(argument.slice(2))) fail("FLAG_INVALID", "Unknown or unsupported migration flag.");
    const key = argument.slice(2);
    if (Object.hasOwn(flags, key)) fail("FLAG_DUPLICATE", "Migration flags must not be repeated.");
    if (key === "import-admins") flags[key] = true;
    else {
      const value = args[++index];
      if (!value?.trim() || value.startsWith("--")) fail("FLAG_VALUE_REQUIRED", "Every selected flag requires its value.");
      flags[key] = value;
    }
  }
  if (!required[command].every(key => Object.hasOwn(flags, key))) fail("FLAGS_REQUIRED", "Required migration flags are missing.");
  assertProject(flags.project);
  if (flags["run-id"] !== undefined && !/^[a-z0-9][a-z0-9-]{2,47}$/.test(flags["run-id"])) fail("RUN_ID_INVALID", "Use a valid lowercase migration run ID.");
  if (flags.installation !== undefined && !["legacy", "strict"].includes(flags.installation)) fail("INSTALLATION_REQUIRED", "Select legacy or strict explicitly.");
  if (flags["artifact-directory"] !== undefined && !path.isAbsolute(flags["artifact-directory"])) fail("ARTIFACT_PATH_REQUIRED", "Use an absolute artifact directory outside the checkout.");
  if (command === "gate" && !gates.has(flags.name)) fail("GATE_INVALID", "Choose a documented operator gate.");
  if (command === "apply") {
    if (!MIGRATION_PHASES.includes(flags.phase)) fail("PHASE_INVALID", "Choose one documented migration phase.");
    if (flags["confirm-project"] !== flags.project) fail("CONFIRM_PROJECT_REQUIRED", "Repeat the exact project ID in --confirm-project.");
  }
  return {command, flags};
}

async function gitDefault(args, {cwd}) {
  try {return (await execFileAsync("git", args, {cwd, encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 15_000, shell: false})).stdout;}
  catch {fail("SOURCE_INSPECTION_FAILED", "Could not verify the reviewed checkout.");}
}
async function reviewedSource(repositoryRoot, git, expectedSha) {
  const gitSha = (await git(["rev-parse", "HEAD"], {cwd: repositoryRoot})).trim();
  if (!/^[a-f0-9]{40}$/.test(gitSha)) fail("REVISION_REQUIRED", "A full reviewed Git commit is required.");
  if (expectedSha !== undefined && gitSha !== expectedSha) fail("REVISION_CHANGED", "Return to the exact reviewed run revision before continuing.");
  const status = await git(["status", "--porcelain", "--untracked-files=all"], {cwd: repositoryRoot});
  if (status.trim()) fail("CHECKOUT_DIRTY", "Commit and review source changes before preparing or executing a migration.");
  return gitSha;
}
async function cloudAdapterDefault(options) {
  const {createCloudMigrationAdapter} = await import("./authorization-migration-cloud.mjs");
  return createCloudMigrationAdapter(options);
}
async function evidenceFile(filename, repositoryRoot) {
  const target = path.resolve(repositoryRoot, filename);
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024) fail("GATE_FILE_INVALID", "Use a regular structured gate evidence file within the size limit.");
  let record;
  try {record = JSON.parse(await readFile(target, "utf8"));}
  catch {fail("GATE_FILE_INVALID", "Gate evidence must be a structured JSON document.");}
  assertNoCredentials(record);
  return record;
}
function auditSummary(observation, plan, persistedRun) {
  if (observation?.projectId !== plan.projectId || observation.gitSha !== plan.gitSha) fail("OBSERVATION_INVALID", "Audit must describe the selected project and reviewed revision.");
  const authority = observation.authority;
  const result = {
    schemaVersion: "sodc-authorization-migration-audit-summary/v1", readOnly: true,
    projectId: plan.projectId, gitSha: plan.gitSha, runId: persistedRun ? plan.runId : null,
    observedAt: observation.observedAt ?? null, installation: observation.installation ?? "unknown",
    sources: ["schema", "api", "authorization"].map(name => ({name, present: Boolean(observation[name]),
      updateTime: observation[name]?.updateTime ?? null,
      sourceHash: observation[name]?.files ? migrationHash(observation[name].files) : null})),
    functions: {count: observation.functions?.length ?? 0,
      notActive: (observation.functions ?? []).filter(fn => fn.state !== "ACTIVE").map(fn => fn.name)},
    databaseProtection: observation.databaseProtection ? {
      instance: observation.databaseProtection.instance, state: observation.databaseProtection.state, region: observation.databaseProtection.region,
      automatedBackups: observation.databaseProtection.automatedBackups === true,
      pointInTimeRecovery: observation.databaseProtection.pointInTimeRecovery === true,
      deletionProtection: observation.databaseProtection.deletionProtection === true,
    } : null,
    schedulers: (observation.jobs ?? []).map(job => ({name: job.name, state: job.state})),
    authority: authority ? {passed: authority.passed ?? false, counts: authority.counts ?? {},
      backfillComplete: authority.backfillComplete ?? false, controlReady: authority.controlReady ?? false,
      control: authority.control ? {status: authority.control.status, version: authority.control.version,
        readyAdminCount: authority.control.readyAdminCount} : null} : null,
    limitation: "Read-only provider observations; this summary does not attest migration completion or release acceptance.",
  };
  assertNoCredentials(result);
  return result;
}

/** All cloud loading is injected/lazy. Offline commands never construct a provider adapter. */
export async function runMigrationCli(argv, {
  repositoryRoot = repositoryDirectory, nodeVersion = process.versions.node, env = process.env,
  git = gitDefault, loadAdapter = cloudAdapterDefault, now = () => new Date(),
} = {}) {
  const {command, flags} = parseMigrationArguments(argv);
  if (command === "help") return {usage: "npm run authorization:migrate -- <plan|prepare|status|audit|gate|apply|unlock> --project <literal-project-id> [command flags]",
    guide: "docs/operations/authorization-migration-tool.md", cloudChanges: false};
  const projectId = flags.project;
  if (command === "plan") return {schemaVersion: "sodc-authorization-migration-outline/v1", projectId,
    environment: assertProject(projectId), installation: flags.installation ?? "unclassified", offline: true,
    phases: MIGRATION_PHASES.filter(phase => phase !== "compatibility" || flags.installation !== "strict").map(phase => ({phase,
      condition: phase === "compatibility" ? "legacy installations only" : "verified prerequisites required"})),
    limitation: "Planning does not inspect or change the target project; prepare requires a reviewed installation choice."};
  const options = {repositoryRoot, projectId, runId: flags["run-id"]};
  if (command === "status") return {...summarizeRun(await loadMigrationRun(options)), offline: true,
    limitation: "Local journal only; audit the live target before resuming."};
  assertNode24(nodeVersion);
  assertMigrationEnvironment(projectId, env);
  if (command === "prepare") {
    const gitSha = await reviewedSource(repositoryRoot, git);
    const plan = createMigrationPlan({projectId, runId: options.runId, gitSha, operator: flags.operator, reason: flags.reason,
      installation: flags.installation, artifactDirectory: flags["artifact-directory"], importAdmins: flags["import-admins"] === true, now: now()});
    const prepared = await prepareMigrationRun({repositoryRoot, plan});
    return {prepared: true, offline: true, projectId, runId: plan.runId, gitSha, installation: plan.installation,
      importAdmins: plan.importAdmins, directory: prepared.directory, planHash: prepared.planHash,
      cloudChanges: false, next: "Review the run and authorize live inspection separately."};
  }
  if (command === "unlock") {
    await unlockMigrationRun(options, flags.reason);
    return {projectId, runId: options.runId, staleLockRemoved: true, cloudChanges: false};
  }
  if (command === "gate") {
    const run = await loadMigrationRun(options);
    await reviewedSource(repositoryRoot, git, run.plan.gitSha);
    const gate = await evidenceFile(flags.evidence, repositoryRoot);
    if (gate.gate !== flags.name) fail("GATE_NAME_MISMATCH", "The evidence gate must match --name.");
    const recorded = await recordMigrationGate(options, gate, now());
    return {projectId, runId: options.runId, ...recorded, cloudChanges: false,
      limitation: "Recorded operator review; live phase verification remains required."};
  }
  const run = options.runId ? await loadMigrationRun(options) : null;
  if (command === "apply" && !phasesFor(run.plan).includes(flags.phase)) fail("PHASE_INVALID", "Compatibility cannot run against an already strict installation.");
  const gitSha = await reviewedSource(repositoryRoot, git, run?.plan.gitSha);
  const runDirectory = run?.directory ?? path.join(repositoryRoot, ".firebase/authorization-migration/runs", projectId, "read-only-audit");
  const plan = run?.plan ?? createMigrationPlan({projectId, gitSha, runId: "read-only-audit", operator: "read-only-audit",
    reason: "Read-only provider inspection; this does not authorize migration.", installation: "strict",
    artifactDirectory: path.join(tmpdir(), "sodc-authorization-read-only-audit"), now: now()});
  const adapter = await loadAdapter({repositoryRoot, runDirectory, plan, now});
  try {
    if (command === "audit") return auditSummary(await adapter.observe(), plan, Boolean(run));
    // Parsing guarantees exactly one explicit phase and matching target confirmation.
    const outcome = await executeMigrationPhase(options, {phase: flags.phase, confirmProject: flags["confirm-project"], adapter,
      sourceCheck: checkedPlan => reviewedSource(repositoryRoot, git, checkedPlan.gitSha), now});
    return {projectId, runId: plan.runId, gitSha, phase: outcome.phase, status: outcome.status,
      observedAt: outcome.evidence?.observedAt ?? null, directory: migrationRunDirectory(repositoryRoot, projectId, plan.runId),
      limitation: "Only the requested phase ran; review its evidence before continuing."};
  } finally {await adapter.close?.();}
}

export function safeMigrationCliError(error) {
  const code = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{2,80}$/.test(error.code) ? error.code : "MIGRATION_COMMAND_FAILED";
  return {failed: true, code, message: "Migration command stopped. Inspect the local run and documented prerequisites; no automatic rollback or unfreeze was attempted."};
}
async function main() {
  try {console.log(JSON.stringify(await runMigrationCli(process.argv.slice(2)), null, 2));}
  catch (error) {console.error(JSON.stringify(safeMigrationCliError(error))); process.exitCode = 1;}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
