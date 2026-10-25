/** Explicit project and identities; audit is the default and performs no writes. */
export function parseSecurityAdminArguments(args: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--apply", "--import-admins", "--all"].includes(arg)) flags.add(arg);
    else if (["--project", "--confirm-project", "--user", "--actor", "--reason", "--mode", "--operation-id"].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Value required: ${arg}`);
      values.set(arg, args[++i]);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  const projectId = values.get("--project");
  if (!["sodc-web", "sodc-web-beta", "sodc-web-production"].includes(projectId ?? "")) throw new Error("Explicit known --project required");
  const mode = values.get("--mode") ?? "audit";
  if (!["audit", "bootstrap", "disable", "enable", "repair", "release-verification", "control-create", "control-create-recovery", "control-activate", "control-recount", "grant-admin", "revoke-admin"].includes(mode)) throw new Error("Unknown security admin mode");
  if (!values.get("--user") && !flags.has("--all")) throw new Error("Select --user or --all");
  if (values.get("--user") && flags.has("--all")) throw new Error("Select only one identity scope");
  if (["disable", "enable", "release-verification", "grant-admin", "revoke-admin"].includes(mode) && flags.has("--all")) throw new Error("Account enable/disable requires one explicit --user");
  const apply = flags.has("--apply");
  if (apply && (values.get("--confirm-project") !== projectId || !values.get("--actor") || !values.get("--reason") || !values.get("--operation-id"))) throw new Error("Writes require --confirm-project, --actor, --reason and --operation-id");
  if (apply && mode === "audit") throw new Error("Audit never accepts --apply");
  return {projectId: projectId!, mode, apply, all: flags.has("--all"), userId: values.get("--user"),
    operationId: values.get("--operation-id"), importAdmins: flags.has("--import-admins"), actorId: values.get("--actor") ?? "audit", reason: values.get("--reason") ?? "audit"};
}

