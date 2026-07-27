import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  abandonPendingSectionFile,
  abortSectionFileReplacement,
  listStaleSectionFiles,
  markSectionFileDeleted,
  recordSectionFileAudit,
  SectionFileStatus,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";

const STALE_AFTER_MS = 2 * 60 * 60 * 1000;
const BATCH_LIMIT = 100;

function configuredBucket() {
  const name = process.env.SECTION_FILES_BUCKET?.trim();
  if (!name || name.startsWith("gs://") || name.includes("/")) {
    throw new Error("SECTION_FILES_BUCKET is not configured correctly");
  }
  return getStorage().bucket(name);
}

async function audit(
  row: { id: string; sectionId: string },
  outcome: "SUCCESS" | "FAILED",
  detail: string,
) {
  await recordSectionFileAudit({
    sectionId: row.sectionId,
    fileId: row.id,
    actorUid: "section-file-reconciliation",
    action: "RECONCILIATION",
    outcome,
    detail,
  });
}

export const reconcileSectionFiles = onSchedule(
  {
    schedule: "every 30 minutes",
    region: FUNCTIONS_REGION,
    timeoutSeconds: 300,
    maxInstances: 1,
  },
  async () => {
    const updatedBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    const result = await listStaleSectionFiles({ updatedBefore, limit: BATCH_LIMIT });
    const rows = result.data.sectionFiles ?? [];
    const bucket = configuredBucket();
    const summary = { inspected: rows.length, repaired: 0, failed: 0 };

    for (const row of rows) {
      try {
        if (row.status === SectionFileStatus.PENDING) {
          if (row.pendingStorageObjectPath) {
            await bucket.file(row.pendingStorageObjectPath).delete({ ignoreNotFound: true });
          }
          const abandoned = await abandonPendingSectionFile({
            id: row.id,
            updatedBefore,
          });
          if (abandoned.data.sectionFile_updateMany !== 1) continue;
          await audit(row, "SUCCESS", "abandoned-pending-upload");
        } else if (row.status === SectionFileStatus.REPLACING && row.pendingStorageObjectPath) {
          await bucket.file(row.pendingStorageObjectPath).delete({ ignoreNotFound: true });
          const aborted = await abortSectionFileReplacement({
            id: row.id,
            pendingStorageObjectPath: row.pendingStorageObjectPath,
            updatedBy: "section-file-reconciliation",
          });
          if (aborted.data.sectionFile_updateMany !== 1) continue;
          await audit(row, "SUCCESS", "aborted-stale-replacement");
        } else if (row.status === SectionFileStatus.DELETING) {
          for (const path of [row.storageObjectPath, row.pendingStorageObjectPath]) {
            if (path) await bucket.file(path).delete({ ignoreNotFound: true });
          }
          const deletedAt = new Date().toISOString();
          const marked = await markSectionFileDeleted({
            id: row.id,
            deletedAt,
            updatedBy: "section-file-reconciliation",
          });
          if (marked.data.sectionFile_updateMany !== 1) continue;
          await audit(row, "SUCCESS", "completed-stuck-deletion");
        } else {
          continue;
        }
        summary.repaired += 1;
      } catch (error) {
        summary.failed += 1;
        logger.error("Section file reconciliation failed", {
          sectionId: row.sectionId,
          fileId: row.id,
          status: row.status,
          error: error instanceof Error ? error.message : String(error),
        });
        await audit(row, "FAILED", "repair-failed").catch(() => undefined);
      }
    }
    logger.info("Section file reconciliation completed", summary);
  },
);
