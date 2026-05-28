import type { PlatformAdapter } from "./types";

const TIKTOK_API_BASE = "https://open.tiktokapis.com";

/**
 * Refreshes the TikTok access token via OAuth2 refresh-token flow.
 * Logs a warning if the refresh_token rotates — in production this should
 * be persisted back to a secure store (e.g. DB / env mgmt).
 */
async function refreshAccessToken(): Promise<string> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;

  if (!clientKey || !clientSecret || !refreshToken) {
    throw new Error(
      "TikTok credentials missing. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REFRESH_TOKEN."
    );
  }

  const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(
      `TikTok token refresh failed: ${data.error_description || data.error || res.statusText}`
    );
  }

  if (data.refresh_token && data.refresh_token !== refreshToken) {
    // In production persist the new refresh_token to avoid invalidation
    console.warn(
      "TikTok refresh_token rotated. New token should be persisted:",
      data.refresh_token
    );
  }

  return data.access_token as string;
}

export const tiktokAdapter: PlatformAdapter = {
  platformId: "tiktok",

  async publish(input) {
    const accessToken = await refreshAccessToken();

    // TikTok accepts a publicly accessible video URL.
    // The signed Supabase URL is fine here, but must stay valid long enough
    // for TikTok to fetch the file (signed URLs are 1h by default).
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
      throw new Error(
        "TikTok publish init succeeded but no publish_id was returned."
      );
    }

    // TikTok returns a publish_id that references the publishing job.
    // The final video URL is only available after processing completes.
    // In a future iteration we could poll /v2/post/publish/video/status/.
    return {
      platformPostId: publishId,
      platformUrl: undefined,
      rawResponse: data,
    };
  },
};
