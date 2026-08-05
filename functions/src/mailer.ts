import * as logger from "firebase-functions/logger";
import { NotifyClient } from "notifications-node-client";
import { createHash } from "node:crypto";
import { sanitizeMailerError } from "./mailerErrors";
import {
  govNotifyLiveApiKey,
  govNotifyApiKeyForMode,
  govNotifyReferenceForMode,
  govNotifySecrets,
  govNotifyTeamApiKey,
  govNotifyTestApiKey,
  resolveGovNotifyDeliveryMode,
  type GovNotifyDeliveryMode,
  type GovNotifyDeliveryResolution,
} from "./govNotifyDeliveryMode";
import { resolveRuntimeGovNotifyDeliveryMode } from "./govNotifyDeliveryConfiguration";
import { resolveNotifyReplyToForAutomatedEmail } from "./notifyReplyToConfiguration";
import { resolveNotifyTemplateId } from "./notifyTemplateBindingConfiguration";
import {
  GOV_NOTIFY_EMAIL_REPLY_TO_ID_ENV,
  getGovNotifyEmailReplyToId,
} from "./govNotifyReplyToId";

export {
  govNotifyLiveApiKey,
  govNotifyApiKeyForMode,
  govNotifySecrets,
  govNotifyTeamApiKey,
  govNotifyTestApiKey,
};

export { GOV_NOTIFY_EMAIL_REPLY_TO_ID_ENV, getGovNotifyEmailReplyToId };
export const GOV_NOTIFY_TEMPLATE_ENV_PREFIX = "GOV_NOTIFY_TEMPLATE_";
export const GOV_NOTIFY_PROVIDER = "govuk_notify";

export type TemplatePersonalisationValue = string | number | boolean | null | undefined;
export type TemplatePersonalisation = Record<string, TemplatePersonalisationValue>;
export type TransactionalEmailPayloads<TPayloads> = {
  [K in keyof TPayloads]: TemplatePersonalisation;
};

export interface TransactionalEmailRequest<
  TTemplateName extends string,
  TPayload extends TemplatePersonalisation,
> {
  templateName: TTemplateName;
  to: string;
  personalisation: TPayload;
  reference?: string;
  requestedDeliveryMode?: GovNotifyDeliveryMode;
}

export interface TransactionalEmailResult {
  provider: typeof GOV_NOTIFY_PROVIDER;
  providerNotificationId?: string;
  reference?: string;
  deliveryMode: GovNotifyDeliveryResolution;
}

export interface TransactionalMailer<TPayloads extends TransactionalEmailPayloads<TPayloads>> {
  sendEmail<TTemplateName extends Extract<keyof TPayloads, string>>(
    request: TransactionalEmailRequest<TTemplateName, TPayloads[TTemplateName]>,
  ): Promise<TransactionalEmailResult>;
}

export interface NotifyEmailClient {
  getNotifications(
    templateType?: string,
    status?: string,
    reference?: string,
    olderThanId?: string,
  ): Promise<{
    data?: {
      notifications?: Array<{
        id?: string;
        reference?: string;
      }>;
    };
  }>;
  sendEmail(
    templateId: string,
    emailAddress: string,
    options?: {
      personalisation?: TemplatePersonalisation;
      reference?: string;
      emailReplyToId?: string;
    },
  ): Promise<{
    data?: {
      id?: string;
      reference?: string;
    };
  }>;
}

export interface MailerLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface GovNotifyMailerOptions<TPayloads extends TransactionalEmailPayloads<TPayloads>> {
  apiKey?: string;
  apiKeys?: Partial<Record<GovNotifyDeliveryMode, string | undefined>>;
  siteMode?: GovNotifyDeliveryMode;
  resolveDeliveryMode?: (
    requestedMode: GovNotifyDeliveryMode,
  ) => Promise<GovNotifyDeliveryResolution>;
  templateIds: Partial<Record<Extract<keyof TPayloads, string>, string | undefined>>;
  resolveTemplateId?: (templateName: Extract<keyof TPayloads, string>) => Promise<string | undefined>;
  emailReplyToId?: string;
  resolveEmailReplyToId?: (templateName: Extract<keyof TPayloads, string>) => Promise<string | undefined>;
  clientFactory?: (apiKey: string) => NotifyEmailClient;
  logger?: MailerLogger;
}

export class MailerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailerConfigurationError";
  }
}

function requiredConfig(value: string | undefined, name: string): string {
  if (!value || value.trim().length === 0) {
    throw new MailerConfigurationError(`${name} is not configured`);
  }
  return value;
}

function createNotifyClient(apiKey: string): NotifyEmailClient {
  return new NotifyClient(apiKey);
}

