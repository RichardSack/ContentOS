import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateState,
  generatePKCE,
  storeState,
  verifyState,
  exchangeCodeForTokens,
  refreshTokens,
  persistTokens,
} from "@/lib/oauth/core";
import { supabaseAdmin } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue({}),
  },
}));

function mockFrom(returnValue: unknown) {
  return vi.fn().mockReturnValue(returnValue);
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TIKTOK_CLIENT_KEY = "fake-key";
  process.env.TIKTOK_CLIENT_SECRET = "fake-secret";
  process.env.YOUTUBE_CLIENT_ID = "yt-client-id";
  process.env.YOUTUBE_CLIENT_SECRET = "yt-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateState", () => {
  it("produces a 64-char hex string", () => {
    const s = generateState();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different values each time", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

describe("generatePKCE", () => {
  it("produces verifier and challenge", () => {
    const { verifier, challenge } = generatePKCE();
    expect(verifier).toBeTruthy();
    expect(challenge).toBeTruthy();
    expect(verifier).not.toBe(challenge);
  });

  it("challenge is S256 hash of verifier", () => {
    const { verifier, challenge } = generatePKCE();
    const expected = require("crypto")
      .createHash("sha256")
      .update(verifier)
      .digest("base64url");
    expect(challenge).toBe(expected);
  });
});

describe("storeState", () => {
  it("inserts state into oauth_states", async () => {
    const insert = vi.fn().mockReturnValue({ error: null });
    (supabaseAdmin.from as any).mockReturnValue({ insert });

    await storeState({
      platformId: "tiktok",
      state: "abc",
      codeVerifier: "verifier123",
      redirectUrl: "/admin",
      expiresInMinutes: 15,
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_id: "tiktok",
        state: "abc",
        pkce_code_verifier: "verifier123",
        redirect_url: "/admin",
        expires_at: expect.any(String),
      })
    );
  });
});

describe("verifyState", () => {
  it("returns codeVerifier and redirectUrl then deletes the row", async () => {
    const del = vi.fn().mockResolvedValue({});
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "row-id",
              platform_id: "tiktok",
              state: "state123",
              pkce_code_verifier: "cv",
              redirect_url: "/admin",
            },
          }),
        }),
      }),
    });

    const delEq = vi.fn().mockResolvedValue({});
    (supabaseAdmin.from as any)
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ delete: vi.fn().mockReturnValue({ eq: delEq }) });

    const result = await verifyState({ platformId: "tiktok", state: "state123" });

    expect(result.codeVerifier).toBe("cv");
    expect(result.redirectUrl).toBe("/admin");
    expect(delEq).toHaveBeenCalled();
  });

  it("throws on invalid state", async () => {
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: true }),
        }),
      }),
    });
    (supabaseAdmin.from as any).mockReturnValue({ select: selectFn });

    await expect(
      verifyState({ platformId: "tiktok", state: "bad" })
    ).rejects.toThrow(/Invalid or expired/);
  });
});

describe("exchangeCodeForTokens", () => {
  it("throws if env credentials are missing", async () => {
    delete process.env.TIKTOK_CLIENT_KEY;
    await expect(
      exchangeCodeForTokens({
        platformId: "tiktok",
        code: "c",
        redirectUri: "http://localhost/callback",
      })
    ).rejects.toThrow(/Missing OAuth credentials/);
  });

  it("exchanges code and returns tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: "at123",
          refresh_token: "rt456",
          expires_in: 3600,
        }),
    });
    global.fetch = fetchMock as any;

    const result = await exchangeCodeForTokens({
      platformId: "tiktok",
      code: "auth-code",
      redirectUri: "http://localhost/callback",
    });

    expect(result.accessToken).toBe("at123");
    expect(result.refreshToken).toBe("rt456");
    expect(result.expiresAt).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("open.tiktokapis.com"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes PKCE code_verifier when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "a",
        expires_in: 3600,
      }),
    });
    global.fetch = fetchMock as any;

    await exchangeCodeForTokens({
      platformId: "youtube",
      code: "c",
      redirectUri: "http://localhost/callback",
      codeVerifier: "pkce123",
    });

    const requestBody = new URLSearchParams(
      (fetchMock.mock.calls[0][1] as RequestInit)?.body as string
    );
    expect(requestBody.get("code_verifier")).toBe("pkce123");
  });
});

describe("refreshTokens", () => {
  it("returns new tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "new-at",
        refresh_token: "new-rt",
        expires_in: 3600,
      }),
    });
    global.fetch = fetchMock as any;

    const result = await refreshTokens({
      platformId: "tiktok",
      refreshToken: "old-rt",
    });

    expect(result.accessToken).toBe("new-at");
    expect(result.refreshToken).toBe("new-rt");
  });
});

describe("persistTokens", () => {
  it("inserts new account when none exists", async () => {
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });

    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "new-id" } }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ insert: insertFn });

    const id = await persistTokens({
      platformId: "tiktok",
      accessToken: "at",
      refreshToken: "rt",
      expiresAt: new Date().toISOString(),
    });

    expect(id).toBe("new-id");
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        platform_id: "tiktok",
        access_token: "at",
        is_active: true,
      })
    );
  });

  it("updates existing account when found", async () => {
    const selectFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "existing-id" } }),
    });

    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "existing-id" } }),
        }),
      }),
    });

    (supabaseAdmin.from as any)
      .mockReturnValueOnce({ select: selectFn })
      .mockReturnValueOnce({ update: updateFn });

    const id = await persistTokens({
      platformId: "tiktok",
      accessToken: "new-at",
    });

    expect(id).toBe("existing-id");
    expect(updateFn).toHaveBeenCalled();
  });
});
