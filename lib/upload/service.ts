import { supabaseAdmin } from "@/lib/supabase/admin";
import { enqueueJob } from "@/lib/jobs/queue";

export interface UploadResult {
  contentItem: any;
  temporaryUpload: any;
  platformPosts: any[];
}

export async function processUpload(
  file: File,
  {
    title,
    description,
    caption,
    scheduledAt,
    platformIds,
  }: {
    title: string;
    description: string;
    caption: string;
    scheduledAt: string | null;
    platformIds: string[];
  }
): Promise<UploadResult> {
  // 1. Validate platforms
  const { data: validPlatforms, error: platformError } = await supabaseAdmin
    .from("platforms")
    .select("id")
    .in("id", platformIds)
    .eq("is_active", true);

  if (
    platformError ||
    !validPlatforms ||
    validPlatforms.length !== platformIds.length
  ) {
    throw new Error("Invalid or inactive platform selection");
  }

  // 2. Create content item
  const { data: item, error: itemError } = await supabaseAdmin
    .from("content_items")
    .insert({
      title,
      description,
      processing_status: "uploaded",
      content_type: "short_video",
    })
    .select("*")
    .single();

  if (itemError) throw new Error(itemError.message);

  // 3. Upload to storage
  const storagePath = `${item.id}/${crypto.randomUUID()}-${file.name}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("temp_uploads")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  // 4. Create temporary_upload record
  const expiresAt = scheduledAt
    ? new Date(
        new Date(scheduledAt).getTime() + 24 * 60 * 60 * 1000
      ).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: upload, error: tempError } = await supabaseAdmin
    .from("temporary_uploads")
    .insert({
      content_item_id: item.id,
      storage_bucket: "temp_uploads",
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (tempError) throw new Error(tempError.message);

  // 5. Create platform_posts
  const postStatus = scheduledAt ? "scheduled" : "draft";
  const posts = [];

  for (const pid of platformIds) {
    const { data: post, error: postError } = await supabaseAdmin
      .from("platform_posts")
      .insert({
        content_item_id: item.id,
        platform_id: pid,
        title,
        caption,
        post_status: postStatus,
        scheduled_at: scheduledAt,
      })
      .select("*")
      .single();

    if (postError) throw new Error(postError.message);
    posts.push(post);
  }

  // 6. Enqueue pipeline
  await enqueueJob({
    contentItemId: item.id,
    temporaryUploadId: upload.id,
    jobType: "transcribe",
    priority: 30,
  });

  return { contentItem: item, temporaryUpload: upload, platformPosts: posts };
}
