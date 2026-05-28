import { NextResponse, type NextRequest } from "next/server";
import { getOAuthConfig } from "@/lib/oauth/config";
import { verifyState, exchangeCodeForTokens, persistTokens } from "@/lib/oauth/core";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Extract query params
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  const cfg = getOAuthConfig(platform);
  const redirectBase = process.env.APP_BASE_URL || "http://localhost:3000";

  // If the platform returned an error, redirect to admin with error
  if (error) {
    return NextResponse.redirect(
      `${redirectBase}/admin?error=${encodeURIComponent(
        errorDescription || error
      )}`,
      302
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${redirectBase}/admin?error=${encodeURIComponent(
        "Missing authorization code or state."
      )}`,
      302
    );
  }

  try {
    // Verify state from DB (prevents CSRF)
    const { codeVerifier } = await verifyState({ platformId: platform, state });

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens({
      platformId: platform,
      code,
      redirectUri: cfg.getRedirectUri(),
      codeVerifier,
    });

    // Persist tokens in DB (admin = null userId)
    await persistTokens({
      platformId: platform,
      userId: null, // admin account; set to auth.uid() for actual multi-user
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      expiresAt: tokens.expiresAt ?? null,
    });

    return NextResponse.redirect(
      `${redirectBase}/admin?connected=${encodeURIComponent(platform)}`,
      302
    );
  } catch (err: any) {
    const message = err.message || "Unknown OAuth error";
    return NextResponse.redirect(
      `${redirectBase}/admin?error=${encodeURIComponent(message)}`,
      302
    );
  }
}
