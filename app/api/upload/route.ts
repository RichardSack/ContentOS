import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth/admin";
import { enqueueJob } from "@/lib/jobs/queue";
import { validateUpload } from "@/lib/upload/validate";

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const title = String(formData.get("title") || "");
  const description = String(formData.get("description") || "");
  const caption = String(formData.get("caption") || "");
  const scheduledAtRaw = String(formData.get("scheduledAt") || "");
  const platformIdsRaw = formData.getAll("platformId") as string[];
  const platformIds = platformIdsRaw.length > 0 ? platformIdsRaw : ["tiktok"];

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const validation = validateUpload(file);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status }
    );
  }

  let scheduledAt: string | null = null;
  if (scheduledAtRaw) {
    const d = new Date(scheduledAtRaw);
    if (isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledAt" },
        { status: 400 }
      );
    }
    scheduledAt = d.toISOString();
  }

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
    return NextResponse.json(
      { error: "Invalid or inactive platform selection" },
      { status: 400 }
    );
  }

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

  if (itemError)
    return NextResponse.json({ error: itemError.message }, { status: 500 });

  const storagePath = `${item.id}/${crypto.randomUUID()}-${file.name}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("temp_uploads")
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const expiresAt = scheduledAt
    ? new Date(new Date(scheduledAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
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

  if (tempError)
    return NextResponse.json({ error: tempError.message }, { status: 500 });

  const posts = [];
  const postStatus = scheduledAt ? "scheduled" : "draft";

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

    if (postError)
      return NextResponse.json({ error: postError.message }, { status: 500 });

    posts.push(post);
  }

  await enqueueJob({
    contentItemId: item.id,
    temporaryUploadId: upload.id,
    jobType: "transcribe",
    priority: 30,
  });

  return NextResponse.json({
    contentItem: item,
    temporaryUpload: upload,
    platformPosts: posts,
  });
}
