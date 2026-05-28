/**
 * OAuth2 configuration per platform.
 * All URLs and scopes are defined here so the core logic stays generic.
 */

export type OAuthConfig = {
  platformId: string;
  /** Authorization endpoint (GET, user-facing) */
  authorizationUrl: string;
  /** Token endpoint (POST, server-to-server) */
  tokenUrl: string;
  /** Refresh endpoint — often same as tokenUrl */
  refreshUrl: string;
  /** OAuth scopes */
  scopes: string[];
  /** Use PKCE S256? */
  pkce: boolean;
  /** Client ID env var name */
  clientIdEnv: string;
  /** Client Secret env var name */
  clientSecretEnv: string;
  /** How to map the JSON token response to our fields */
  fieldMapping: {
    accessToken: string;   // path in JSON, e.g. "access_token"
    refreshToken?: string; // optional
    expiresIn?: string;    // seconds, e.g. "expires_in"
  };
  /** Build the redirect URI sent to the platform */
  getRedirectUri: () => string;
};

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}

function makeRedirectUri(platform: string): string {
  return `${getAppBaseUrl()}/api/auth/${platform}/callback`;
}

export const oauthConfigs: Record<string, OAuthConfig> = {
  tiktok: {
    platformId: "tiktok",
    authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    refreshUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["video.upload"],
    pkce: false, // TikTok supports PKCE but it's optional; we'll use without for simplicity
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    fieldMapping: {
      accessToken: "access_token",
      refreshToken: "refresh_token",
      expiresIn: "expires_in",
    },
    getRedirectUri: () => makeRedirectUri("tiktok"),
  },

  youtube: {
    platformId: "youtube",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    refreshUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    pkce: true,
    clientIdEnv: "YOUTUBE_CLIENT_ID",
    clientSecretEnv: "YOUTUBE_CLIENT_SECRET",
    fieldMapping: {
      accessToken: "access_token",
      refreshToken: "refresh_token",
      expiresIn: "expires_in",
    },
    getRedirectUri: () => makeRedirectUri("youtube"),
  },

  linkedin: {
    platformId: "linkedin",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    refreshUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["r_basicprofile", "w_member_social"],
    pkce: true,
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    fieldMapping: {
      accessToken: "access_token",
      refreshToken: "refresh_token",
      expiresIn: "expires_in",
    },
    getRedirectUri: () => makeRedirectUri("linkedin"),
  },

  instagram: {
    platformId: "instagram",
    // Instagram uses Facebook's OAuth dialog
    authorizationUrl: "https://facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    refreshUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_engagement",
    ],
    pkce: false, // Facebook dialog doesn't support PKCE
    clientIdEnv: "FACEBOOK_CLIENT_ID",
    clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
    fieldMapping: {
      accessToken: "access_token",
      refreshToken: "refresh_token", // Facebook long-lived tokens may not have refresh
      expiresIn: "expires_in",
    },
    getRedirectUri: () => makeRedirectUri("instagram"),
  },
};

export function getOAuthConfig(platformId: string): OAuthConfig {
  const cfg = oauthConfigs[platformId];
  if (!cfg) {
    throw new Error(`No OAuth config for platform: ${platformId}`);
  }
  return cfg;
}
