export const MAX_BYTES = 10 * 1024 * 1024; // mirrors backend MAX_FILE_BYTES (10 MB)
export const ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf"] as const;
export const DOCUMENT_TYPES = ["DEED", "KHATIAN", "MUTATION", "OTHER"] as const;
export const LAND_ID_RE = /^LP-\d{5}$/;
export const ACCEPT = ".jpg,.jpeg,.png,.pdf";

export type UploadErrorCode =
  | "EMPTY_FILE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "FILE_TYPE_MISMATCH"
  | "IMAGE_TOO_LARGE"
  | "PDF_TOO_MANY_PAGES"
  | "LAND_NOT_FOUND"
  | "PERMISSION"
  | "NETWORK"
  | "GENERIC";

export const extOf = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
};

/** Client-side pre-check only; the server re-validates everything (magic bytes, pixels, pages). */
export function validateFile(file: Pick<File, "name" | "size">): UploadErrorCode | null {
  if (file.size === 0) return "EMPTY_FILE";
  if (!(ALLOWED_EXT as readonly string[]).includes(extOf(file.name))) return "UNSUPPORTED_FILE_TYPE";
  if (file.size > MAX_BYTES) return "FILE_TOO_LARGE";
  return null;
}

const SERVER_CODES: UploadErrorCode[] = [
  "EMPTY_FILE",
  "UNSUPPORTED_FILE_TYPE",
  "FILE_TYPE_MISMATCH",
  "FILE_TOO_LARGE",
  "IMAGE_TOO_LARGE",
  "PDF_TOO_MANY_PAGES",
  "LAND_NOT_FOUND",
];

export function errorCodeFromApi(e: { status: number; code: string }): UploadErrorCode {
  if (e.code === "NETWORK_ERROR") return "NETWORK";
  if (e.status === 403) return "PERMISSION";
  const hit = SERVER_CODES.find((c) => c === e.code);
  return hit ?? "GENERIC";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
