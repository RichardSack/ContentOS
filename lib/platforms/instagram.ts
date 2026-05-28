import type { PlatformAdapter } from "./types";
import { getActivePlatformAccount, persistTokens } from "./account";

const GRAPH_API_BASE = "https://graph.facebook.com/v18.0";

/**
 * Instagram Graph API adapter.
 *
 * ⚠️  WACKELIG / EXPERIMENTAL
 * Instagram publishing requires:
 *   1. An Instagram Business or Creator Account
 *   2. A linked Facebook Business Account with admin permissions
 *   3. The Graph API token with instagram_content_publish permission
 *
 * The user currently has no Instagram account set up, so this adapter will
 * fail until a valid platform_accounts row is inserted with:
 *   - access_token
 *   - metadata.instagram_business_account_id
 *
 * NOTE ON TOKENS: Instagram Graph API works best with a long-lived Page Access
 * Token (obtained from a long-lived User Access Token). These typically do not
 * expire. If you only have a short-lived token, store FACEBOOK_CLIENT_ID and
 * FACEBOOK_CLIENT_SECRET in your env vars so the adapter can exchange it.
 *
 * TODOs:
 *   - Add webhook or polling job for async video processing (currently blocks)
 *   - Validate Reels vs Video constraints before upload
 *   - Retry logic for EXPIRED containers
 *   - Thumbnail support
 */

function graphApiFetch(path: string, init?: RequestInit) {
  return fetch(`${GRAPH_API_BASE}${path}`, init);
}

async function graphApiPost(path: string, body: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  const res = await graphApiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(
      `Instagram Graph API error: ${data.error?.message || JSON.stringify(data)}`
    );
  }
  return data;
}

async function graphApiGet(path: string) {
  const res = await graphApiFetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(
      `Instagram Graph API error: ${data.error?.message || JSON.stringify(data)}`
    );
  }
  return data;
}

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureValidToken(
  account: Awaited<ReturnType<typeof getActivePlatformAccount>>
): Promise<string> {
  const expiresAt = account.token_expires_at
    ? new Date(account.token_expires_at).getTime()
    : null;

  if (expiresAt && Date.now() < expiresAt - 5 * 60 * 1000) {
    // Token is still valid (with 5 min buffer) — no refresh needed
    return account.access_token;
  }

  const clientId = process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Instagram access token is expired or about to expire. Set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET in env vars to enable automatic token exchange."
    );
  }

  // Exchange short-lived token for long-lived token (60 days)
  const exchangeRes = await graphApiGet(
    `/oauth/access_token?grant_type=fb_exchange_token`
    +
    `&client_id=${encodeURIComponent(clientId)}`
    +
    `&client_secret=${encodeURIComponent(clientSecret)}`
    +
    `&fb_exchange_token=${encodeURIComponent(account.access_token)}`
  );

  const data = exchangeRes as { access_token?: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error(
      `Instagram token exchange failed: ${JSON.stringify(exchangeRes)}`
    );
  }

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : undefined;

  await persistTokens(account.id, {
    access_token: data.access_token,
    expires_at: newExpiresAt || null,
  });

  return data.access_token;
}

export const instagramAdapter: PlatformAdapter = {
  platformId: "instagram",

  async publish(input) {
    const account = await getActivePlatformAccount("instagram");
    const accessToken = await ensureValidToken(account);

    const igUserId = account.metadata?.instagram_business_account_id as
      | string
      | undefined;

    if (!igUserId) {
      throw new Error(
        'Missing instagram_business_account_id. Store it in platform_accounts.metadata as {"instagram_business_account_id": "123456789"}.'
      );
    }

    // 1. Create media container with remote video URL
    const container = (await graphApiPost(`/${igUserId}/media`, {
      media_type: "REELS",
      video_url: input.temporaryUploadUrl,
      caption: input.caption || input.title || "",
      access_token: accessToken,
    })) as { id?: string };

    if (!container.id) {
      throw new Error(
        `Instagram container creation did not return an ID: ${JSON.stringify(container)}`
      );
    }

    // 2. Poll until processing is finished
    let statusCode = "PENDING";
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      const status = (await graphApiGet(
        `/${container.id}?fields=status_code&access_token=${accessToken}`
      )) as { status_code?: string };

      statusCode = status.status_code || "PENDING";

      if (statusCode === "FINISHED") break;
      if (statusCode === "ERROR") {
        throw new Error(
          `Instagram video processing failed for container ${container.id}.`
        );
      }
      await wait(2000);
    }

    if (statusCode !== "FINISHED") {
      throw new Error(
        `Instagram video did not finish processing within ${maxAttempts * 2}s. Container: ${container.id}`
      );
    }

    // 3. Publish the container
    const publish = (await graphApiPost(`/${igUserId}/media_publish`, {
      creation_id: container.id,
      access_token: accessToken,
    })) as { id?: string };

    if (!publish.id) {
      throw new Error(
        `Instagram publish did not return a media ID: ${JSON.stringify(publish)}`
      );
    }

    return {
      platformPostId: publish.id,
      platformUrl: `https://www.instagram.com/p/${publish.id}/`,
      embedUrl: `https://www.instagram.com/p/${publish.id}/embed`,
      rawResponse: { container, publish },
    };
  },
};
