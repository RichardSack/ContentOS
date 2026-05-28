import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  assertAdmin(req);

  const { accountId } = await req.json();
  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("platform_accounts")
    .update({ is_active: false })
    .eq("id", accountId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
