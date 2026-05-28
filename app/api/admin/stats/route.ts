import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth/admin";

/**
 * Admin dashboard stats.
 * Returns counts and recent lists for uploads, jobs, and connected accounts.
 */
export async function GET(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Recent uploads still processing
  const { data: processingItems } = await supabaseAdmin
    .from("content_items")
    .select("id, title, processing_status, created_at, content_type")
    .in("processing_status", ["uploaded", "transcribing", "summarizing", "embedding"])
    .order("created_at", { ascending: false })
    .limit(20);

  // Recent failed items
  const { data: failedItems } = await supabaseAdmin
    .from("content_items")
    .select("id, title, processing_status, created_at")
    .eq("processing_status", "failed")
    .order("created_at", { ascending: false })
    .limit(10);

  // Pending + failed jobs
  const { data: pendingJobs } = await supabaseAdmin
    .from("processing_jobs")
    .select("id, job_type, status, content_item_id, error_message, created_at, attempts")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: false })
    .limit(50);

  // Connected platform accounts (admin accounts = user_id null)
  const { data: connectedAccounts } = await supabaseAdmin
    .from("platform_accounts")
    .select("id, platform_id, account_name, is_active, connected_at, token_expires_at")
    .eq("is_active", true)
    .is("user_id", null)
    .order("connected_at", { ascending: false });

  // Scheduled posts coming up
  const { data: scheduledPosts } = await supabaseAdmin
    .from("platform_posts")
    .select("id, platform_id, post_status, scheduled_at, content_item_id")
    .eq("post_status", "scheduled")
    .gte("scheduled_at", nowIso)
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
