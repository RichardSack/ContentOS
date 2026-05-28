import { describe, it, expect } from "vitest";
import { validateUpload } from "./validate";

function fakeFile(name: string, type: string, size: number): File {
  const blob = new File(["x"], name, { type });
  Object.defineProperty(blob, "size", { value: size, writable: false });
  return blob;
}

describe("validateUpload", () => {
  it("accepts a valid mp4 video", () => {
    const res = validateUpload(fakeFile("clip.mp4", "video/mp4", 1024));
    expect(res.ok).toBe(true);
  });

  it("rejects non-video MIME type", () => {
    const res = validateUpload(fakeFile("doc.pdf", "application/pdf", 1024));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
    expect(res.error).toContain("video");
  });

  it("rejects disallowed extension", () => {
    const res = validateUpload(fakeFile("archive.zip", "video/zip", 1024));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(415);
    expect(res.error).toContain("extension");
  });

  it("rejects files over 500MB", () => {
    const res = validateUpload(fakeFile("big.mp4", "video/mp4", 501 * 1024 * 1024));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(413);
    expect(res.error).toContain("500");
  });

  it("accepts exactly 500MB", () => {
    const res = validateUpload(fakeFile("edge.mp4", "video/mp4", 500 * 1024 * 1024));
    expect(res.ok).toBe(true);
  });
});
