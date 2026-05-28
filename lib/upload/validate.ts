/**
 * Upload validation helpers.
 */

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB (YouTube + serverless limit)
const ALLOWED_MIME_PREFIXES = ["video/"];
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];

export interface ValidationResult {
  ok: boolean;
  error?: string;
  status: number;
}

export function validateUpload(file: File): ValidationResult {
  // Size check
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File too large. Max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB allowed.`,
      status: 413,
    };
  }

  // MIME type prefix
  const mimeOk = ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
  if (!mimeOk) {
    return {
      ok: false,
      error: `Invalid file type "${file.type}". Only video files allowed.`,
      status: 415,
    };
  }

  // Extension whitelist ( belt-and-suspenders: client can spoof MIME type )
  const nameLower = file.name.toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
  if (!extOk) {
    return {
      ok: false,
      error: `Unsupported extension. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      status: 415,
    };
  }

  return { ok: true, status: 200 };
}
