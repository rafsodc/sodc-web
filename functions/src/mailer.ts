import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import {NotifyClient} from "notifications-node-client";
import {sanitizeMailerError} from "./mailerErrors";

export const govNotifyApiKey = defineSecret("GOV_NOTIFY_API_KEY");

export const GOV_NOTIFY_EMAIL_REPLY_TO_ID_ENV = "GOV_NOTIFY_EMAIL_REPLY_TO_ID";
export const GOV_NOTIFY_TEMPLATE_ENV_PREFIX = "GOV_NOTIFY_TEMPLATE_";
export const GOV_NOTIFY_PROVIDER = "govuk_notify";

export type TemplatePersonalisationValue = string | number | boolean | null | undefined;
export type TemplatePersonalisation = Record<string, TemplatePersonalisationValue>;
export type TransactionalEmailPayloads<TPayloads> = {
  [K in keyof TPayloads]: TemplatePersonalisation;
};

export interface TransactionalEmailRequest<
  TTemplateName extends string,
  TPayload extends TemplatePersonalisation
> {
  templateName: TTemplateName;
  to: string;
  personalisation: TPayload;
  reference?: string;
}

export interface TransactionalEmailResult {
  provider: typeof GOV_NOTIFY_PROVIDER;
  providerNotificationId?: string;
  reference?: string;
}

export interface TransactionalMailer<
  TPayloads extends TransactionalEmailPayloads<TPayloads>
> {
  sendEmail<TTemplateName extends Extract<keyof TPayloads, string>>(
    request: TransactionalEmailRequest<TTemplateName, TPayloads[TTemplateName]>
  ): Promise<TransactionalEmailResult>;
}

export interface NotifyEmailClient {
  sendEmail(
    templateId: string,
    emailAddress: string,
    options?: {
      personalisation?: TemplatePersonalisation;
      reference?: string;
      emailReplyToId?: string;
    }
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

export interface GovNotifyMailerOptions<
  TPayloads extends TransactionalEmailPayloads<TPayloads>
> {
  apiKey?: string;
  templateIds: Partial<Record<Extract<keyof TPayloads, string>, string | undefined>>;
  emailReplyToId?: string;
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
  env: NodeJS.ProcessEnv = process.env
): Partial<Record<TTemplateName, string>> {
  return Object.fromEntries(
    templateNames.flatMap((templateName) => {
      const value = maybeNonEmpty(env[govNotifyTemplateEnvVarName(templateName)]);
      return value ? [[templateName, value]] : [];
    })
  ) as Partial<Record<TTemplateName, string>>;
}

export function getGovNotifyEmailReplyToId(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return maybeNonEmpty(env[GOV_NOTIFY_EMAIL_REPLY_TO_ID_ENV]);
}

export function createGovNotifyMailer<
  TPayloads extends TransactionalEmailPayloads<TPayloads>
>(options: GovNotifyMailerOptions<TPayloads>): TransactionalMailer<TPayloads> {
  const activeLogger = options.logger ?? logger;
  const clientFactory = options.clientFactory ?? createNotifyClient;

  return {
    async sendEmail<TTemplateName extends Extract<keyof TPayloads, string>>(
      request: TransactionalEmailRequest<TTemplateName, TPayloads[TTemplateName]>
    ): Promise<TransactionalEmailResult> {
      try {
        const apiKey = requiredConfig(options.apiKey, "GOV_NOTIFY_API_KEY");
        const templateId = requiredConfig(
          options.templateIds[request.templateName],
          govNotifyTemplateEnvVarName(request.templateName)
        );
        const client = clientFactory(apiKey);
        const response = await client.sendEmail(templateId, request.to, {
          personalisation: request.personalisation,
          reference: request.reference,
          emailReplyToId: options.emailReplyToId,
        });
        const providerNotificationId = maybeNonEmpty(response.data?.id);
        const reference = maybeNonEmpty(response.data?.reference) ?? request.reference;
        activeLogger.info("transactional email sent", {
          provider: GOV_NOTIFY_PROVIDER,
          templateName: request.templateName,
          reference,
          providerNotificationId,
        });
        return {
          provider: GOV_NOTIFY_PROVIDER,
          providerNotificationId,
          reference,
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

export function createConfiguredGovNotifyMailer<
  TPayloads extends TransactionalEmailPayloads<TPayloads>
>(
  templateNames: readonly Extract<keyof TPayloads, string>[],
  env: NodeJS.ProcessEnv = process.env
): TransactionalMailer<TPayloads> {
  return createGovNotifyMailer<TPayloads>({
    apiKey: govNotifyApiKey.value(),
    templateIds: readGovNotifyTemplateIds(templateNames, env),
    emailReplyToId: getGovNotifyEmailReplyToId(env),
  });
}

export {sanitizeMailerError};
