/**
 * YouTube-style resumable chunked upload.
 * Splits an ArrayBuffer into chunks and uploads with Content-Range headers.
 * Supports resume on 308 Resume Incomplete responses.
 */

import { fetchWithTimeout } from "./fetch-timeout";

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MB

export async function uploadInChunks(
  uploadUrl: string,
  buffer: ArrayBuffer,
  chunkSize = DEFAULT_CHUNK_SIZE
): Promise<Response> {
  const total = buffer.byteLength;
  let uploaded = 0;

  while (uploaded < total) {
    const end = Math.min(uploaded + chunkSize - 1, total - 1);
    const chunk = buffer.slice(uploaded, end + 1);

    const res = await fetchWithTimeout(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${uploaded}-${end}/${total}`,
        "Content-Length": String(chunk.byteLength),
      },
      body: chunk,
    });

    if (res.status === 308) {
      // Resume Incomplete — parse how much the server actually received
      const range = res.headers.get("range"); // e.g. "bytes=0-8388607"
      if (range) {
        const match = range.match(/bytes=\d+-(\d+)/);
        if (match) {
          uploaded = parseInt(match[1], 10) + 1;
          continue;
        }
      }
      // No Range header but 308: just retry same chunk
      continue;
    }

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Chunk upload failed (${res.status}): ${err}`);
    }

    uploaded = end + 1;
  }

  // Final chunk succeeded — server returns 200/201 with the created resource
  return new Response("", { status: 200 });
}
