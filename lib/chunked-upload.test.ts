import { describe, it, expect, vi, beforeEach } from "vitest";
import { uploadInChunks } from "./chunked-upload";

vi.mock("./fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "./fetch-timeout";

describe("uploadInChunks", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uploads a small buffer in one chunk", async () => {
    const buf = new Uint8Array([1, 2, 3, 4]).buffer;
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      new Response('{"id": "vid123"}', { status: 200 })
    );

    const res = await uploadInChunks("http://up", buf, 1024);
    expect(res.status).toBe(200);

    const call = vi.mocked(fetchWithTimeout).mock.calls[0];
    const opts = call[1] as any;
    expect(opts.headers["Content-Range"]).toBe("bytes 0-3/4");
  });

  it("splits large buffer into multiple chunks", async () => {
    const buf = new Uint8Array(10).fill(0).buffer;
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(new Response("", { status: 308, headers: { range: "bytes=0-4" } }))
      .mockResolvedValueOnce(new Response('{"id":"x"}', { status: 200 }));

    await uploadInChunks("http://up", buf, 5);
    expect(vi.mocked(fetchWithTimeout)).toHaveBeenCalledTimes(2);

    const secondCall = vi.mocked(fetchWithTimeout).mock.calls[1];
    const opts = secondCall[1] as any;
    expect(opts.headers["Content-Range"]).toBe("bytes 5-9/10");
  });

  it("throws on non-308/200 response", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      new Response("bad", { status: 403 })
    );
    await expect(uploadInChunks("http://up", new ArrayBuffer(4), 1024)).rejects.toThrow(
      "403"
    );
  });
});
