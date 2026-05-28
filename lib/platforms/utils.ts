/**
 * Shared utility: downloads a video from a signed URL into memory.
 *
 * WARNING: Serverless functions have memory limits. Very large videos
 * may fail here. For production with heavy files, consider chunked
 * download or a background worker with larger resource limits.
 */
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export async function downloadVideo(url: string): Promise<{
  buffer: ArrayBuffer;
  size: number;
  contentType: string;
}> {
  const res = await fetchWithTimeout(url, { method: "GET" });
  if (!res.ok) {
    throw new Error(
      `Failed to download video from temporary URL: ${res.status} ${res.statusText}`
    );
  }
  const size = Number(res.headers.get("content-length") || 0);
  const contentType = res.headers.get("content-type") || "video/*";
  const buffer = await res.arrayBuffer();
  return { buffer, size, contentType };
}
