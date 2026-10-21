/** Explicit project and identities; audit is the default and performs no writes. */
export function parseSecurityAdminArguments(args: string[]) {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (["--apply", "--import-admins", "--all"].includes(arg)) flags.add(arg);
    else if (["--project", "--confirm-project", "--user", "--actor", "--reason", "--mode"].includes(arg)) {
      if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error(`Value required: ${arg}`);
      values.set(arg, args[++i]);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  const projectId = values.get("--project");
  if (!["sodc-web", "sodc-web-beta", "sodc-web-production"].includes(projectId ?? "")) throw new Error("Explicit known --project required");
  const mode = values.get("--mode") ?? "audit";
  if (!["audit", "bootstrap", "disable", "enable", "repair"].includes(mode)) throw new Error("Unknown security admin mode");
  if (!values.get("--user") && !flags.has("--all")) throw new Error("Select --user or --all");
  if (values.get("--user") && flags.has("--all")) throw new Error("Select only one identity scope");
  if (["disable", "enable"].includes(mode) && flags.has("--all")) throw new Error("Account enable/disable requires one explicit --user");
  const apply = flags.has("--apply");
  if (apply && (values.get("--confirm-project") !== projectId || !values.get("--actor") || !values.get("--reason"))) throw new Error("Writes require --confirm-project, --actor and --reason");
  if (apply && mode === "audit") throw new Error("Audit never accepts --apply");
  return {projectId: projectId!, mode, apply, all: flags.has("--all"), userId: values.get("--user"),
    importAdmins: flags.has("--import-admins"), actorId: values.get("--actor") ?? "audit", reason: values.get("--reason") ?? "audit"};
}

