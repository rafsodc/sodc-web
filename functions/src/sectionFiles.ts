import { createHash, randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import {
  abortSectionFileReplacement,
  beginSectionFileDeletion,
  beginSectionFileReplacement,
  createPendingSectionFile,
  finalizePendingSectionFile,
  finalizeSectionFileReplacement as finalizeReplacementMetadata,
  getSectionFileById,
  listSectionFilesByStatus,
  markSectionFileDeleted,
  SectionFileStatus,
  updateAvailableSectionFileMetadata,
} from "@dataconnect/admin-generated";
import { FUNCTIONS_REGION } from "./constants";
import {
  handleFunctionError,
  requireEnabled,
  requireString,
  validateStringLength,
  validateUUID,
} from "./helpers";
import { enforceRateLimit, type RateLimitedCallableName } from "./rateLimiter";
import { requireSectionAccess, requireSectionModerator } from "./sectionAccess";

const MAX_SECTION_FILE_BYTES = 25 * 1024 * 1024;
const SIGNED_UPLOAD_TTL_MS = 15 * 60 * 1000;
const SIGNED_DOWNLOAD_TTL_MS = 5 * 60 * 1000;
const MAX_FILENAME_LENGTH = 255;
const MAX_DISPLAY_NAME_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 1000;
const LIST_LIMIT = 500;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/csv",
  "application/json",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

type SectionFileRecord = NonNullable<
  Awaited<ReturnType<typeof getSectionFileById>>["data"]["sectionFile"]
>;

interface ValidatedUpload {
  displayName: string;
  originalFilename: string;
  description: string | null;
  contentType: string;
  sizeBytes: number;
}

function bucketName(): string {
  const value = process.env.SECTION_FILES_BUCKET?.trim();
  if (!value) {
    throw new HttpsError("failed-precondition", "Section file storage is not configured");
  }
  if (value.startsWith("gs://") || value.includes("/")) {
    throw new HttpsError("failed-precondition", "Section file storage configuration is invalid");
  }
  return value;
}

function parseSize(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new HttpsError("invalid-argument", "sizeBytes must be a positive integer");
  }
  const size = Number(value);
  if (size > MAX_SECTION_FILE_BYTES) {
    throw new HttpsError(
      "invalid-argument",
      `Files must be no larger than ${MAX_SECTION_FILE_BYTES} bytes`,
    );
  }
  return size;
}

function validateContentType(value: unknown): string {
  const contentType = requireString(value, "contentType").toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new HttpsError("invalid-argument", "This file type is not allowed");
  }
  return contentType;
}

function validateFilename(value: unknown): string {
  const filename = validateStringLength(
    requireString(value, "originalFilename"),
    "originalFilename",
    MAX_FILENAME_LENGTH,
  );
  if (
    filename === "." ||
    filename === ".." ||
    filename.includes("/") ||
    filename.includes("\\") ||
    Array.from(filename).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    })
  ) {
    throw new HttpsError("invalid-argument", "originalFilename is invalid");
  }
  return filename;
}

function validateUpload(data: Record<string, unknown>): ValidatedUpload {
  const rawDescription = data.description;
  return {
    displayName: validateStringLength(
      requireString(data.displayName, "displayName"),
      "displayName",
      MAX_DISPLAY_NAME_LENGTH,
    ),
    originalFilename: validateFilename(data.originalFilename),
    description:
      rawDescription === null || rawDescription === undefined || rawDescription === ""
        ? null
        : validateStringLength(
            requireString(rawDescription, "description"),
            "description",
            MAX_DESCRIPTION_LENGTH,
          ),
    contentType: validateContentType(data.contentType),
    sizeBytes: parseSize(data.sizeBytes),
  };
}

function startsWith(bytes: Buffer, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function validateFileSignature(bytes: Buffer, contentType: string): void {
  const utf8Prefix = bytes.subarray(0, Math.min(bytes.length, 16)).toString("utf8");
  const valid = (() => {
    switch (contentType) {
      case "application/pdf":
        return utf8Prefix.startsWith("%PDF-");
      case "image/png":
        return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      case "image/jpeg":
        return startsWith(bytes, [0xff, 0xd8, 0xff]);
      case "application/msword":
        return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      case "application/rtf":
        return utf8Prefix.startsWith("{\\rtf");
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return (
          startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) &&
          bytes.includes(Buffer.from("word/"))
        );
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return (
          startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) &&
          bytes.includes(Buffer.from("xl/"))
        );
      case "application/vnd.oasis.opendocument.text":
        return (
          startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) &&
          bytes.includes(Buffer.from("application/vnd.oasis.opendocument.text"))
        );
      case "application/json":
        try {
          JSON.parse(bytes.toString("utf8"));
          return true;
        } catch {
          return false;
        }
      case "text/plain":
      case "text/csv":
        return !bytes.includes(0);
      default:
        return false;
    }
  })();
  if (!valid) {
    throw new HttpsError("invalid-argument", "Stored file content does not match its file type");
  }
}

