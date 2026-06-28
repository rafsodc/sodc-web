import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as fs from "fs";
import * as path from "path";
import { NotifyClient } from "notifications-node-client";
import { requireAdmin, handleFunctionError } from "./helpers";
import { govNotifyApiKey } from "./mailer";
import { EMAIL_TEMPLATE_MANIFEST } from "./generatedEmailTemplateManifest";
import { FUNCTIONS_REGION } from "./constants";

const REGISTRY_PATH = path.resolve(__dirname, "../email-templates/template-registry.json");

type TemplateRegistry = Record<string, { dev?: string; beta?: string; production?: string }>;

export type TemplateSyncStatus = "in_sync" | "drift" | "not_configured" | "fetch_error";

export interface TemplateSyncResult {
  templateKey: string;
  status: TemplateSyncStatus;
  liveSubject?: string;
  liveBody?: string;
  expectedSubject: string;
  expectedBody: string;
  subjectMatch?: boolean;
  bodyMatch?: boolean;
  errorMessage?: string;
}

function normaliseBody(body: string): string {
  return body.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function loadRegistry(): TemplateRegistry {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, "utf-8");
    return JSON.parse(raw) as TemplateRegistry;
  } catch {
    return {};
  }
}

function resolveEnvironment(): "dev" | "beta" | "production" {
  const project = process.env.GCLOUD_PROJECT ?? process.env.APP_ENV ?? "";
  if (project.includes("production")) return "production";
  if (project.includes("beta")) return "beta";
  return "dev";
}

interface NotifyTemplate {
  subject: string;
  body: string;
}

async function fetchNotifyTemplate(apiKey: string, uuid: string): Promise<NotifyTemplate> {
  const client = new NotifyClient(apiKey);
  const response = await client.getTemplateById(uuid);
  const data = response.data as { subject: string; body: string };
  return { subject: data.subject ?? "", body: data.body ?? "" };
}

export const getTemplateSyncStatus = onCall(
  { region: FUNCTIONS_REGION, secrets: [govNotifyApiKey] },
  async (request): Promise<{ results: TemplateSyncResult[] }> => {
    requireAdmin(request);

    const apiKey = govNotifyApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "GOV_NOTIFY_API_KEY is not configured");
    }

    const registry = loadRegistry();
    const environment = resolveEnvironment();

    try {
      const results: TemplateSyncResult[] = await Promise.all(
        Object.entries(EMAIL_TEMPLATE_MANIFEST).map(async ([templateKey, definition]) => {
          const uuid = registry[templateKey]?.[environment]?.trim();
          const expectedSubject = definition.subject;
          const expectedBody = normaliseBody(definition.body);

          if (!uuid) {
            return {
              templateKey,
              status: "not_configured" as TemplateSyncStatus,
              expectedSubject,
              expectedBody,
            };
          }

          try {
            const live = await fetchNotifyTemplate(apiKey, uuid);
            const liveSubject = live.subject;
            const liveBody = normaliseBody(live.body);
            const subjectMatch = liveSubject === expectedSubject;
            const bodyMatch = liveBody === expectedBody;
            return {
              templateKey,
              status: (subjectMatch && bodyMatch ? "in_sync" : "drift") as TemplateSyncStatus,
              liveSubject,
              liveBody,
              expectedSubject,
              expectedBody,
              subjectMatch,
              bodyMatch,
            };
          } catch (err) {
            return {
              templateKey,
              status: "fetch_error" as TemplateSyncStatus,
              expectedSubject,
              expectedBody,
              errorMessage: err instanceof Error ? err.message : String(err),
            };
          }
        })
      );

      return { results };
    } catch (e) {
      handleFunctionError(e, "fetching template sync status");
    }
  }
);
