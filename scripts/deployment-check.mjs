#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RESULT_STATUS,
  assessAppCheckEnforcement,
  assessAuthConfiguration,
  assessDefinitionsFreshness,
  assessGovNotifyReplyToConfiguration,
  assessFunctionInvokerPolicies,
  assessServiceAccountProjectScope,
  assessStorageRulesContent,
  compareExpected,
  createReport,
  discoverFunctionContracts,
  emitReport,
  exitCodeFor,
  isPublicInvokerPolicy,
  normalizeResourceName,
  parseArguments,
  parseJsonOutput,
  resolveTarget,
  result,
  safeErrorMessage,
  unwrapFirebaseResult,
} from "./deployment-check-lib.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let gcloudReady = true;
let cachedAccessToken;

async function accessToken() {
  if (!cachedAccessToken) {
    cachedAccessToken = (await run("gcloud", ["auth", "print-access-token"])).trim();
  }
  return cachedAccessToken;
}

/**
 * Calls a Google/Firebase Management REST API that has no gcloud/firebase CLI equivalent
 * (App Check, Identity Toolkit, Firebase Security Rules). Read-only GETs only.
 */
async function googleApiFetch(url, projectId) {
  const token = await accessToken();
  const response = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}`, "X-Goog-User-Project": projectId },
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `request to ${url} failed with HTTP ${response.status}`);
  }
  return body;
}

const help = `Usage:
  npm run deployment:check -- --env <dev|beta|prod> [options]

Options:
  --expected-sha <sha>  Fail if Hosting does not serve this Git revision
  --authenticated       Run the optional authenticated callable smoke check
  --json                Emit a machine-readable JSON report
  --out <path>          Also write the JSON report to this file, for retention
                         as a short-lived release artifact
  --help                Show this help

