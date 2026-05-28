import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getOAuthConfig, type OAuthConfig } from "./config";

const STATE_BYTES = 32;
const CODE_VERIFIER_BYTES = 32;

/** Generate a cryptographically secure random state string. */
export function generateState(): string {
  return crypto.randomBytes(STATE_BYTES).toString("hex");
}

/** Generate PKCE verifier + S256 challenge. */
export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(CODE_VERIFIER_BYTES).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

/** Store OAuth state (+ optional PKCE verifier) in DB for callback validation. */
export async function storeState(params: {
  platformId: string;
  state: string;
  codeVerifier?: string;
  redirectUrl?: string;
  expiresInMinutes?: number;
}) {
  const { error } = await supabaseAdmin.from("oauth_states").insert({
    platform_id: params.platformId,
    state: params.state,
    pkce_code_verifier: params.codeVerifier ?? null,
    redirect_url: params.redirectUrl ?? null,
    expires_at: new Date(
      Date.now() + (params.expiresInMinutes ?? 10) * 60_000
    ).toISOString(),
  });
  if (error) throw new Error(`Failed to store OAuth state: ${error.message}`);
}

/** Verify a callback state. Returns the stored record or throws. */
export async function verifyState(params: {
  platformId: string;
  state: string;
}): Promise<{
  codeVerifier: string | null;
  redirectUrl: string | null;
}> {
  // prune expired rows opportunistically
  try {
    await supabaseAdmin.rpc("prune_expired_oauth_states");
  } catch {
    // ignore cleanup errors
  }

  const { data, error } = await supabaseAdmin
    .from("oauth_states")
    .select("*")
    .eq("platform_id", params.platformId)
    .eq("state", params.state)
    .single();

  if (error || !data) {
    throw new Error("Invalid or expired OAuth state. Please try connecting again.");
  }

  // Delete after successful verification → one-time use
  await supabaseAdmin.from("oauth_states").delete().eq("id", data.id);

  return {
    codeVerifier: data.pkce_code_verifier,
    redirectUrl: data.redirect_url,
  };
}

/** Exchange authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(params: {
  platformId: string;
  code: string;
  redirectUri: string;
  codeVerifier?: string | null;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const cfg = getOAuthConfig(params.platformId);
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing OAuth credentials for ${params.platformId}. Set ${cfg.clientIdEnv} and ${cfg.clientSecretEnv} in env.`
    );
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  });

  if (params.codeVerifier) {
    body.set("code_verifier", params.codeVerifier);
  }

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new Error(
      `Token exchange failed for ${params.platformId}: ${
        data.error_description || data.error || res.statusText
      }`
    );
  }

  const accessToken = data[cfg.fieldMapping.accessToken] as string | undefined;
  if (!accessToken) {
    throw new Error(
      `Token exchange succeeded but no access_token field (${cfg.fieldMapping.accessToken}) in response.`
    );
  }

  const refreshToken = cfg.fieldMapping.refreshToken
    ? (data[cfg.fieldMapping.refreshToken] as string | undefined)
    : undefined;

  const expiresIn = cfg.fieldMapping.expiresIn
    ? (data[cfg.fieldMapping.expiresIn] as number | undefined)
    : undefined;

  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(expiresIn
      ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }
      : {}),
  };
}

/** Refresh access token using a refresh token. */
export async function refreshTokens(params: {
  platformId: string;
  refreshToken: string;
}): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}> {
  const cfg = getOAuthConfig(params.platformId);
  const clientId = process.env[cfg.clientIdEnv];
  const clientSecret = process.env[cfg.clientSecretEnv];

  if (!clientId || !clientSecret) {
    throw new Error(
      `Missing OAuth credentials for ${params.platformId}. Set ${cfg.clientIdEnv} and ${cfg.clientSecretEnv}.`
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(cfg.refreshUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    throw new Error(
      `Token refresh failed for ${params.platformId}: ${
        data.error_description || data.error || res.statusText
      }`
    );
  }

  const accessToken = data[cfg.fieldMapping.accessToken] as string | undefined;
  if (!accessToken) {
    throw new Error(
      `Token refresh succeeded but no access_token field in response.`
    );
  }

  const newRefreshToken = cfg.fieldMapping.refreshToken
    ? (data[cfg.fieldMapping.refreshToken] as string | undefined)
    : undefined;

  const expiresIn = cfg.fieldMapping.expiresIn
    ? (data[cfg.fieldMapping.expiresIn] as number | undefined)
    : undefined;

  return {
    accessToken,
    ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
    ...(expiresIn
      ? { expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() }
      : {}),
  };
}

/** Upsert a platform account row with fresh tokens. */
export async function persistTokens(params: {
  platformId: string;
  userId?: string | null;
  accountName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  // Look for existing active account for this platform (+ user)
  const { data: existing } = await supabaseAdmin
    .from("platform_accounts")
    .select("id")
    .eq("platform_id", params.platformId)
    .eq("is_active", true)
    .is(params.userId ? "user_id" : "user_id", params.userId ?? null)
    .maybeSingle();

  const payload = {
    platform_id: params.platformId,
    user_id: params.userId ?? null,
    account_name: params.accountName ?? null,
    access_token: params.accessToken,
    refresh_token: params.refreshToken ?? null,
    token_expires_at: params.expiresAt ?? null,
    is_active: true,
    metadata: params.metadata ?? {},
    connected_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("platform_accounts")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  const { data, error } = await supabaseAdmin
    .from("platform_accounts")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
