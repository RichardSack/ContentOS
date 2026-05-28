import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/auth/user";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = user.role === "admin";
  const nowIso = new Date().toISOString();

  // Build base queries
  let contentQuery = supabaseAdmin
    .from("content_items")
    .select("id, title, processing_status, created_at, content_type")
    .in("processing_status", ["uploaded", "transcribing", "summarizing", "embedding"]);

  let failedQuery = supabaseAdmin
    .from("content_items")
    .select("id, title, processing_status, created_at")
    .eq("processing_status", "failed");

  let accountsQuery = supabaseAdmin
    .from("platform_accounts")
    .select("id, platform_id, account_name, is_active, connected_at, token_expires_at")
    .eq("is_active", true);

  let scheduledQuery = supabaseAdmin
    .from("platform_posts")
    .select("id, platform_id, post_status, scheduled_at, content_item_id")
    .eq("post_status", "scheduled")
    .gte("scheduled_at", nowIso);

  if (!isAdmin) {
    contentQuery = contentQuery.eq("user_id", user.id);
    failedQuery = failedQuery.eq("user_id", user.id);
    accountsQuery = accountsQuery.eq("user_id", user.id);
  }

  const { data: processingItems } = await contentQuery
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: failedItems } = await failedQuery
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: pendingJobs } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, job_type, status, content_item_id, error_message, created_at, attempts")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: connectedAccounts } = await accountsQuery
    .order("connected_at", { ascending: false });

  const { data: scheduledPosts } = await scheduledQuery
    .order("scheduled_at", { ascending: true })
    .limit(10);

  return NextResponse.json({
    processing: processingItems || [],
    failed: failedItems || [],
    jobs: pendingJobs || [],
    accounts: connectedAccounts || [],
    scheduled: scheduledPosts || [],
  });
}
