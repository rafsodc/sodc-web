import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as fs from "fs";
import * as path from "path";
import { NotifyClient } from "notifications-node-client";
import { requireAdmin, handleFunctionError } from "./helpers";
import { govNotifyApiKey } from "./mailer";
import { EMAIL_TEMPLATE_MANIFEST } from "./generatedEmailTemplateManifest";
import { FUNCTIONS_REGION } from "./constants";

const REGISTRY_PATH = path.resolve(__dirname, "../email-templates/template-registry.json");

type Environment = "dev" | "beta" | "production";

interface RegistryEntry {
  dev?: string;
  beta?: string;
  production?: string;
}

type TemplateRegistry = Record<string, RegistryEntry> & {
  _serviceIds?: RegistryEntry;
};

export type TemplateSyncStatus = "in_sync" | "drift" | "not_configured" | "fetch_error";

export interface TemplateSyncResult {
  templateKey: string;
  templateUuid?: string;
  notifyEditUrl?: string;
  status: TemplateSyncStatus;
  liveTemplateName?: string;
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

function resolveEnvironment(): Environment {
  const project = process.env.GCLOUD_PROJECT ?? process.env.APP_ENV ?? "";
  if (project.includes("production")) return "production";
  if (project.includes("beta")) return "beta";
  return "dev";
}

function buildEditUrl(serviceId: string, templateUuid: string): string {
  return `https://www.notifications.service.gov.uk/services/${serviceId}/templates/${templateUuid}/edit`;
}

interface NotifyTemplate {
  name: string;
  subject: string;
  body: string;
}

async function fetchNotifyTemplate(apiKey: string, uuid: string): Promise<NotifyTemplate> {
  const client = new NotifyClient(apiKey);
  const response = await client.getTemplateById(uuid);
  const data = response.data as { name: string; subject: string; body: string };
  return { name: data.name ?? "", subject: data.subject ?? "", body: data.body ?? "" };
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
    const serviceId = registry._serviceIds?.[environment]?.trim() ?? "";

    try {
      const results: TemplateSyncResult[] = await Promise.all(
        Object.entries(EMAIL_TEMPLATE_MANIFEST).map(async ([templateKey, definition]) => {
          const uuid = registry[templateKey]?.[environment]?.trim();
          const expectedSubject = definition.subject;
          const expectedBody = normaliseBody(definition.body);
          const notifyEditUrl = uuid && serviceId ? buildEditUrl(serviceId, uuid) : undefined;

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
            const liveTemplateName = live.name;
            const liveSubject = live.subject;
            const liveBody = normaliseBody(live.body);
            const subjectMatch = liveSubject === expectedSubject;
            const bodyMatch = liveBody === expectedBody;
            return {
              templateKey,
              templateUuid: uuid,
              notifyEditUrl,
              status: (subjectMatch && bodyMatch ? "in_sync" : "drift") as TemplateSyncStatus,
              liveTemplateName,
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
              templateUuid: uuid,
              notifyEditUrl,
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
