import { describe, it, expect, vi } from "vitest";
import { fetchWithTimeout } from "./fetch-timeout";

describe("fetchWithTimeout", () => {
  it("returns response when fetch succeeds quickly", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response("ok", { status: 200 }))
    );
    const res = await fetchWithTimeout("http://test.local/data");
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("throws timeout error when fetch hangs", async () => {
    vi.stubGlobal("fetch", (_input: any, init: any) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });
    await expect(
      fetchWithTimeout("http://test.local/slow", {}, 50)
    ).rejects.toThrow("timeout");
    vi.unstubAllGlobals();
  });
});
