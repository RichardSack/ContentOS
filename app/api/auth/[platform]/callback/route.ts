import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateState } from "@/lib/oauth/core";
import { getOAuthConfig } from "@/lib/oauth/config";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin?error=oauth_${platform}_${error}`, baseUrl)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/admin?error=missing_code_or_state", baseUrl)
    );
  }

  // Retrieve stored state from DB
  const { data: stateRow, error: stateErr } = await supabaseAdmin
    .from("oauth_states")
    .select("*")
    .eq("platform_id", platform)
    .eq("state", state)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (stateErr || !stateRow || !validateState(state, stateRow.state)) {
    return NextResponse.redirect(
      new URL("/admin?error=invalid_state", baseUrl)
    );
  }

  // Delete used state immediately
  await supabaseAdmin.from("oauth_states").delete().eq("id", stateRow.id);

  // Exchange code for tokens
  const config = getOAuthConfig(platform);
  const clientId = process.env[`${platform.toUpperCase()}_CLIENT_ID`] || "";
  const clientSecret =
    process.env[`${platform.toUpperCase()}_CLIENT_SECRET`] || "";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL(`/admin?error=no_credentials_for_${platform}`, baseUrl)
    );
  }

  const redirectUri = `${baseUrl}/api/auth`;

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(config.headers || {}),
      },
      body: new URLSearchParams(
        config.exchangeBody({
          clientId,
          clientSecret,
          code,
          redirectUri,
          verifier: stateRow.pkce_code_verifier || undefined,
        })
      ),
    });

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;

    if (!tokenRes.ok) {
      const msg =
        (tokenData.error_description as string) ||
        (tokenData.error as string) ||
        "token_exchange_failed";
      return NextResponse.redirect(
        new URL(`/admin?error=${encodeURIComponent(msg)}`, baseUrl)
      );
    }

    const accessToken = tokenData[config.fields.accessToken] as string;
    const refreshToken = config.fields.refreshToken
      ? (tokenData[config.fields.refreshToken] as string | undefined)
      : undefined;
    const expiresIn = config.fields.expiresIn
      ? (tokenData[config.fields.expiresIn] as number | undefined)
      : undefined;

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;

    // Upsert into platform_accounts (admin has user_id = null for now)
    const { error: upsertErr } = await supabaseAdmin
      .from("platform_accounts")
      .upsert(
        {
          platform_id: platform,
          account_name: platform, // placeholder until we fetch real name
          access_token: accessToken,
          refresh_token: refreshToken || null,
          token_expires_at: expiresAt || null,
          is_active: true,
          connected_at: new Date().toISOString(),
          user_id: null,
        },
        { onConflict: "platform_id" } // admin: one per platform for now
      );

    if (upsertErr) {
      console.error("Failed to persist tokens:", upsertErr);
      return NextResponse.redirect(
        new URL("/admin?error=persist_failed", baseUrl)
      );
    }

    return NextResponse.redirect(
      new URL(`/admin?connected=${platform}`, baseUrl)
    );
  } catch (err: any) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/admin?error=${encodeURIComponent(err.message)}`, baseUrl)
    );
  }
}
