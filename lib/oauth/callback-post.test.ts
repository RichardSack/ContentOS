import { describe, it, expect, vi } from "vitest";
import { fetchLinkedInOwnerUrn } from "./callback-post";

vi.mock("@/lib/fetch-timeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from "@/lib/fetch-timeout";

describe("fetchLinkedInOwnerUrn", () => {
  it("returns formatted URN when profile fetch succeeds", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc123" }), { status: 200 })
    );
    const urn = await fetchLinkedInOwnerUrn("token123");
    expect(urn).toBe("urn:li:person:abc123");
  });

  it("returns null when profile fetch fails", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      new Response("", { status: 401 })
    );
    const urn = await fetchLinkedInOwnerUrn("badtoken");
    expect(urn).toBeNull();
  });

  it("returns null when id field is missing", async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      new Response(JSON.stringify({ firstName: "Max" }), { status: 200 })
    );
    const urn = await fetchLinkedInOwnerUrn("token123");
    expect(urn).toBeNull();
  });
});
