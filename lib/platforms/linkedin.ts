import type { PlatformAdapter } from "./types";
import { getActivePlatformAccount, persistTokens } from "./account";
import { downloadVideo } from "./utils";

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_OAUTH_BASE = "https://www.linkedin.com/oauth/v2/accessToken";

async function refreshLinkedInToken(account: {
  refresh_token?: string | null;
}): Promise<{ access_token: string; refresh_token?: string }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const refreshToken = account.refresh_token || process.env.LINKEDIN_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "LinkedIn credentials missing. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and a refresh_token in platform_accounts (or LINKEDIN_REFRESH_TOKEN env var)."
    );
  }

  const res = await fetch(LINKEDIN_OAUTH_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `LinkedIn token refresh failed: ${data.error_description || data.error || res.statusText}`
    );
  }

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string | undefined,
  };
}

export const linkedinAdapter: PlatformAdapter = {
  platformId: "linkedin",

  async publish(input) {
    const account = await getActivePlatformAccount("linkedin");
    const tokenResult = await refreshLinkedInToken(account);

    // Persist rotated refresh token (LinkedIn rotates on every refresh)
    if (tokenResult.refresh_token && tokenResult.refresh_token !== account.refresh_token) {
      await persistTokens(account.id, {
        access_token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
      });
    }

    const accessToken = tokenResult.access_token;

    const ownerUrn = account.metadata?.linkedin_owner_urn as string | undefined;
    if (!ownerUrn) {
      throw new Error(
        'LinkedIn owner URN missing. Store it in platform_accounts.metadata as {"linkedin_owner_urn": "urn:li:person:XXX"} or urn:li:organization:XXX.'
      );
    }

    // 1. Register upload
    const registerRes = await fetch(
      `${LINKEDIN_API_BASE}/assets?action=registerUpload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
            owner: ownerUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        }),
      }
    );

    const registerData = (await registerRes.json()) as {
      value?: {
        asset?: string;
        uploadMechanism?: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"?: {
            uploadUrl?: string;
          };
        };
      };
    };

    if (!registerRes.ok || !registerData.value) {
      throw new Error(
        `LinkedIn registerUpload failed: ${JSON.stringify(registerData)}`
      );
    }

    const uploadUrl =
      registerData.value.uploadMechanism?.[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ]?.uploadUrl;
    const assetUrn = registerData.value.asset;

    if (!uploadUrl || !assetUrn) {
      throw new Error(
        `LinkedIn registerUpload did not return uploadUrl or asset. Response: ${JSON.stringify(
          registerData
        )}`
      );
    }

    // 2. Download & upload bytes
    const { buffer } = await downloadVideo(input.temporaryUploadUrl);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: buffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text().catch(() => uploadRes.statusText);
      throw new Error(`LinkedIn video bytes upload failed: ${err}`);
    }

    // 3. Create UGC post with the video asset
    const postRes = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: ownerUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: input.caption || input.title || "",
            },
            shareMediaCategory: "VIDEO",
            media: [
              {
                status: "READY",
                description: {
                  text: input.description || "",
                },
                media: assetUrn,
                title: {
                  text: input.title || "",
                },
              },
            ],
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });

    if (!postRes.ok) {
      const err = await postRes.text().catch(() => postRes.statusText);
      throw new Error(`LinkedIn post creation failed: ${err}`);
    }

    const postData = (await postRes.json().catch(() => ({}))) as {
      id?: string;
    };

    return {
      platformPostId: postData.id || assetUrn,
      platformUrl: postData.id
        ? `https://www.linkedin.com/feed/update/${postData.id}`
        : undefined,
      rawResponse: postData,
    };
  },
};
