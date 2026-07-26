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