function maybeNonEmpty(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

export function govNotifyTemplateEnvVarName(templateName: string): string {
  const envSuffix = templateName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return `${GOV_NOTIFY_TEMPLATE_ENV_PREFIX}${envSuffix}`;
}

export function readGovNotifyTemplateIds<TTemplateName extends string>(
  templateNames: readonly TTemplateName[],
  env: NodeJS.ProcessEnv = process.env,
): Partial<Record<TTemplateName, string>> {
  return Object.fromEntries(
    templateNames.flatMap((templateName) => {
      const value = maybeNonEmpty(env[govNotifyTemplateEnvVarName(templateName)]);
      return value ? [[templateName, value]] : [];
    }),
  ) as Partial<Record<TTemplateName, string>>;
}

/**
 * Keeps provider-side idempotency scoped to one recipient without placing their
 * email address in GOV.UK Notify metadata.
 */
export function recipientScopedNotifyReference(reference: string, recipientEmail: string): string {
  const recipientHash = createHash("sha256")
    .update(recipientEmail.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  return `${reference}:${recipientHash}`;
}

export function createGovNotifyMailer<TPayloads extends TransactionalEmailPayloads<TPayloads>>(
  options: GovNotifyMailerOptions<TPayloads>,
): TransactionalMailer<TPayloads> {
  const activeLogger = options.logger ?? logger;
  const clientFactory = options.clientFactory ?? createNotifyClient;

  return {
    async sendEmail<TTemplateName extends Extract<keyof TPayloads, string>>(
      request: TransactionalEmailRequest<TTemplateName, TPayloads[TTemplateName]>,
    ): Promise<TransactionalEmailResult> {
      try {
        const requestedMode = request.requestedDeliveryMode ?? "LIVE";
        const deliveryMode = options.resolveDeliveryMode
          ? await options.resolveDeliveryMode(requestedMode)
          : (() => {
              const siteMode = options.siteMode ?? "LIVE";
              return {
                requestedMode,
                siteMode,
                effectiveMode: resolveGovNotifyDeliveryMode(siteMode, requestedMode),
              };
            })();
        const { effectiveMode } = deliveryMode;
        const secretName = effectiveMode === "LIVE"
          ? "GOV_NOTIFY_LIVE_API_KEY"
          : effectiveMode === "SIMULATION"
            ? "GOV_NOTIFY_TEST_API_KEY"
            : "GOV_NOTIFY_TEAM_API_KEY";
        const apiKey = requiredConfig(
          options.apiKeys?.[effectiveMode] ?? options.apiKey,
          secretName,
        );
        const templateId = requiredConfig(
          options.resolveTemplateId
            ? (await options.resolveTemplateId(request.templateName)) ?? options.templateIds[request.templateName]
            : options.templateIds[request.templateName],
          govNotifyTemplateEnvVarName(request.templateName),
        );
        const client = clientFactory(apiKey);
        const providerReference = request.reference
          ? govNotifyReferenceForMode(request.reference, effectiveMode)
          : undefined;
        if (providerReference) {
          const existing = await client.getNotifications("email", undefined, providerReference);
          const existingNotification = existing.data?.notifications?.find(
            (notification) => notification.reference === providerReference,
          );
          const existingNotificationId = maybeNonEmpty(existingNotification?.id);
          if (existingNotificationId) {
            activeLogger.info("transactional email already accepted by provider", {
              provider: GOV_NOTIFY_PROVIDER,
              templateName: request.templateName,
              reference: providerReference,
              deliveryMode,
              providerNotificationId: existingNotificationId,
            });
            return {
              provider: GOV_NOTIFY_PROVIDER,
              providerNotificationId: existingNotificationId,
              reference: providerReference,
              deliveryMode,
            };
          }
        }
        const response = await client.sendEmail(templateId, request.to, {
          personalisation: request.personalisation,
          reference: providerReference,
          emailReplyToId: options.resolveEmailReplyToId
            ? await options.resolveEmailReplyToId(request.templateName)
            : options.emailReplyToId,
        });
        const providerNotificationId = maybeNonEmpty(response.data?.id);
        const reference = maybeNonEmpty(response.data?.reference) ?? request.reference;
        activeLogger.info("transactional email sent", {
          provider: GOV_NOTIFY_PROVIDER,
          templateName: request.templateName,
          reference,
          providerNotificationId,
          deliveryMode,
        });
        return {
          provider: GOV_NOTIFY_PROVIDER,
          providerNotificationId,
          reference,
          deliveryMode,
        };
      } catch (error) {
        activeLogger.error("transactional email failed", {
          provider: GOV_NOTIFY_PROVIDER,
          templateName: request.templateName,
          reference: request.reference,
          error: sanitizeMailerError(error),
        });
        throw error;
      }
    },
  };
}

export function createConfiguredGovNotifyMailer<TPayloads extends TransactionalEmailPayloads<TPayloads>>(
  templateNames: readonly Extract<keyof TPayloads, string>[],
  env: NodeJS.ProcessEnv = process.env,
): TransactionalMailer<TPayloads> {
  return createGovNotifyMailer<TPayloads>({
    apiKeys: {
      LIVE: govNotifyApiKeyForMode("LIVE"),
      SIMULATION: govNotifyApiKeyForMode("SIMULATION"),
      TEAM_TEST: govNotifyApiKeyForMode("TEAM_TEST"),
    },
    resolveDeliveryMode: resolveRuntimeGovNotifyDeliveryMode,
    templateIds: readGovNotifyTemplateIds(templateNames, env),
    resolveTemplateId: (templateName) => resolveNotifyTemplateId(templateName),
    resolveEmailReplyToId: async (templateName) =>
      (await resolveNotifyReplyToForAutomatedEmail(templateName, env)).notifyUuid,
  });
}

export { sanitizeMailerError };
