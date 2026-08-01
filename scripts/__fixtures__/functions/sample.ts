import { onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onTaskDispatched } from "firebase-functions/v2/tasks";

export const sampleCallable = onCall(async () => ({ ok: true }));
export const sampleWebhook = onRequest(async (_request, response) => response.sendStatus(204));
export const sampleTask = onTaskDispatched<{ id: string }>(async () => undefined);
export const sampleSecret = defineSecret("SAMPLE_SECRET");
