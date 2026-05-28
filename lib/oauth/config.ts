/**
 * OAuth2 configuration per platform.
 * Supports authorization_code flow with optional PKCE.
 *
 * Multi-user ready: each platform can store arbitrary metadata.
 */

export interface OAuthPlatformConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  pkce: boolean;
  fields: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: string;
  };
  buildAuthorizeUrl(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    scope: string;
    codeChallenge?: string;
  }): string;
  exchangeBody(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    verifier?: string;
  }): Record<string, string>;
  headers?: Record<string, string>;
}

const commonRedirectUri = `${process.env.APP_BASE_URL || ""}/api/auth`;

export const tiktokConfig: OAuthPlatformConfig = {
  authorizationUrl: "https://www.tiktok.com/v2/auth/authorize/",
  tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
  scopes: ["video.publish"],
  pkce: false,
  fields: {
    accessToken: "access_token",
    refreshToken: "refresh_token",
    expiresIn: "expires_in",
  },
  buildAuthorizeUrl({ clientId, redirectUri, state, scope }) {
    const url = new URL(this.authorizationUrl);
    url.searchParams.set("client_key", clientId);
    url.searchParams.set("redirect_uri", redirectUri + "/tiktok/callback");
    url.searchParams.set("scope", scope);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeBody({ clientId, clientSecret, code, redirectUri }) {
    return {
      client_key: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri + "/tiktok/callback",
    };
  },
};

export const youtubeConfig: OAuthPlatformConfig = {
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
  ],
  pkce: true,
  fields: {
    accessToken: "access_token",
    refreshToken: "refresh_token",
    expiresIn: "expires_in",
  },
  buildAuthorizeUrl({ clientId, redirectUri, state, scope, codeChallenge }) {
    const url = new URL(this.authorizationUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri + "/youtube/callback");
    url.searchParams.set("scope", scope);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    if (codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  },
  exchangeBody({ clientId, clientSecret, code, redirectUri, verifier }) {
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri + "/youtube/callback",
    };
    if (verifier) body.code_verifier = verifier;
    return body;
  },
};

export const linkedinConfig: OAuthPlatformConfig = {
  authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  scopes: ["w_member_social", "r_basicprofile"],
  pkce: true,
  fields: {
    accessToken: "access_token",
    refreshToken: "refresh_token",
    expiresIn: "expires_in",
  },
  buildAuthorizeUrl({ clientId, redirectUri, state, scope, codeChallenge }) {
    const url = new URL(this.authorizationUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri + "/linkedin/callback");
    url.searchParams.set("scope", scope);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    if (codeChallenge) {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  },
  exchangeBody({ clientId, clientSecret, code, redirectUri, verifier }) {
    const body: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri + "/linkedin/callback",
    };
    if (verifier) body.code_verifier = verifier;
    return body;
  },
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
};

export const facebookConfig: OAuthPlatformConfig = {
  // Used for Instagram (same Graph API, different scopes)
  authorizationUrl: "https://www.facebook.com/v18.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
  scopes: [
    "instagram_content_publish",
    "pages_read_engagement",
    "business_management",
  ],
  pkce: false,
  fields: {
    accessToken: "access_token",
    expiresIn: "expires_in",
  },
  buildAuthorizeUrl({ clientId, redirectUri, state, scope }) {
    const url = new URL(this.authorizationUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri + "/facebook/callback");
    url.searchParams.set("scope", scope);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return url.toString();
  },
  exchangeBody({ clientId, clientSecret, code, redirectUri }) {
    return {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri + "/facebook/callback",
    };
  },
};

export const platformOAuthConfig: Record<string, OAuthPlatformConfig> = {
  tiktok: tiktokConfig,
  youtube: youtubeConfig,
  linkedin: linkedinConfig,
  facebook: facebookConfig, // maps to instagram adapter internally
};

export function getOAuthConfig(platformId: string): OAuthPlatformConfig {
  const cfg = platformOAuthConfig[platformId];
  if (!cfg) throw new Error(`No OAuth config for platform: ${platformId}`);
  return cfg;
}