function requestContext(
  request: CallableRequest,
  rateLimitName: RateLimitedCallableName,
): Promise<{ uid: string; isAdmin: boolean }> {
  requireEnabled(request);
  const uid = request.auth!.uid;
  return enforceRateLimit(rateLimitName, uid).then(() => ({
    uid,
    isAdmin: request.auth!.token.admin === true,
  }));
}

function fileResponse(file: SectionFileRecord) {
  return {
    id: file.id,
    sectionId: file.sectionId,
    displayName: file.displayName,
    originalFilename: file.originalFilename,
    description: file.description ?? null,
    contentType: file.contentType,
    sizeBytes: file.sizeBytes,
    uploadedBy: file.uploadedBy,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
}

async function trustedFile(fileId: string, sectionId: string): Promise<SectionFileRecord> {
  const result = await getSectionFileById({ id: fileId });
  const file = result.data?.sectionFile;
  if (!file || file.sectionId !== sectionId || file.status === SectionFileStatus.DELETED) {
    throw new HttpsError("not-found", "File not found");
  }
  return file;
}

async function signedUploadUrl(path: string, contentType: string): Promise<string> {
  const [url] = await getStorage()
    .bucket(bucketName())
    .file(path)
    .getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + SIGNED_UPLOAD_TTL_MS,
      contentType,
    });
  return url;
}

async function inspectUpload(path: string, expected: ValidatedUpload) {
  const file = getStorage().bucket(bucketName()).file(path);
  const [metadata] = await file.getMetadata();
  const actualSize = Number(metadata.size);
  const actualType = String(metadata.contentType ?? "").toLowerCase();
  if (
    !Number.isSafeInteger(actualSize) ||
    actualSize !== expected.sizeBytes ||
    actualSize > MAX_SECTION_FILE_BYTES ||
    actualType !== expected.contentType ||
    !ALLOWED_CONTENT_TYPES.has(actualType)
  ) {
    await file.delete({ ignoreNotFound: true });
    throw new HttpsError("invalid-argument", "Stored file does not match the approved upload");
  }
  const [bytes] = await file.download();
  if (bytes.byteLength !== actualSize) {
    await file.delete({ ignoreNotFound: true });
    throw new HttpsError("invalid-argument", "Stored file size could not be verified");
  }
  try {
    validateFileSignature(bytes, actualType);
  } catch (error) {
    await file.delete({ ignoreNotFound: true });
    throw error;
  }
  return {
    file,
    generation: String(metadata.generation ?? ""),
    checksumSha256: createHash("sha256").update(bytes).digest("hex"),
    contentType: actualType,
    sizeBytes: actualSize,
  };
}

function ensureTransition(updated: number): void {
  if (updated !== 1) {
    throw new HttpsError("failed-precondition", "The file changed; refresh and try again");
  }
}

