import type { PlatformAdapter } from "./types";
import { getActivePlatformAccount, persistTokens } from "./account";

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

async function refreshAccessToken(refreshToken?: string | null): Promise<{
  access_token: string;
  refresh_token?: string;
}> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const token = refreshToken || process.env.TIKTOK_REFRESH_TOKEN;

  if (!clientKey || !clientSecret || !token) {
    throw new Error(
      "TikTok credentials missing. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REFRESH_TOKEN (or store refresh_token in platform_accounts)."
    );
  }

  const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: token,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(
      `TikTok token refresh failed: ${data.error_description || data.error || res.statusText}`
    );
  }

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string | undefined,
  };
}

export const tiktokAdapter: PlatformAdapter = {
  platformId: "tiktok",

  async publish(input) {
    let accessToken: string;

    // Try DB account first
    try {
      const account = await getActivePlatformAccount("tiktok");
      const result = await refreshAccessToken(account.refresh_token);
      accessToken = result.access_token;

      // Persist rotated refresh token if returned
      if (result.refresh_token && result.refresh_token !== account.refresh_token) {
        await persistTokens(account.id, {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
      }
    } catch (accountErr: any) {
      // If it's a DB-not-found error, fall back to env vars for backwards-compat
      if (accountErr.message?.includes("No active platform account")) {
        const result = await refreshAccessToken();
        accessToken = result.access_token;
      } else {
        throw accountErr;
      }
    }

    const res = await fetch(`${TIKTOK_API_BASE}/v2/post/publish/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_info: {
          source: "PULL_FROM_URL",
          video_url: input.temporaryUploadUrl,
        },
        title: input.caption || input.title || "",
        privacy_level: "PUBLIC",
        disable_duet: false,
        disable_stitch: false,
        disable_comment: false,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error?.code) {
      throw new Error(
        `TikTok publish init failed: ${data.error?.message || res.statusText} (${data.error?.code || res.status})`
      );
    }

    const publishId = data.data?.publish_id as string | undefined;
    if (!publishId) {
      throw new Error("TikTok publish init succeeded but no publish_id was returned.");
    }

    return {
      platformPostId: publishId,
      rawResponse: data,
    };
  },
};
