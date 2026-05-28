import type { PlatformAdapter } from "./types";
import { getActivePlatformAccount } from "./account";

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

async function refreshAccessToken(refreshToken?: string | null): Promise<string> {
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

  if (data.refresh_token && data.refresh_token !== token) {
    console.warn(
      "TikTok refresh_token rotated. Update platform_accounts row with new token:",
      data.refresh_token
    );
  }

  return data.access_token as string;
}

export const tiktokAdapter: PlatformAdapter = {
  platformId: "tiktok",

  async publish(input) {
    let accessToken: string;

    try {
      const account = await getActivePlatformAccount("tiktok");
      accessToken = await refreshAccessToken(account.refresh_token);
    } catch {
      // Fallback to env vars for backwards-compat until DB account is created
      accessToken = await refreshAccessToken();
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
