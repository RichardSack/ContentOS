import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { email, password, displayName } = await req.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (min 8 chars) required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm, no email verification needed
    user_metadata: { full_name: displayName || email.split("@")[0] },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Auto-create public.users row (trigger should handle this, but be safe)
  await supabaseAdmin.from("users").upsert({
    id: data.user.id,
    email: data.user.email || email,
    role: "creator",
    display_name: displayName || email.split("@")[0],
  });

  // Sign in immediately to get session tokens
  const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      { error: signInError.message, note: "Account created but login failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: (data.user.user_metadata as any)?.full_name || displayName,
    },
    session: signInData.session
      ? {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_at: signInData.session.expires_at,
        }
      : null,
  });
}