async function bestEffortDelete(path: string, context: Record<string, string>): Promise<void> {
  try {
    await getStorage().bucket(bucketName()).file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    logger.warn("Section file cleanup deferred to reconciliation", {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const requestSectionFileUpload = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    const { uid, isAdmin } = await requestContext(request, "requestSectionFileUpload");
    const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
    const input = validateUpload(request.data ?? {});
    try {
      await requireSectionModerator(sectionId, uid, isAdmin);
      const fileId = randomUUID();
      const uploadId = randomUUID();
      const pendingPath = `section-file-uploads/${sectionId}/${fileId}/${uploadId}`;
      await createPendingSectionFile({
        id: fileId,
        sectionId,
        pendingStorageObjectPath: pendingPath,
        ...input,
        uploadedBy: uid,
        now: new Date().toISOString(),
      });
      const uploadUrl = await signedUploadUrl(pendingPath, input.contentType);
      logger.info("Section file upload granted", { sectionId, fileId, actorUid: uid });
      return {
        fileId,
        uploadUrl,
        expiresAt: new Date(Date.now() + SIGNED_UPLOAD_TTL_MS).toISOString(),
        requiredHeaders: { "Content-Type": input.contentType },
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      handleFunctionError(error, "requesting section file upload");
    }
  },
);

export const finalizeSectionFileUpload = onCall(
  { region: FUNCTIONS_REGION, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const { uid, isAdmin } = await requestContext(request, "finalizeSectionFileUpload");
    const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
    const fileId = validateUUID(requireString(request.data?.fileId, "fileId"), "fileId");
    try {
      await requireSectionModerator(sectionId, uid, isAdmin);
      const file = await trustedFile(fileId, sectionId);
      if (file.status !== SectionFileStatus.PENDING || !file.pendingStorageObjectPath) {
        throw new HttpsError("failed-precondition", "The upload is not pending");
      }
      const inspected = await inspectUpload(file.pendingStorageObjectPath, {
        displayName: file.displayName,
        originalFilename: file.originalFilename,
        description: file.description ?? null,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
      });
      const finalPath = `section-files/${sectionId}/${fileId}/${inspected.generation}`;
      const finalObject = getStorage().bucket(bucketName()).file(finalPath);
      await inspected.file.copy(finalObject);
      const [finalMetadata] = await finalObject.getMetadata();
      const result = await finalizePendingSectionFile({
        id: fileId,
        pendingStorageObjectPath: file.pendingStorageObjectPath,
        storageObjectPath: finalPath,
        objectGeneration: String(finalMetadata.generation ?? ""),
        checksumSha256: inspected.checksumSha256,
        contentType: inspected.contentType,
        sizeBytes: inspected.sizeBytes,
        updatedBy: uid,
      });
      try {
        ensureTransition(result.data.sectionFile_updateMany);
      } catch (error) {
        await finalObject.delete({ ignoreNotFound: true });
        throw error;
      }
      await bestEffortDelete(file.pendingStorageObjectPath, { sectionId, fileId });
      logger.info("Section file finalized", { sectionId, fileId, actorUid: uid });
      return { fileId };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      handleFunctionError(error, "finalizing section file upload");
    }
  },
);

export const listSectionFiles = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  const { uid, isAdmin } = await requestContext(request, "listSectionFiles");
  const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
  try {
    await requireSectionAccess(sectionId, uid, isAdmin);
    const [available, replacing] = await Promise.all([
      listSectionFilesByStatus({ sectionId, status: SectionFileStatus.AVAILABLE, limit: LIST_LIMIT }),
      listSectionFilesByStatus({ sectionId, status: SectionFileStatus.REPLACING, limit: LIST_LIMIT }),
    ]);
    const files = [...(available.data.sectionFiles ?? []), ...(replacing.data.sectionFiles ?? [])]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(fileResponse);
    return { files };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    handleFunctionError(error, "listing section files");
  }
});

export const requestSectionFileDownload = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    const { uid, isAdmin } = await requestContext(request, "requestSectionFileDownload");
    const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
    const fileId = validateUUID(requireString(request.data?.fileId, "fileId"), "fileId");
    try {
      await requireSectionAccess(sectionId, uid, isAdmin);
      const file = await trustedFile(fileId, sectionId);
      if (
        ![SectionFileStatus.AVAILABLE, SectionFileStatus.REPLACING].includes(file.status) ||
        !file.storageObjectPath
      ) {
        throw new HttpsError("not-found", "File not found");
      }
      const safeFilename = file.originalFilename.replace(/["\r\n]/g, "_");
      const [downloadUrl] = await getStorage()
        .bucket(bucketName())
        .file(file.storageObjectPath)
        .getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + SIGNED_DOWNLOAD_TTL_MS,
          responseDisposition: `attachment; filename="${safeFilename}"`,
          responseType: file.contentType,
        });
      logger.info("Section file download granted", { sectionId, fileId, actorUid: uid });
      return {
        file: fileResponse(file),
        downloadUrl,
        expiresAt: new Date(Date.now() + SIGNED_DOWNLOAD_TTL_MS).toISOString(),
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      handleFunctionError(error, "requesting section file download");
    }
  },
);

export const updateSectionFileMetadata = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    const { uid, isAdmin } = await requestContext(request, "updateSectionFileMetadata");
    const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
    const fileId = validateUUID(requireString(request.data?.fileId, "fileId"), "fileId");
    const displayName = validateStringLength(
      requireString(request.data?.displayName, "displayName"),
      "displayName",
      MAX_DISPLAY_NAME_LENGTH,
    );
    const description =
      request.data?.description === null || request.data?.description === ""
        ? null
        : validateStringLength(
            requireString(request.data?.description, "description"),
            "description",
            MAX_DESCRIPTION_LENGTH,
          );
    try {
      await requireSectionModerator(sectionId, uid, isAdmin);
      await trustedFile(fileId, sectionId);
      const result = await updateAvailableSectionFileMetadata({
        id: fileId,
        displayName,
        description,
        updatedBy: uid,
      });
      ensureTransition(result.data.sectionFile_updateMany);
      return { fileId };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      handleFunctionError(error, "updating section file metadata");
    }
  },
);

