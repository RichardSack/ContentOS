import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { assertCron } from "@/lib/auth/admin";

export async function POST(req: NextRequest) {
  try {
    assertCron(req);

    const { data: posts, error } = await supabaseAdmin
      .from("platform_posts")
      .select("*")
      .eq("post_status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (error) throw error;

    let queued = 0;

    for (const post of posts || []) {
      const { data: uploads, error: uploadError } = await supabaseAdmin
        .from("temporary_uploads")
        .select("*")
        .eq("content_item_id", post.content_item_id)
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(1);

      if (uploadError || !uploads || uploads.length === 0) continue;

      const upload = uploads[0];

      await supabaseAdmin
        .from("platform_posts")
        .update({
          post_status: "publishing",
          publish_attempts: (post.publish_attempts || 0) + 1,
        })
        .eq("id", post.id);

      await enqueueJob({
        contentItemId: post.content_item_id,
        platformPostId: post.id,
        temporaryUploadId: upload.id,
        jobType: "publish_to_platform",
        priority: 20,
      });

      queued += 1;
    }

    return NextResponse.json({ queued });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.message === "Unauthorized" ? 401 : 500,
      }
    );
  }
}
