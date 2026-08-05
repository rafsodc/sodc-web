import { HttpsError, onCall } from "firebase-functions/v2/https";
import { NotifyClient } from "notifications-node-client";
import {
  getNotifyTemplateBindings,
  upsertNotifyTemplateBinding,
  NotifyTemplateBindingAuditAction,
} from "@dataconnect/admin-generated";
import { requireAdmin, requireString, handleFunctionError } from "./helpers";
import {
  govNotifyApiKeyForMode,
  govNotifySecrets,
} from "./govNotifyDeliveryMode";
import { resolveRuntimeGovNotifyDeliveryMode } from "./govNotifyDeliveryConfiguration";
import { EMAIL_TEMPLATE_MANIFEST } from "./generatedEmailTemplateManifest";
import { FUNCTIONS_REGION } from "./constants";
import { enforceRateLimit } from "./rateLimiter";

export type TemplateSyncStatus = "in_sync" | "drift" | "not_configured" | "fetch_error";

export interface NotifyTemplateCandidate {
  id: string;
  name: string;
  version: number;
}

export interface TemplateSyncResult {
  templateKey: string;
  candidates: NotifyTemplateCandidate[];
  boundTemplateId?: string;
  boundTemplateName?: string;
  reviewedVersion?: number;
  currentLiveVersion?: number;
  versionDrift?: boolean;
  bindingUpdatedAt?: string;
  bindingUpdatedBy?: string;
  notifyEditUrl?: string;
  status: TemplateSyncStatus;
  liveSubject?: string;
  liveBody?: string;
  expectedSubject: string;
  expectedBody: string;
  subjectMatch?: boolean;
  bodyMatch?: boolean;
  errorMessage?: string;
}

interface NotifyLiveTemplate {
  id: string;
  name: string;
  version: number;
  subject?: string;
  body: string;
}

