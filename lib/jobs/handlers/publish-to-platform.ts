import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPlatformAdapter } from "@/lib/platforms";
import { enqueueJob } from "../queue";
import { getSignedTempUrl } from "./shared";

export async function handlePublishToPlatform(job: any) {
  const { data: post, error } = await supabaseAdmin
    .from("platform_posts")
    .select("*")
    .eq("id", job.platform_post_id)
    .single();

  if (error) throw error;

  const { signedUrl } = await getSignedTempUrl(job.temporary_upload_id);
  const adapter = getPlatformAdapter(post.platform_id);

  const result = await adapter.publish({
    temporaryUploadUrl: signedUrl,
    title: post.title,
    caption: post.caption,
    scheduledAt: post.scheduled_at,
    metadata: post.api_metadata,
  });

  await supabaseAdmin
    .from("platform_posts")
    .update({
      post_status: "published",
      posted_at: new Date().toISOString(),
      platform_post_id: result.platformPostId,
      platform_url: result.platformUrl,
      embed_url: result.embedUrl,
      thumbnail_url: result.thumbnailUrl,
      api_metadata: {
        ...post.api_metadata,
        rawPublishResponse: result.rawResponse,
      },
    })
    .eq("id", post.id);

  // Multi-platform safety: only enqueue cleanup when ALL platform_posts for
  // this content item are finished (published / failed / cancelled).
  const { data: siblingPosts } = await supabaseAdmin
    .from("platform_posts")
    .select("post_status")
    .eq("content_item_id", job.content_item_id);

  const allFinished = (siblingPosts || []).every((p: any) =>
    ["published", "failed", "cancelled"].includes(p.post_status)
  );

  if (allFinished) {
    await enqueueJob({
      contentItemId: job.content_item_id,
      temporaryUploadId: job.temporary_upload_id,
      jobType: "cleanup_temp_upload",
      priority: 200,
    });
  }
}
