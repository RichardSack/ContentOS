import { NextResponse } from "next/server";
import { z } from "zod";
import { getOAuthConfig } from "@/lib/oauth/config";
import { generateState, generatePKCE, storeState } from "@/lib/oauth/core";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Validate platform exists
  const cfg = getOAuthConfig(platform);
  const clientId = process.env[cfg.clientIdEnv];
  if (!clientId) {
    return NextResponse.json(
      { error: `OAuth not configured for ${platform}. Set ${cfg.clientIdEnv}.` },
      { status: 400 }
    );
  }

  // Generate CSRF state
  const state = generateState();

  // PKCE for supported platforms
  let codeChallenge: string | undefined;
  let codeVerifier: string | undefined;
  if (cfg.pkce) {
    const pkce = generatePKCE();
    codeVerifier = pkce.verifier;
    codeChallenge = pkce.challenge;
  }

  // Persist state in DB (for callback verification)
  await storeState({
    platformId: platform,
    state,
    codeVerifier,
    redirectUrl: "/admin",
    expiresInMinutes: 10,
  });

  // Build authorization URL
  const authUrl = new URL(cfg.authorizationUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", cfg.scopes.join(" "));
  authUrl.searchParams.set("redirect_uri", cfg.getRedirectUri());
  authUrl.searchParams.set("state", state);

  if (cfg.pkce && codeChallenge) {
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
  }

  // Platform-specific tweaks
  if (cfg.platformId === "youtube" || cfg.platformId === "linkedin") {
    // Google / LinkedIn support access_type and prompt
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
  }

  if (cfg.platformId === "instagram") {
    // Facebook OAuth
    authUrl.searchParams.set("config_id", "0"); // optional
  }

  return NextResponse.redirect(authUrl.toString(), 302);
}