function normaliseBody(body: string): string {
  return body.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function buildEditUrl(serviceId: string, templateId: string): string {
  return `https://www.notifications.service.gov.uk/services/${serviceId}/templates/${templateId}/edit`;
}

async function fetchLiveEmailTemplates(): Promise<{ client: NotifyClient; templates: NotifyLiveTemplate[] }> {
  const mode = (await resolveRuntimeGovNotifyDeliveryMode("LIVE")).effectiveMode;
  const client = new NotifyClient(govNotifyApiKeyForMode(mode));
  const response = await client.getAllTemplates("email");
  const templates = (response.data as { templates: NotifyLiveTemplate[] }).templates ?? [];
  return { client, templates };
}

export interface NotifyTemplateBindingRow {
  templateKey: string;
  notifyTemplateId: string;
  reviewedVersion: number;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Pure: computes each template key's binding/drift status from already-fetched
 * live Notify templates and saved bindings. Kept separate from the Notify API
 * and Data Connect calls in computeTemplateSyncResults() so the matching,
 * drift, and version-drift logic can be unit tested without mocking either.
 */
export function buildTemplateSyncResults(
  templates: readonly NotifyLiveTemplate[],
  bindings: readonly NotifyTemplateBindingRow[],
  serviceId: string | undefined,
): TemplateSyncResult[] {
  const templatesById = new Map(templates.map((t) => [t.id, t]));
  const bindingsByKey = new Map(bindings.map((b) => [b.templateKey, b]));

  return Object.entries(EMAIL_TEMPLATE_MANIFEST).map(([templateKey, definition]) => {
    const candidates: NotifyTemplateCandidate[] = templates
      .filter((t) => t.name === templateKey)
      .map((t) => ({ id: t.id, name: t.name, version: t.version }));
    const expectedSubject = definition.subject;
    const expectedBody = normaliseBody(definition.body);
    const binding = bindingsByKey.get(templateKey);

    if (!binding) {
      return {
        templateKey,
        candidates,
        status: "not_configured" as TemplateSyncStatus,
        expectedSubject,
        expectedBody,
      };
    }

    const notifyEditUrl = serviceId ? buildEditUrl(serviceId, binding.notifyTemplateId) : undefined;
    const live = templatesById.get(binding.notifyTemplateId);
    if (!live) {
      return {
        templateKey,
        candidates,
        boundTemplateId: binding.notifyTemplateId,
        reviewedVersion: binding.reviewedVersion,
        bindingUpdatedAt: binding.updatedAt,
        bindingUpdatedBy: binding.updatedBy,
        notifyEditUrl,
        status: "fetch_error" as TemplateSyncStatus,
        expectedSubject,
        expectedBody,
        errorMessage: "Bound Notify template could not be found; it may have been deleted.",
      };
    }

    const liveSubject = live.subject ?? "";
    const liveBody = normaliseBody(live.body ?? "");
    const subjectMatch = liveSubject === expectedSubject;
    const bodyMatch = liveBody === expectedBody;

    return {
      templateKey,
      candidates,
      boundTemplateId: binding.notifyTemplateId,
      boundTemplateName: live.name,
      reviewedVersion: binding.reviewedVersion,
      currentLiveVersion: live.version,
      versionDrift: live.version !== binding.reviewedVersion,
      bindingUpdatedAt: binding.updatedAt,
      bindingUpdatedBy: binding.updatedBy,
      notifyEditUrl,
      status: (subjectMatch && bodyMatch ? "in_sync" : "drift") as TemplateSyncStatus,
      liveSubject,
      liveBody,
      expectedSubject,
      expectedBody,
      subjectMatch,
      bodyMatch,
    };
  });
}

async function computeTemplateSyncResults(): Promise<TemplateSyncResult[]> {
  const [{ templates }, bindingsResult] = await Promise.all([
    fetchLiveEmailTemplates(),
    getNotifyTemplateBindings(),
  ]);
  return buildTemplateSyncResults(
    templates,
    bindingsResult.data.notifyTemplateBindings,
    process.env.GOV_NOTIFY_SERVICE_ID?.trim(),
  );
}

function optionalReason(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const getTemplateSyncStatus = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ results: TemplateSyncResult[] }> => {
    requireAdmin(request);
    await enforceRateLimit("getTemplateSyncStatus", request.auth!.uid);
    try {
      return { results: await computeTemplateSyncResults() };
    } catch (e) {
      handleFunctionError(e, "fetching template sync status");
    }
  }
);

export const setNotifyTemplateBinding = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ results: TemplateSyncResult[] }> => {
    requireAdmin(request);
    await enforceRateLimit("setNotifyTemplateBinding", request.auth!.uid);

    const templateKey = requireString(request.data?.templateKey, "templateKey");
    if (!EMAIL_TEMPLATE_MANIFEST[templateKey]) {
      throw new HttpsError("invalid-argument", "Unknown template key");
    }
    const notifyTemplateId = requireString(request.data?.notifyTemplateId, "notifyTemplateId");
    const reviewedVersionRaw = request.data?.reviewedVersion;
    if (!Number.isInteger(reviewedVersionRaw) || Number(reviewedVersionRaw) < 1) {
      throw new HttpsError("invalid-argument", "reviewedVersion must be a positive integer");
    }
    const reviewedVersion = Number(reviewedVersionRaw);

    try {
      const mode = (await resolveRuntimeGovNotifyDeliveryMode("LIVE")).effectiveMode;
      const client = new NotifyClient(govNotifyApiKeyForMode(mode));
      let live: NotifyLiveTemplate;
      try {
        const response = await client.getTemplateById(notifyTemplateId);
        live = response.data as NotifyLiveTemplate;
      } catch {
        throw new HttpsError("not-found", "Notify template could not be found");
      }
      // The frontend dropdown only ever offers exact-name matches, but this
      // callable is the real authority boundary and this table now drives
      // actual sends, so re-assert the match rather than trusting the client.
      if (live.name !== templateKey) {
        throw new HttpsError(
          "failed-precondition",
          "The selected Notify template's name no longer matches this template key exactly"
        );
      }

      const existingResult = await getNotifyTemplateBindings();
      const existing = existingResult.data.notifyTemplateBindings.find((b) => b.templateKey === templateKey);
      const auditAction = !existing
        ? NotifyTemplateBindingAuditAction.CREATED
        : existing.notifyTemplateId !== notifyTemplateId
          ? NotifyTemplateBindingAuditAction.TEMPLATE_CHANGED
          : NotifyTemplateBindingAuditAction.VERSION_REVIEWED;

      await upsertNotifyTemplateBinding({
        templateKey,
        notifyTemplateId,
        reviewedVersion,
        changedBy: request.auth!.uid,
        reason: optionalReason(request.data?.reason),
        auditAction,
        previousValue: existing
          ? JSON.stringify({ notifyTemplateId: existing.notifyTemplateId, reviewedVersion: existing.reviewedVersion })
          : undefined,
        newValue: JSON.stringify({ notifyTemplateId, reviewedVersion }),
      });

      return { results: await computeTemplateSyncResults() };
    } catch (e) {
      handleFunctionError(e, "setting the template binding");
    }
  }
);

export const moveAllNotifyTemplateBindingsToLatestVersion = onCall(
  { region: FUNCTIONS_REGION, secrets: [...govNotifySecrets] },
  async (request): Promise<{ results: TemplateSyncResult[] }> => {
    requireAdmin(request);
    await enforceRateLimit("moveAllNotifyTemplateBindingsToLatestVersion", request.auth!.uid);

    try {
      const [{ templates }, bindingsResult] = await Promise.all([
        fetchLiveEmailTemplates(),
        getNotifyTemplateBindings(),
      ]);
      const templatesById = new Map(templates.map((t) => [t.id, t]));
      const reason = optionalReason(request.data?.reason);

      for (const binding of bindingsResult.data.notifyTemplateBindings) {
        const live = templatesById.get(binding.notifyTemplateId);
        if (!live || live.version === binding.reviewedVersion) continue;
        await upsertNotifyTemplateBinding({
          templateKey: binding.templateKey,
          notifyTemplateId: binding.notifyTemplateId,
          reviewedVersion: live.version,
          changedBy: request.auth!.uid,
          reason,
          auditAction: NotifyTemplateBindingAuditAction.VERSION_REVIEWED,
          previousValue: JSON.stringify({
            notifyTemplateId: binding.notifyTemplateId,
            reviewedVersion: binding.reviewedVersion,
          }),
          newValue: JSON.stringify({ notifyTemplateId: binding.notifyTemplateId, reviewedVersion: live.version }),
        });
      }

      return { results: await computeTemplateSyncResults() };
    } catch (e) {
      handleFunctionError(e, "moving template bindings to their latest version");
    }
  }
);
