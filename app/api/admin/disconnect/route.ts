import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/user";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await req.json();

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const isAdmin = user.role === "admin";

  let query = supabaseAdmin
    .from("platform_accounts")
    .update({ is_active: false })
    .eq("id", accountId);

  if (!isAdmin) {
    query = query.eq("user_id", user.id);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}
