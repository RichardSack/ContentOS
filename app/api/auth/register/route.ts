import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName } = await req.json();

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (min 8 chars) required" },
        { status: 400 }
      );
    }

    // Debug: log what we're about to do
    console.log("[register] creating user:", email);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName || email.split("@")[0] },
    });

    if (error) {
      console.error("[register] createUser error:", error);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    console.log("[register] user created:", data.user?.id);

    // Auto-create public.users row
    const { error: upsertErr } = await supabaseAdmin.from("users").upsert({
      id: data.user.id,
      email: data.user.email || email,
      role: "creator",
      display_name: displayName || email.split("@")[0],
    });

    if (upsertErr) {
      console.error("[register] users upsert error:", upsertErr);
      // Non-fatal: trigger may have already created it
    }

    // Sign in immediately to get session tokens
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      console.error("[register] signIn error:", signInError);
      return NextResponse.json(
        {
          error: signInError.message,
          note: "Account created but login failed",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName:
          (data.user.user_metadata as any)?.full_name || displayName,
      },
      session: signInData.session
        ? {
            access_token: signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
            expires_at: signInData.session.expires_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error("[register] unhandled exception:", err);
    return NextResponse.json(
      { error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
