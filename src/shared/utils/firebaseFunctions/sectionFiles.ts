import { httpsCallable } from "firebase/functions";
import { functions } from "../../../config/firebase";

export interface SectionFile {
  id: string;
  sectionId: string;
  displayName: string;
  originalFilename: string;
  description: string | null;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  canonicalUrl: string;
}

export interface SectionFileMetadataInput {
  displayName: string;
  description: string | null;
}

interface UploadGrant {
  fileId: string;
  uploadUrl: string;
  expiresAt: string;
  requiredHeaders: Record<string, string>;
}

async function putFile(grant: UploadGrant, file: File): Promise<void> {
  const response = await fetch(grant.uploadUrl, {
    method: "PUT",
    headers: grant.requiredHeaders,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}

export async function listSectionFiles(sectionId: string): Promise<SectionFile[]> {
  const callable = httpsCallable<{ sectionId: string }, { files: SectionFile[] }>(
    functions,
    "listSectionFiles",
  );
  return (await callable({ sectionId })).data.files;
}

export async function requestSectionFileDownload(
  sectionId: string,
  fileId: string,
): Promise<{ file: SectionFile; downloadUrl: string; expiresAt: string }> {
  const callable = httpsCallable<
    { sectionId: string; fileId: string },
    { file: SectionFile; downloadUrl: string; expiresAt: string }
  >(functions, "requestSectionFileDownload");
  return (await callable({ sectionId, fileId })).data;
}

export async function uploadSectionFile(
  sectionId: string,
  file: File,
  metadata: SectionFileMetadataInput,
  onStage?: (stage: "uploading" | "scanning") => void,
): Promise<string> {
  const requestGrant = httpsCallable<
    {
      sectionId: string;
      displayName: string;
      originalFilename: string;
      description: string | null;
      contentType: string;
      sizeBytes: number;
    },
    UploadGrant
  >(functions, "requestSectionFileUpload");
  const grant = (await requestGrant({
    sectionId,
    ...metadata,
    originalFilename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  })).data;
  onStage?.("uploading");
  await putFile(grant, file);
  onStage?.("scanning");
  const finalize = httpsCallable<{ sectionId: string; fileId: string }, { fileId: string }>(
    functions,
    "finalizeSectionFileUpload",
  );
  return (await finalize({ sectionId, fileId: grant.fileId })).data.fileId;
}

export async function updateSectionFileMetadata(
  sectionId: string,
  fileId: string,
  metadata: SectionFileMetadataInput,
): Promise<void> {
  const callable = httpsCallable<
    { sectionId: string; fileId: string } & SectionFileMetadataInput,
    { fileId: string }
  >(functions, "updateSectionFileMetadata");
  await callable({ sectionId, fileId, ...metadata });
}

export async function replaceSectionFile(
  sectionId: string,
  fileId: string,
  file: File,
  onStage?: (stage: "uploading" | "scanning") => void,
): Promise<void> {
  const requestGrant = httpsCallable<
    {
      sectionId: string;
      fileId: string;
      originalFilename: string;
      contentType: string;
      sizeBytes: number;
    },
    UploadGrant & {
      replacement: { originalFilename: string; contentType: string; sizeBytes: number };
    }
  >(functions, "requestSectionFileReplacement");
  const grant = (await requestGrant({
    sectionId,
    fileId,
    originalFilename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  })).data;
  try {
    onStage?.("uploading");
    await putFile(grant, file);
    onStage?.("scanning");
    const finalize = httpsCallable<{ sectionId: string; fileId: string }, { fileId: string }>(
      functions,
      "finalizeSectionFileReplacement",
    );
    await finalize({ sectionId, fileId });
  } catch (error) {
    const cancel = httpsCallable<{ sectionId: string; fileId: string }, { fileId: string }>(
      functions,
      "cancelSectionFileReplacement",
    );
    await cancel({ sectionId, fileId }).catch(() => undefined);
    throw error;
  }
}

export async function deleteSectionFile(sectionId: string, fileId: string): Promise<void> {
  const callable = httpsCallable<{ sectionId: string; fileId: string }, { fileId: string }>(
    functions,
    "deleteSectionFile",
  );
  await callable({ sectionId, fileId });
}
