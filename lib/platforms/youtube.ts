import type { PlatformAdapter } from "./types";
import { getActivePlatformAccount, persistTokens } from "./account";
import { downloadVideo } from "./utils";

const YOUTUBE_UPLOAD_BASE =
  "https://www.googleapis.com/upload/youtube/v3/videos";
const GOOGLE_OAUTH_BASE = "https://oauth2.googleapis.com/token";

async function getAccessToken(account: {
  refresh_token?: string | null;
}): Promise<{ accessToken: string; expiresAt?: number }> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = account.refresh_token || process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "YouTube credentials missing. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and a refresh_token in platform_accounts (or YOUTUBE_REFRESH_TOKEN env var)."
    );
  }

  const res = await fetch(GOOGLE_OAUTH_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`YouTube token refresh failed: ${data.error_description || data.error}`);
  }

  return {
    accessToken: data.access_token as string,
    expiresAt: data.expires_in
      ? Date.now() + (data.expires_in as number) * 1000
      : undefined,
  };
}

/**
 * Uploads a video to YouTube via the Data API resumable upload flow.
 * Works without browser redirects by downloading the video bytes server-side
 * and streaming them into YouTube.
 *
 * NOTE: Serverless functions have memory limits. Very large videos may fail here.
 * For production with heavy files, consider chunked upload or a background worker
 * with larger resource limits.
 */
export const youtubeAdapter: PlatformAdapter = {
  platformId: "youtube",

  async publish(input) {
    const account = await getActivePlatformAccount("youtube");
    const { accessToken, expiresAt } = await getAccessToken(account);

    // Persist updated access token + expiry (Google does not return a new
    // refresh_token on refresh, so we leave that untouched).
    if (expiresAt) {
      await persistTokens(account.id, {
        access_token: accessToken,
        expires_at: new Date(expiresAt).toISOString(),
      });
    }

    const { buffer, size, contentType } = await downloadVideo(
      input.temporaryUploadUrl
    );

    if (size === 0) {
      throw new Error("Downloaded video has zero bytes.");
    }

    // 1. Initialize resumable upload session
    const initRes = await fetch(
      `${YOUTUBE_UPLOAD_BASE}?uploadType=resumable&part=snippet,status,contentDetails`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(size),
          "X-Upload-Content-Type": contentType,
        },
        body: JSON.stringify({
          snippet: {
            title: input.title || "Untitled",
            description: input.caption || input.description || "",
          },
          status: {
            privacyStatus: "public",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => initRes.statusText);
      throw new Error(`YouTube resumable init failed: ${errText}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      throw new Error(
        "YouTube resumable init did not return an upload Location header."
      );
    }

    // 2. Upload video bytes
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
      },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => uploadRes.statusText);
      throw new Error(`YouTube upload failed: ${errText}`);
    }

    const video = (await uploadRes.json().catch(() => ({}))) as {
      id?: string;
    };

    if (!video.id) {
      throw new Error("YouTube upload succeeded but no video ID was returned.");
    }

    return {
      platformPostId: video.id,
      platformUrl: `https://youtube.com/watch?v=${video.id}`,
      embedUrl: `https://www.youtube.com/embed/${video.id}`,
      thumbnailUrl: `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`,
    };
  },
};
