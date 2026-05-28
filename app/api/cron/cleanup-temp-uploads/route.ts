import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { assertCron } from "@/lib/auth/admin";

export async function POST(req: NextRequest) {
  try {
    assertCron(req);

    const { data: uploads, error } = await supabaseAdmin
      .from("temporary_uploads")
      .select("*")
      .eq("status", "available")
      .lt("expires_at", new Date().toISOString())
      .limit(20);

    if (error) throw error;

    for (const upload of uploads || []) {
      await enqueueJob({
        contentItemId: upload.content_item_id,
        temporaryUploadId: upload.id,
        jobType: "cleanup_temp_upload",
        priority: 250,
      });
    }

    return NextResponse.json({ queued: uploads?.length || 0 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.message === "Unauthorized" ? 401 : 500,
      }
    );
  }
}
