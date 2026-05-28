import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getAuth } from "@/app/api/auth/[platform]/route";
import { GET as getCallback } from "@/app/api/auth/[platform]/callback/route";
import { supabaseAdmin } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({ error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({}),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TIKTOK_CLIENT_KEY = "test-key";
  process.env.TIKTOK_CLIENT_SECRET = "test-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeReq(url: string) {
  return new NextRequest(new URL(url, "http://localhost"));
}

describe("auth route", () => {
  it("redirects to platform OAuth URL", async () => {
    const request = makeReq("http://localhost/api/auth/tiktok");
    const response = await getAuth(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(response.status).toBe(302);
    const loc = response.headers.get("location") || "";
    expect(loc).toContain("tiktok.com");
    expect(loc).toContain("client_id=test-key");
    expect(loc).toContain("response_type=code");
    expect(loc).toContain("state=");
  });

  it("returns 400 if client key missing", async () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    const request = makeReq("http://localhost/api/auth/tiktok");
    const response = await getAuth(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("OAuth not configured");
  });

  it("includes PKCE for YouTube", async () => {
    process.env.YOUTUBE_CLIENT_ID = "yt-id";
    process.env.YOUTUBE_CLIENT_SECRET = "yt-secret";

    const request = makeReq("http://localhost/api/auth/youtube");
    const response = await getAuth(request, {
      params: Promise.resolve({ platform: "youtube" }),
    });

    expect(response.status).toBe(302);
    const loc = response.headers.get("location") || "";
    expect(loc).toContain("accounts.google.com");
    expect(loc).toContain("code_challenge=");
    expect(loc).toContain("code_challenge_method=S256");
  });

  it("stores state in DB", async () => {
    const insert = vi.fn().mockReturnValue({ error: null });
    (supabaseAdmin.from as any).mockReturnValue({ insert });

    const request = makeReq("http://localhost/api/auth/tiktok");
    await getAuth(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(insert).toHaveBeenCalled();
    const call = insert.mock.calls[0][0];
    expect(call.platform_id).toBe("tiktok");
    expect(call.state).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("callback route", () => {
  it("exchanges code and redirects to admin on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      }),
    });
    global.fetch = fetchMock as any;

    // mock verifyState
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "s1",
              pkce_code_verifier: null,
              redirect_url: null,
            },
          }),
        }),
      }),
    });

    const deleteEq = vi.fn().mockResolvedValue({});
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "acct-id" } }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce({ select: selectFn }) // verifyState
      .mockReturnValueOnce({ delete: vi.fn().mockReturnValue({ eq: deleteEq }) }) // verifyState cleanup
      .mockReturnValueOnce({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }) // persistTokens lookup
      .mockReturnValueOnce({ insert: insertFn }); // persistTokens insert

    const request = makeReq(
      "http://localhost/api/auth/tiktok/callback?code=abc123&state=xyz"
    );
    const response = await getCallback(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(response.status).toBe(302);
    const loc = response.headers.get("location") || "";
    expect(loc).toContain("/admin?connected=tiktok");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("redirects to admin with error on missing code", async () => {
    const request = makeReq("http://localhost/api/auth/tiktok/callback?state=xyz");
    const response = await getCallback(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(response.status).toBe(302);
    const loc = response.headers.get("location") || "";
    expect(loc).toContain("/admin?error=");
  });

  it("redirects to admin with platform error", async () => {
    const request = makeReq(
      "http://localhost/api/auth/tiktok/callback?error=access_denied&error_description=user+denied"
    );
    const response = await getCallback(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(response.status).toBe(302);
    const loc = response.headers.get("location") || "";
    expect(loc).toContain("user%20denied");
  });

  it("redirects to admin on token exchange failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: () => Promise.resolve({ error: "invalid_grant" }),
    });
    global.fetch = fetchMock as any;

    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "s1", pkce_code_verifier: null, redirect_url: null },
          }),
        }),
      }),
    });
    const deleteEq = vi.fn().mockResolvedValue({});

    (supabaseAdmin.from as any)
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ delete: vi.fn().mockReturnValue({ eq: deleteEq }) });

    const request = makeReq(
      "http://localhost/api/auth/tiktok/callback?code=bad&state=s1"
    );
    const response = await getCallback(request, {
      params: Promise.resolve({ platform: "tiktok" }),
    });

    expect(response.status).toBe(302);
    const loc = response.headers.get("location") || "";
    expect(loc).toContain("/admin?error=");
  });
});
