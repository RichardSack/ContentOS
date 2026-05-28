/**
 * Fetch with timeout using AbortController.
 * Prevents hanging requests in serverless environments.
 */

const DEFAULT_TIMEOUT_MS = 30000; // 30s

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${input}`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}
