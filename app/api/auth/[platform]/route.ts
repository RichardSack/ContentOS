import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateState, generatePKCE, defaultExpiresAt } from "@/lib/oauth/core";
import { getOAuthConfig } from "@/lib/oauth/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Verify platform exists and is active
  const { data: platformRow } = await supabaseAdmin
    .from("platforms")
    .select("id, name")
    .eq("id", platform)
    .eq("is_active", true)
    .single();

  if (!platformRow) {
    return NextResponse.redirect(
      new URL("/admin?error=unknown_platform", process.env.APP_BASE_URL)
    );
  }

  // Load env credentials for the platform
  const clientId = process.env[`${platform.toUpperCase()}_CLIENT_ID`] || "";
  if (!clientId) {
    return NextResponse.redirect(
      new URL(`/admin?error=no_client_id_for_${platform}`, process.env.APP_BASE_URL)
    );
  }

  const config = getOAuthConfig(platform);
  const state = generateState();

  let pkceVerifier: string | undefined;
  let codeChallenge: string | undefined;

  if (config.pkce) {
    const pkce = generatePKCE();
    pkceVerifier = pkce.code_verifier;
    codeChallenge = pkce.code_challenge;
  }

  // Store state in DB (with optional PKCE verifier)
  const { error: dbErr } = await supabaseAdmin.from("oauth_states").insert({
    platform_id: platform,
    state,
    pkce_code_verifier: pkceVerifier || null,
    redirect_url: "/admin",
    expires_at: defaultExpiresAt(),
  });

  if (dbErr) {
    console.error("Failed to store OAuth state:", dbErr);
    return NextResponse.redirect(
      new URL("/admin?error=state_storage_failed", process.env.APP_BASE_URL)
    );
  }

  const redirectUri = `${process.env.APP_BASE_URL || "http://localhost:3000"}/api/auth`;
  const url = config.buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    scope: config.scopes.join(","),
    codeChallenge,
  });

  return NextResponse.redirect(url);
}