export const requestSectionFileReplacement = onCall(
  { region: FUNCTIONS_REGION },
  async (request) => {
    const { uid, isAdmin } = await requestContext(request, "requestSectionFileReplacement");
    const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
    const fileId = validateUUID(requireString(request.data?.fileId, "fileId"), "fileId");
    const originalFilename = validateFilename(request.data?.originalFilename);
    const contentType = validateContentType(request.data?.contentType);
    const sizeBytes = parseSize(request.data?.sizeBytes);
    try {
      await requireSectionModerator(sectionId, uid, isAdmin);
      const file = await trustedFile(fileId, sectionId);
      if (file.status !== SectionFileStatus.AVAILABLE) {
        throw new HttpsError("failed-precondition", "The file cannot be replaced in its current state");
      }
      const pendingPath = `section-file-uploads/${sectionId}/${fileId}/${randomUUID()}`;
      const transition = await beginSectionFileReplacement({
        id: fileId,
        pendingStorageObjectPath: pendingPath,
        updatedBy: uid,
      });
      ensureTransition(transition.data.sectionFile_updateMany);
      try {
        const uploadUrl = await signedUploadUrl(pendingPath, contentType);
        return {
          fileId,
          uploadUrl,
          expiresAt: new Date(Date.now() + SIGNED_UPLOAD_TTL_MS).toISOString(),
          requiredHeaders: { "Content-Type": contentType },
          replacement: { originalFilename, contentType, sizeBytes },
        };
      } catch (error) {
        await abortSectionFileReplacement({
          id: fileId,
          pendingStorageObjectPath: pendingPath,
          updatedBy: uid,
        });
        throw error;
      }
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      handleFunctionError(error, "requesting section file replacement");
    }
  },
);

export const finalizeSectionFileReplacement = onCall(
  { region: FUNCTIONS_REGION, timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const { uid, isAdmin } = await requestContext(request, "finalizeSectionFileReplacement");
    const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
    const fileId = validateUUID(requireString(request.data?.fileId, "fileId"), "fileId");
    const originalFilename = validateFilename(request.data?.originalFilename);
    const contentType = validateContentType(request.data?.contentType);
    const sizeBytes = parseSize(request.data?.sizeBytes);
    try {
      await requireSectionModerator(sectionId, uid, isAdmin);
      const file = await trustedFile(fileId, sectionId);
      if (
        file.status !== SectionFileStatus.REPLACING ||
        !file.pendingStorageObjectPath ||
        !file.storageObjectPath
      ) {
        throw new HttpsError("failed-precondition", "The replacement is not pending");
      }
      const inspected = await inspectUpload(file.pendingStorageObjectPath, {
        displayName: file.displayName,
        originalFilename,
        description: file.description ?? null,
        contentType,
        sizeBytes,
      });
      const finalPath = `section-files/${sectionId}/${fileId}/${inspected.generation}`;
      const finalObject = getStorage().bucket(bucketName()).file(finalPath);
      await inspected.file.copy(finalObject);
      const [finalMetadata] = await finalObject.getMetadata();
      const transition = await finalizeReplacementMetadata({
        id: fileId,
        pendingStorageObjectPath: file.pendingStorageObjectPath,
        storageObjectPath: finalPath,
        originalFilename,
        objectGeneration: String(finalMetadata.generation ?? ""),
        checksumSha256: inspected.checksumSha256,
        contentType: inspected.contentType,
        sizeBytes: inspected.sizeBytes,
        updatedBy: uid,
      });
      try {
        ensureTransition(transition.data.sectionFile_updateMany);
      } catch (error) {
        await finalObject.delete({ ignoreNotFound: true });
        throw error;
      }
      await Promise.all([
        bestEffortDelete(file.pendingStorageObjectPath, { sectionId, fileId }),
        bestEffortDelete(file.storageObjectPath, { sectionId, fileId }),
      ]);
      return { fileId };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      handleFunctionError(error, "finalizing section file replacement");
    }
  },
);

export const deleteSectionFile = onCall({ region: FUNCTIONS_REGION }, async (request) => {
  const { uid, isAdmin } = await requestContext(request, "deleteSectionFile");
  const sectionId = validateUUID(requireString(request.data?.sectionId, "sectionId"), "sectionId");
  const fileId = validateUUID(requireString(request.data?.fileId, "fileId"), "fileId");
  try {
    await requireSectionModerator(sectionId, uid, isAdmin);
    const file = await trustedFile(fileId, sectionId);
    const transition = await beginSectionFileDeletion({ id: fileId, updatedBy: uid });
    ensureTransition(transition.data.sectionFile_updateMany);
    const bucket = getStorage().bucket(bucketName());
    await Promise.all(
      [file.storageObjectPath, file.pendingStorageObjectPath]
        .filter((path): path is string => Boolean(path))
        .map((path) => bucket.file(path).delete({ ignoreNotFound: true })),
    );
    const deletedAt = new Date().toISOString();
    const marked = await markSectionFileDeleted({ id: fileId, deletedAt, updatedBy: uid });
    ensureTransition(marked.data.sectionFile_updateMany);
    logger.info("Section file deleted", { sectionId, fileId, actorUid: uid });
    return { fileId };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    handleFunctionError(error, "deleting section file");
  }
});
