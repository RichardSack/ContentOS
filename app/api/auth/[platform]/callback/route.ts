import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { validateState } from "@/lib/oauth/core";
import { getOAuthConfig } from "@/lib/oauth/config";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { fetchLinkedInOwnerUrn } from "@/lib/oauth/callback-post";
import { getUser } from "@/lib/auth/user";

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

  // 1. Verify state in DB
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

  await supabaseAdmin.from("oauth_states").delete().eq("id", stateRow.id);

  // 2. Identify calling user (Bearer token or cookie)
  const currentUser = await getUser(req);
  const userId = currentUser?.id ?? null;

  // 3. Exchange code for tokens
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
    const tokenRes = await fetchWithTimeout(config.tokenUrl, {
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
      ? (tokenData[config.fields.expiresIn as string] as number | undefined)
      : undefined;

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;

    // 4. Upsert into platform_accounts (scoped to user)
    const { error: upsertErr } = await supabaseAdmin
      .from("platform_accounts")
      .upsert(
        {
          platform_id: platform,
          account_name: platform,
          access_token: accessToken,
          refresh_token: refreshToken || null,
          token_expires_at: expiresAt || null,
          is_active: true,
          connected_at: new Date().toISOString(),
          user_id: userId,
        },
        {
          onConflict: userId
            ? "platform_id, user_id"
            : "platform_id",
        }
      );

    if (upsertErr) {
      console.error("Failed to persist tokens:", upsertErr);
      return NextResponse.redirect(
        new URL("/admin?error=persist_failed", baseUrl)
      );
    }

    // 5. LinkedIn: auto-fetch owner URN
    if (platform === "linkedin") {
      try {
        const urn = await fetchLinkedInOwnerUrn(accessToken);
        if (urn) {
          const updateQuery = supabaseAdmin
            .from("platform_accounts")
            .update({ metadata: { linkedin_owner_urn: urn } })
            .eq("platform_id", "linkedin");

          if (userId) {
            await updateQuery.eq("user_id", userId);
          } else {
            await updateQuery.is("user_id", null);
          }
        }
      } catch (e) {
        console.warn("LinkedIn URN fetch failed:", e);
      }
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
