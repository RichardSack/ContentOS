import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const { accountId } = await req.json();

  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("platform_accounts")
    .update({ is_active: false })
    .eq("id", accountId)
    .is("user_id", null); // admin accounts only

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true });
}