Authenticated checks read SODC_DEPLOYMENT_CHECK_AUTH_TOKEN from the environment.
Never pass an ID token on the command line or store one in the repository.`;

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), "utf8"));
}

async function run(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 120_000,
    env: { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1" },
  });
  return stdout;
}

async function runJson(command, args) {
  return parseJsonOutput(await run(command, args));
}

function values(value) {
  const unwrapped = unwrapFirebaseResult(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === "object") {
    for (const key of ["projects", "apps", "sites", "services", "functions", "items"]) {
      if (Array.isArray(unwrapped[key])) return unwrapped[key];
    }
  }
  return unwrapped ? [unwrapped] : [];
}

function resourceNames(items) {
  return items.map((item) =>
    normalizeResourceName(
      item.name ??
        item.metadata?.name ??
        item.id ??
        item.projectId ??
        item.site ??
        item.siteId ??
        item.service ??
        item.appId
    )
  );
}

async function commandCheck(results, definition) {
  if (definition.command === "gcloud" && definition.id !== "gcloud-project" && !gcloudReady) {
    const label = definition.label.replace(/ failed$/, "");
    results.push(
      result(
        definition.id,
        RESULT_STATUS.SKIP,
        `${label} skipped because the gcloud project/authentication preflight failed.`
      )
    );
    return undefined;
  }

  try {
    const data = definition.json === false
      ? await run(definition.command, definition.args)
      : await runJson(definition.command, definition.args);
    const outcome = await definition.validate(data);
    results.push(result(definition.id, outcome.status, outcome.summary, outcome.details));
    return data;
  } catch (error) {
    const status = definition.optional ? RESULT_STATUS.WARN : RESULT_STATUS.FAIL;
    results.push(
      result(definition.id, status, `${definition.label}: ${safeErrorMessage(error)}`, {
        command: [definition.command, ...definition.args].join(" "),
      })
    );
    return undefined;
  }
}

function containsText(value, expected) {
  return JSON.stringify(value).toLowerCase().includes(expected.toLowerCase());
}

function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return output;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(safeErrorMessage(error));
    console.error(help);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(help);
    return;
  }

  const [firebaseRc, configuration, contracts] = await Promise.all([
    readJson(".firebaserc"),
    readJson("config/deployment-check.json"),
    discoverFunctionContracts(path.join(repositoryRoot, "functions/src")),
  ]);
  const target = resolveTarget(firebaseRc, configuration, options.env);
  const expectedPublicInvokerFunctions = configuration.expectedPublicInvokerFunctions ?? [];
  const results = [
    result(
      "target",
      RESULT_STATUS.PASS,
      `Resolved ${target.alias} to explicit project ${target.projectId}.`
    ),
  ];

  const missingPublicContracts = compareExpected(
    contracts.publicInvokerFunctions,
    expectedPublicInvokerFunctions
  );
  const stalePublicContracts = compareExpected(
    expectedPublicInvokerFunctions,
    contracts.publicInvokerFunctions
  );
  results.push(
    result(
      "function-public-contract",
      missingPublicContracts.length || stalePublicContracts.length
        ? RESULT_STATUS.FAIL
        : RESULT_STATUS.PASS,
      missingPublicContracts.length || stalePublicContracts.length
        ? "Function public-invoker allowlist does not match the checked-in HTTP/callable exports."
        : "Function public-invoker allowlist matches the checked-in HTTP/callable exports.",
      missingPublicContracts.length || stalePublicContracts.length
        ? { missingPublicContracts, stalePublicContracts }
        : undefined
    )
  );

  const firebaseProjects = await commandCheck(results, {
    id: "firebase-project",
    label: "Firebase project lookup failed",
    command: "firebase",
    args: ["projects:list", "--json"],
    validate(data) {
      const found = values(data).some((project) =>
        [project.projectId, project.project_id, project.id].includes(target.projectId)
      );
      if (!found) throw new Error(`project ${target.projectId} is not visible to Firebase CLI`);
      return { status: RESULT_STATUS.PASS, summary: "Firebase CLI can access the target project." };
    },
  });

  if (!firebaseProjects) {
    const report = createReport(target, results);
    await emitReport(report, options);
    process.exitCode = exitCodeFor(results);
    return;
  }

  const gcloudProject = await commandCheck(results, {
    id: "gcloud-project",
    label: "Google Cloud project/authentication preflight failed",
    command: "gcloud",
    args: ["projects", "describe", target.projectId, "--format=json"],
    validate(data) {
      const projectId = data.projectId ?? data.project_id ?? normalizeResourceName(data.name);
      if (projectId !== target.projectId) {
        throw new Error(`gcloud returned ${projectId || "no project"}, expected ${target.projectId}`);
      }
      return {
        status: RESULT_STATUS.PASS,
        summary: "gcloud can access the same explicit target project.",
      };
    },
  });
  gcloudReady = Boolean(gcloudProject);

  await commandCheck(results, {
    id: "firebase-web-app",
    label: "Firebase Web app audit failed",
    command: "firebase",
    args: ["apps:list", "WEB", "--project", target.projectId, "--json"],
    validate(data) {
      if (values(data).length === 0) throw new Error("no Firebase Web app is registered");
      return { status: RESULT_STATUS.PASS, summary: "At least one Firebase Web app is registered." };
    },
  });

  if (gcloudReady) {
    try {
      const authConfig = await googleApiFetch(
        `https://identitytoolkit.googleapis.com/admin/v2/projects/${target.projectId}/config`,
        target.projectId
      );
      const expectedAuthorizedDomains = [
        `${target.projectId}.firebaseapp.com`,
        new URL(target.hostingUrl).hostname,
      ];
      const outcome = assessAuthConfiguration(
        authConfig,
        expectedAuthorizedDomains,
        target.allowLocalhostAuthDomain === true
      );
      results.push(result("auth-config", outcome.status, outcome.summary, outcome.details));
    } catch (error) {
      results.push(
        result("auth-config", RESULT_STATUS.FAIL, `Auth configuration audit failed: ${safeErrorMessage(error)}`)
      );
    }
  } else {
    results.push(
      result(
        "auth-config",
        RESULT_STATUS.SKIP,
        "Auth configuration audit skipped because the gcloud project/authentication preflight failed."
      )
    );
  }

  await commandCheck(results, {
    id: "required-apis",
    label: "Required API audit failed",
    command: "gcloud",
    args: ["services", "list", "--enabled", "--project", target.projectId, "--format=json"],
    validate(data) {
      const enabled = values(data).map((api) => api.config?.name ?? api.name).filter(Boolean);
      const missing = compareExpected(configuration.requiredApis, enabled);
      if (missing.length) throw new Error(`missing APIs: ${missing.join(", ")}`);
      return { status: RESULT_STATUS.PASS, summary: "All required Google Cloud APIs are enabled." };
    },
  });

  if (gcloudReady) {
    try {
      const appCheck = await googleApiFetch(
        `https://firebaseappcheck.googleapis.com/v1/projects/${target.projectId}/services`,
        target.projectId
      );
      const relevant = (appCheck.services ?? []).filter((service) =>
        configuration.appCheck.services.includes(normalizeResourceName(service.name))
      );
      const outcome = assessAppCheckEnforcement(relevant);
      results.push(result("app-check", outcome.status, outcome.summary, outcome.details));
    } catch (error) {
      results.push(
        result("app-check", RESULT_STATUS.FAIL, `App Check audit failed: ${safeErrorMessage(error)}`)
      );
    }
  } else {
    results.push(
      result(
        "app-check",
        RESULT_STATUS.SKIP,
        "App Check audit skipped because the gcloud project/authentication preflight failed."
      )
    );
  }

  await commandCheck(results, {
    id: "dataconnect",
    label: "Data Connect audit failed",
    command: "firebase",
    args: ["dataconnect:services:list", "--project", target.projectId, "--json"],
    validate(data) {
      if (!containsText(data, configuration.dataConnect.service)) {
        throw new Error(`service ${configuration.dataConnect.service} was not found`);
      }
      if (!containsText(data, configuration.dataConnect.connector)) {
        throw new Error(`connector ${configuration.dataConnect.connector} was not found`);
      }
      return { status: RESULT_STATUS.PASS, summary: "Data Connect service and connector are deployed." };
    },
  });

  await commandCheck(results, {
    id: "cloud-sql",
    label: "Cloud SQL resilience audit failed",
    command: "gcloud",
    optional: !target.requireCloudSqlResilience,
    args: [
      "sql",
      "instances",
      "describe",
      configuration.dataConnect.sqlInstance,
      "--project",
      target.projectId,
      "--format=json",
    ],
    validate(data) {
      const backups = data.settings?.backupConfiguration;
      const healthy =
        data.region === target.region &&
        backups?.enabled === true &&
        backups?.pointInTimeRecoveryEnabled === true &&
        data.settings?.deletionProtectionEnabled === true;
      if (!healthy) {
        throw new Error("region, automated backups, point-in-time recovery, or deletion protection differs");
      }
      return {
        status: RESULT_STATUS.PASS,
        summary: "Cloud SQL region, backups, point-in-time recovery, and deletion protection are configured.",
      };
    },
  });

  await commandCheck(results, {
    id: "cloud-sql-database",
    label: "Cloud SQL database audit failed",
    command: "gcloud",
    args: [
      "sql",
      "databases",
      "list",
      "--instance",
      configuration.dataConnect.sqlInstance,
      "--project",
      target.projectId,
      "--format=json",
    ],
    validate(data) {
      const names = values(data).map((database) => database.name);
      if (!names.includes(configuration.dataConnect.database)) {
        throw new Error(`database ${configuration.dataConnect.database} was not found`);
      }
      return { status: RESULT_STATUS.PASS, summary: "Expected Data Connect database exists." };
    },
  });

  await commandCheck(results, {
    id: "hosting-site",
    label: "Hosting site audit failed",
    command: "firebase",
    args: ["hosting:sites:list", "--project", target.projectId, "--json"],
    validate(data) {
      if (!containsText(data, target.hostingSite)) {
        throw new Error(`site ${target.hostingSite} was not found`);
      }
      return { status: RESULT_STATUS.PASS, summary: "Expected Firebase Hosting site exists." };
    },
  });

  await commandCheck(results, {
    id: "cloud-run-definition-job",
    label: "Cloud Run definitions job audit failed",
    command: "gcloud",
    args: ["run", "jobs", "list", "--region", target.region, "--project", target.projectId, "--format=json"],
    validate(data) {
      const names = resourceNames(values(data));
      const missing = compareExpected(configuration.requiredCloudRunJobs, names);
      if (missing.length) throw new Error(`missing jobs: ${missing.join(", ")}`);
      return { status: RESULT_STATUS.PASS, summary: "Required malware-definition job exists." };
    },
  });

  if (gcloudReady) {
    try {
      const scheduler = await runJson("gcloud", [
        "scheduler",
        "jobs",
        "describe",
        configuration.requiredCloudRunJobs[0],
        "--project",
        target.projectId,
        "--location",
        target.region,
        "--format=json",
      ]);
      const outcome = assessDefinitionsFreshness({
        schedulerState: scheduler.state,
        lastAttemptTime: scheduler.lastAttemptTime,
        lastAttemptFailed: Boolean(scheduler.status?.code),
        now: new Date(),
        maxAgeHours: 3,
      });
      results.push(result("malware-definitions-freshness", outcome.status, outcome.summary));
    } catch (error) {
      results.push(
        result(
          "malware-definitions-freshness",
          RESULT_STATUS.FAIL,
          `Malware-definition freshness audit failed: ${safeErrorMessage(error)}`
        )
      );
    }
  } else {
    results.push(
      result(
        "malware-definitions-freshness",
        RESULT_STATUS.SKIP,
        "Malware-definition freshness audit skipped because the gcloud project/authentication preflight failed."
      )
    );
  }

  const deployedFunctions = await commandCheck(results, {
    id: "functions",
    label: "Cloud Functions audit failed",
    command: "gcloud",
    args: [
      "functions",
      "list",
      "--v2",
      `--regions=${target.region}`,
      "--project",
      target.projectId,
      "--format=json",
    ],
    validate(data) {
      const items = values(data);
      const names = resourceNames(items);
      const missing = compareExpected(contracts.functions, names);
      const inactive = items
        .filter((fn) => fn.state && fn.state !== "ACTIVE")
        .map((fn) => normalizeResourceName(fn.name));
      const wrongRuntime = items
        .filter(
          (fn) =>
            fn.buildConfig?.runtime && fn.buildConfig.runtime !== configuration.functionsRuntime
        )
        .map((fn) => `${normalizeResourceName(fn.name)}:${fn.buildConfig.runtime}`);
      const missingServiceAccount = items
        .filter((fn) => !fn.serviceConfig?.serviceAccountEmail)
        .map((fn) => normalizeResourceName(fn.name));
      const referencedSecrets = items.flatMap((fn) =>
        (fn.serviceConfig?.secretEnvironmentVariables ?? []).map(
          (secret) => secret.key ?? normalizeResourceName(secret.secret)
        )
      );
      const missingSecretReferences = compareExpected(contracts.secrets, referencedSecrets);
      if (
        missing.length ||
        inactive.length ||
        wrongRuntime.length ||
        missingServiceAccount.length ||
        missingSecretReferences.length
      ) {
        throw new Error(
          [
            missing.length ? `missing: ${missing.join(", ")}` : "",
            inactive.length ? `not ACTIVE: ${inactive.join(", ")}` : "",
            wrongRuntime.length ? `wrong runtime: ${wrongRuntime.join(", ")}` : "",
            missingServiceAccount.length
              ? `missing service account: ${missingServiceAccount.join(", ")}`
              : "",
            missingSecretReferences.length
              ? `unreferenced required secrets: ${missingSecretReferences.join(", ")}`
              : "",
          ].filter(Boolean).join("; ")
        );
      }
      const expected = new Set(contracts.functions.map((name) => name.toLowerCase()));
      const unexpected = names.filter((name) => !expected.has(name));
      return {
        status: unexpected.length ? RESULT_STATUS.WARN : RESULT_STATUS.PASS,
        summary: unexpected.length
          ? "All expected Functions are active; unexpected Functions need review."
          : "All expected Functions are active in the expected region.",
        details: unexpected.length ? { unexpected } : undefined,
      };
    },
  });

  if (deployedFunctions) {
    const replyTo = assessGovNotifyReplyToConfiguration(values(deployedFunctions));
    const details = {
      configuredFunctionCount: replyTo.configuredFunctions.length,
      missingFunctions: replyTo.missingFunctions,
      invalidFunctions: replyTo.invalidFunctions,
    };
    if (replyTo.invalidFunctions.length) {
      results.push(result(
        "gov-notify-email-reply-to",
        RESULT_STATUS.FAIL,
        "GOV.UK Notify email reply-to configuration contains a malformed UUID.",
        details,
      ));
    } else if (replyTo.distinctValueCount > 1) {
      results.push(result(
        "gov-notify-email-reply-to",
        RESULT_STATUS.FAIL,
        "Deployed Functions use inconsistent GOV.UK Notify email reply-to UUIDs.",
        details,
      ));
    } else if (replyTo.configuredFunctions.length && replyTo.missingFunctions.length) {
      results.push(result(
        "gov-notify-email-reply-to",
        RESULT_STATUS.FAIL,
        "GOV.UK Notify email reply-to UUID is missing from some deployed Functions.",
        details,
      ));
    } else if (!replyTo.configuredFunctions.length) {
      results.push(result(
        "gov-notify-email-reply-to",
        RESULT_STATUS.PASS,
        "No migration reply-to UUID is deployed; admin-managed configuration is expected.",
      ));
    } else {
      results.push(result(
        "gov-notify-email-reply-to",
        RESULT_STATUS.PASS,
        "GOV.UK Notify email reply-to UUID is valid and consistent across deployed Functions.",
        { configuredFunctionCount: replyTo.configuredFunctions.length },
      ));
    }
  }

  if (deployedFunctions && gcloudReady) {
    const functionIamRecords = await mapWithConcurrency(
      values(deployedFunctions),
      6,
      async (fn) => {
        const functionName = normalizeResourceName(fn.name);
        const serviceName = normalizeResourceName(fn.serviceConfig?.service);
        if (!serviceName) {
          return { functionName, error: "deployed Function did not report its Cloud Run service" };
        }
        try {
          const policy = await runJson("gcloud", [
            "run",
            "services",
            "get-iam-policy",
            serviceName,
            "--region",
            target.region,
            "--project",
            target.projectId,
            "--format=json",
          ]);
          return {
            functionName,
            serviceName,
            publiclyInvokable: isPublicInvokerPolicy(policy),
          };
        } catch (error) {
          return { functionName, serviceName, error: safeErrorMessage(error) };
        }
      }
    );
    const assessment = assessFunctionInvokerPolicies(
      functionIamRecords,
      expectedPublicInvokerFunctions
    );
    const failed = Object.values(assessment).some((entries) => entries.length > 0);
    results.push(
      result(
        "function-cloud-run-iam",
        failed ? RESULT_STATUS.FAIL : RESULT_STATUS.PASS,
        failed
          ? "Function Cloud Run invoker IAM differs from the explicit transport exposure contract."
          : "Function Cloud Run invoker IAM matches the explicit transport exposure contract.",
        failed ? assessment : undefined
      )
    );
  } else {
    results.push(
      result(
        "function-cloud-run-iam",
        RESULT_STATUS.SKIP,
        "Function Cloud Run IAM audit skipped because Function inventory or gcloud access was unavailable."
      )
    );
  }

  await commandCheck(results, {
    id: "secrets",
    label: "Secret Manager audit failed",
    command: "gcloud",
    args: ["secrets", "list", "--project", target.projectId, "--format=json"],
    validate(data) {
      const names = resourceNames(values(data));
      const expected = [...new Set([...configuration.requiredSecrets, ...contracts.secrets])];
      const missing = compareExpected(expected, names);
      if (missing.length) throw new Error(`missing secret resources: ${missing.join(", ")}`);
      return { status: RESULT_STATUS.PASS, summary: "Required secret resources exist; values were not read." };
    },
  });

  const bucket = await commandCheck(results, {
    id: "storage-bucket",
    label: "Storage bucket audit failed",
    command: "gcloud",
    args: ["storage", "buckets", "describe", `gs://${target.storageBucket}`, "--raw", "--format=json"],
    validate(data) {
      const uniform = data.iamConfiguration?.uniformBucketLevelAccess?.enabled === true;
      const prevention = data.iamConfiguration?.publicAccessPrevention === "enforced";
      const lifecycle = data.lifecycle?.rule ?? [];
      const lifecycleOk = lifecycle.some(
        (rule) =>
          rule.action?.type === "Delete" &&
          rule.condition?.age === 1 &&
          rule.condition?.matchesPrefix?.includes("section-file-uploads/")
      );
      const cors = data.cors ?? [];
      const corsOk = cors.some(
        (entry) =>
          entry.method?.includes("PUT") &&
          entry.origin?.includes(target.hostingUrl) &&
          !entry.origin?.includes("*")
      );
      if (!uniform || !prevention || !lifecycleOk || !corsOk) {
        throw new Error(
          "uniform access, public access prevention, upload lifecycle, or exact-origin PUT CORS differs"
        );
      }
      return { status: RESULT_STATUS.PASS, summary: "Storage access controls and lifecycle match policy." };
    },
  });

  if (gcloudReady) {
    try {
      const releases = await googleApiFetch(
        `https://firebaserules.googleapis.com/v1/projects/${target.projectId}/releases`,
        target.projectId
      );
      const release = (releases.releases ?? []).find((entry) =>
        entry.name.endsWith(`firebase.storage/${target.storageBucket}`)
      );
      if (!release) throw new Error(`no Storage rules release found for ${target.storageBucket}`);
      const ruleset = await googleApiFetch(
        `https://firebaserules.googleapis.com/v1/${release.rulesetName}`,
        target.projectId
      );
      const deployedContent = ruleset.source?.files?.[0]?.content;
      const checkedInContent = await readFile(path.join(repositoryRoot, "storage.rules"), "utf8");
      const outcome = assessStorageRulesContent(deployedContent, checkedInContent);
      results.push(result("storage-rules-content", outcome.status, outcome.summary));

      const probeUrl = `https://firebasestorage.googleapis.com/v0/b/${target.storageBucket}/o/_deployment-check-probe`;
      const probeResponse = await fetchWithTimeout(probeUrl);
      results.push(
        result(
          "storage-unauthenticated-probe",
          probeResponse.status === 200 ? RESULT_STATUS.FAIL : RESULT_STATUS.PASS,
          probeResponse.status === 200
            ? "Unauthenticated Storage read succeeded; deployed rules do not deny read."
            : `Unauthenticated Storage read was denied (HTTP ${probeResponse.status}).`
        )
      );
    } catch (error) {
      results.push(
        result(
          "storage-rules-content",
          RESULT_STATUS.FAIL,
          `Storage rules audit failed: ${safeErrorMessage(error)}`
        )
      );
    }
  } else {
    results.push(
      result(
        "storage-rules-content",
        RESULT_STATUS.SKIP,
        "Storage rules audit skipped because the gcloud project/authentication preflight failed."
      )
    );
  }

  let runtimeServiceAccount;
  if (deployedFunctions) {
    const uploadFunction = values(deployedFunctions).find(
      (fn) => normalizeResourceName(fn.name) === "requestsectionfileupload"
    );
    runtimeServiceAccount = uploadFunction?.serviceConfig?.serviceAccountEmail;
  }

  if (bucket && runtimeServiceAccount) {
    await commandCheck(results, {
      id: "storage-iam",
      label: "Storage IAM audit failed",
      command: "gcloud",
      args: ["storage", "buckets", "get-iam-policy", `gs://${target.storageBucket}`, "--format=json"],
      validate(data) {
        const member = `serviceAccount:${runtimeServiceAccount}`;
        const hasObjectAdmin = (data.bindings ?? []).some(
          (binding) => binding.role === "roles/storage.objectAdmin" && binding.members?.includes(member)
        );
        if (!hasObjectAdmin) throw new Error("runtime service account lacks explicit objectAdmin binding");
        return { status: RESULT_STATUS.PASS, summary: "Functions runtime has explicit bucket objectAdmin." };
      },
    });

    await commandCheck(results, {
      id: "signing-iam",
      label: "Service-account signing IAM audit failed",
      command: "gcloud",
      args: [
        "iam",
        "service-accounts",
        "get-iam-policy",
        runtimeServiceAccount,
        "--project",
        target.projectId,
        "--format=json",
      ],
      validate(data) {
        const member = `serviceAccount:${runtimeServiceAccount}`;
        const hasSigning = (data.bindings ?? []).some(
          (binding) =>
            binding.role === "roles/iam.serviceAccountTokenCreator" &&
            binding.members?.includes(member)
        );
        if (!hasSigning) throw new Error("runtime service account lacks self TokenCreator binding");
        return { status: RESULT_STATUS.PASS, summary: "Functions runtime has keyless signing permission." };
      },
    });
  } else {
    results.push(
      result(
        "storage-runtime-iam",
        RESULT_STATUS.SKIP,
        "Storage runtime IAM checks skipped because the bucket or upload Function was unavailable."
      )
    );
  }

  await commandCheck(results, {
    id: "cloud-run-scanner",
    label: "Cloud Run scanner audit failed",
    command: "gcloud",
    args: ["run", "services", "list", "--region", target.region, "--project", target.projectId, "--format=json"],
    validate(data) {
      const services = values(data);
      const names = resourceNames(services);
      const missing = compareExpected(configuration.requiredCloudRunServices, names);
      if (missing.length) throw new Error(`missing services: ${missing.join(", ")}`);
      const unready = services
        .filter((service) => configuration.requiredCloudRunServices.includes(normalizeResourceName(service.metadata?.name ?? service.name)))
        .filter((service) => {
          const ready = service.status?.conditions?.find((condition) => condition.type === "Ready");
          return ready && ready.status !== "True";
        })
        .map((service) => normalizeResourceName(service.metadata?.name ?? service.name));
      if (unready.length) throw new Error(`services not ready: ${unready.join(", ")}`);
      const allowed = new Set(
        [...configuration.requiredCloudRunServices, ...contracts.functions].map((name) =>
          name.toLowerCase()
        )
      );
      const unexpected = names.filter((name) => !allowed.has(name));
      return {
        status: unexpected.length ? RESULT_STATUS.WARN : RESULT_STATUS.PASS,
        summary: unexpected.length
          ? "Required Cloud Run services are deployed; unexpected services need review."
          : "Required Cloud Run services are deployed.",
        details: unexpected.length ? { unexpected } : undefined,
      };
    },
  });

  if (runtimeServiceAccount) {
    await commandCheck(results, {
      id: "cloud-run-scanner-iam",
      label: "Cloud Run scanner IAM audit failed",
      command: "gcloud",
      args: [
        "run",
        "services",
        "get-iam-policy",
        "section-file-malware-scanner",
        "--region",
        target.region,
        "--project",
        target.projectId,
        "--format=json",
      ],
      validate(data) {
        const bindings = data.bindings ?? [];
        const publiclyInvokable = bindings.some((binding) =>
          binding.members?.some((member) =>
            ["allUsers", "allAuthenticatedUsers"].includes(member)
          )
        );
        const runtimeCanInvoke = bindings.some(
          (binding) =>
            binding.role === "roles/run.invoker" &&
            binding.members?.includes(`serviceAccount:${runtimeServiceAccount}`)
        );
        if (publiclyInvokable || !runtimeCanInvoke) {
          throw new Error("scanner is public or the Functions runtime lacks run.invoker");
        }
        return {
          status: RESULT_STATUS.PASS,
          summary: "Malware scanner is private and callable by Functions.",
        };
      },
    });
  } else {
    results.push(
      result(
        "cloud-run-scanner-iam",
        RESULT_STATUS.SKIP,
        "Scanner IAM check skipped because the Functions runtime identity was unavailable."
      )
    );
  }

  if (gcloudReady) {
    try {
      const scannerService = await runJson("gcloud", [
        "run",
        "services",
        "describe",
        "section-file-malware-scanner",
        "--region",
        target.region,
        "--project",
        target.projectId,
        "--format=json",
      ]);
      const scannerServiceAccount = scannerService.spec?.template?.spec?.serviceAccountName;
      if (!scannerServiceAccount) throw new Error("scanner service did not report a service account");
      const projectPolicy = await runJson("gcloud", [
        "projects",
        "get-iam-policy",
        target.projectId,
        "--flatten=bindings[].members",
        `--filter=bindings.members:serviceAccount:${scannerServiceAccount}`,
        "--format=json",
      ]);
      const projectRoles = values(projectPolicy).map((binding) => binding.bindings?.role ?? binding.role).filter(Boolean);
      const outcome = assessServiceAccountProjectScope(scannerServiceAccount, projectRoles);
      results.push(result("scanner-project-scope", outcome.status, outcome.summary));
    } catch (error) {
      results.push(
        result(
          "scanner-project-scope",
          RESULT_STATUS.FAIL,
          `Scanner service-account scope audit failed: ${safeErrorMessage(error)}`
        )
      );
    }
  } else {
    results.push(
      result(
        "scanner-project-scope",
        RESULT_STATUS.SKIP,
        "Scanner service-account scope audit skipped because the gcloud project/authentication preflight failed."
      )
    );
  }

  try {
    const rootResponse = await fetchWithTimeout(target.hostingUrl, { redirect: "follow" });
    if (!rootResponse.ok) throw new Error(`root returned HTTP ${rootResponse.status}`);
    const missingHeaders = configuration.requiredHostingHeaders.filter(
      (header) => !rootResponse.headers.has(header)
    );
    if (missingHeaders.length) throw new Error(`missing headers: ${missingHeaders.join(", ")}`);
    results.push(result("hosting-root", RESULT_STATUS.PASS, "Hosting root and security headers are healthy."));

    const deepLinkResponse = await fetchWithTimeout(`${target.hostingUrl}/account`, {
      redirect: "follow",
    });
    if (!deepLinkResponse.ok) throw new Error(`deep link returned HTTP ${deepLinkResponse.status}`);
    results.push(result("hosting-deep-link", RESULT_STATUS.PASS, "Hosting SPA deep link is healthy."));

    const unsubscribeResponse = await fetchWithTimeout(`${target.hostingUrl}/unsubscribe`, {
      redirect: "manual",
    });
    const unsubscribeBody = await unsubscribeResponse.text();
    const isSpaFallback =
      unsubscribeBody.includes('id="root"') || unsubscribeBody.includes('src="/assets/');
    results.push(
      result(
        "hosting-unsubscribe",
        unsubscribeResponse.status < 500 && !isSpaFallback
          ? RESULT_STATUS.PASS
          : RESULT_STATUS.FAIL,
        unsubscribeResponse.status < 500 && !isSpaFallback
          ? "/unsubscribe is routed to its Function."
          : "/unsubscribe is unhealthy or is being served by the SPA fallback."
      )
    );

    const manifestResponse = await fetchWithTimeout(`${target.hostingUrl}/deployment-manifest.json`, {
      redirect: "follow",
      headers: { "cache-control": "no-cache" },
    });
    if (!manifestResponse.ok) throw new Error(`manifest returned HTTP ${manifestResponse.status}`);
    if (!manifestResponse.headers.get("content-type")?.includes("application/json")) {
      throw new Error("deployment manifest is not deployed; Hosting returned the SPA fallback");
    }
    const manifest = await manifestResponse.json();
    if (manifest.schemaVersion !== "sodc-deployment-manifest/v1") {
      throw new Error("deployment manifest schema is missing or unsupported");
    }
    if (manifest.environment !== target.alias) {
      throw new Error(`manifest environment is ${manifest.environment}, expected ${target.alias}`);
    }
    if (options.expectedSha && manifest.gitSha !== options.expectedSha) {
      throw new Error(`manifest SHA ${manifest.gitSha} does not match expected ${options.expectedSha}`);
    }
    results.push(
      result("release-manifest", RESULT_STATUS.PASS, "Hosting serves the expected deployment manifest.", {
        environment: manifest.environment,
        gitSha: manifest.gitSha,
        builtAt: manifest.builtAt,
      })
    );
  } catch (error) {
    results.push(
      result(
        "hosting-runtime",
        RESULT_STATUS.FAIL,
        `Hosting runtime audit failed: ${safeErrorMessage(error)}`
      )
    );
  }

  if (options.authenticated) {
    try {
      const response = await fetchWithTimeout(
        `https://${target.region}-${target.projectId}.cloudfunctions.net/getGovNotifyDeliveryAdminConfiguration`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.SODC_DEPLOYMENT_CHECK_AUTH_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ data: {} }),
        }
      );
      if (!response.ok) throw new Error(`callable returned HTTP ${response.status}`);
      results.push(result("authenticated-callable", RESULT_STATUS.PASS, "Authenticated callable smoke check passed."));
    } catch (error) {
      results.push(
        result(
          "authenticated-callable",
          RESULT_STATUS.FAIL,
          `Authenticated smoke check failed: ${safeErrorMessage(error)}`
        )
      );
    }
  } else {
    results.push(
      result(
        "authenticated-smoke",
        RESULT_STATUS.SKIP,
        "Authenticated smoke check not requested; use --authenticated with a short-lived test token."
      )
    );
  }

  await commandCheck(results, {
    id: "recent-errors",
    label: "Recent Cloud Logging audit failed",
    command: "gcloud",
    args: [
      "logging",
      "read",
      "severity>=ERROR",
      "--freshness=30m",
      "--limit=20",
      "--project",
      target.projectId,
      "--format=json",
    ],
    optional: true,
    validate(data) {
      const count = values(data).length;
      return {
        status: count ? RESULT_STATUS.WARN : RESULT_STATUS.PASS,
        summary: count
          ? "Recent error logs exist and require operator review; message content was not printed."
          : "No ERROR-level log entries were found in the last 30 minutes.",
        details: count ? { count, window: "30m" } : undefined,
      };
    },
  });

  results.push(
    result(
      "manual-controls",
      RESULT_STATUS.WARN,
      "Manually confirm App Check valid-token traffic metrics, SQL restore-test results, alerting/incident-contact/budget-notification/external-dashboard configuration, and end-to-end member journeys with real test data."
    )
  );

  const report = createReport(target, results);
  await emitReport(report, options);
  process.exitCode = exitCodeFor(results);
}

await main();
