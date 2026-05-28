import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/user";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("platform_accounts")
    .select("id, platform_id, account_name, is_active, connected_at, token_expires_at")
    .eq("is_active", true)
    .is("user_id", null)
    .order("connected_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ accounts: data });
}
