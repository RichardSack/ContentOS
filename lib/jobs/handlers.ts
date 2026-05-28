import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcribeWithAssemblyAI } from "@/lib/ai/assembly";
import {
  createEmbedding,
  EMBEDDING_MODEL,
  generateSummaryAndKeywords,
} from "@/lib/ai/embeddings";
import { getPlatformAdapter } from "@/lib/platforms";
import { enqueueJob } from "./queue";

function addBackoffMinutes(attempts: number) {
  return new Date(
    Date.now() + Math.min(60, 2 ** attempts) * 60_000
  ).toISOString();
}

export async function runJob(job: any) {
  try {
    if (job.job_type === "transcribe") await handleTranscribe(job);
    else if (job.job_type === "generate_summary")
      await handleGenerateSummary(job);
    else if (job.job_type === "create_combined_document")
      await handleCreateCombinedDocument(job);
    else if (job.job_type === "create_embedding")
      await handleCreateEmbedding(job);
    else if (job.job_type === "publish_to_platform")
      await handlePublishToPlatform(job);
    else if (job.job_type === "cleanup_temp_upload")
      await handleCleanupTempUpload(job);
    else throw new Error(`Unknown job type: ${job.job_type}`);

    await supabaseAdmin
      .from("processing_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
  } catch (error: any) {
    const attempts = (job.attempts ?? 0) + 1;
    const shouldRetry = attempts < (job.max_attempts ?? 3);

    await supabaseAdmin
      .from("processing_jobs")
      .update({
        status: shouldRetry ? "pending" : "failed",
        attempts,
        last_error: error.message,
        run_after: shouldRetry ? addBackoffMinutes(attempts) : job.run_after,
        finished_at: shouldRetry ? null : new Date().toISOString(),
      })
      .eq("id", job.id);

    if (!shouldRetry && job.content_item_id) {
      await supabaseAdmin
        .from("content_items")
        .update({ processing_status: "failed" })
        .eq("id", job.content_item_id);
    }
  }
}

async function getSignedTempUrl(temporaryUploadId: string) {
  const { data: upload, error } = await supabaseAdmin
    .from("temporary_uploads")
    .select("*")
    .eq("id", temporaryUploadId)
    .single();

  if (error) throw error;

  const { data, error: signedError } = await supabaseAdmin.storage
    .from(upload.storage_bucket)
    .createSignedUrl(upload.storage_path, 60 * 60);

  if (signedError) throw signedError;

  return { upload, signedUrl: data.signedUrl };
}

async function handleTranscribe(job: any) {
  const { signedUrl } = await getSignedTempUrl(job.temporary_upload_id);
  const text = await transcribeWithAssemblyAI(signedUrl);

  const { error } = await supabaseAdmin.from("content_documents").insert({
    content_item_id: job.content_item_id,
    document_type: "transcript",
    content: text,
    language: "de",
  });

  if (error) throw error;

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: "generate_summary",
    priority: 40,
  });
}

async function handleGenerateSummary(job: any) {
  const { data: transcript, error } = await supabaseAdmin
    .from("content_documents")
    .select("*")
    .eq("content_item_id", job.content_item_id)
    .eq("document_type", "transcript")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;

  const result = await generateSummaryAndKeywords(transcript.content);

  await supabaseAdmin.from("content_documents").insert([
    {
      content_item_id: job.content_item_id,
      document_type: "summary",
      content: result.summary || "",
      language: "de",
    },
    {
      content_item_id: job.content_item_id,
      document_type: "keywords",
      content: (result.keywords || []).join(", "),
      language: "de",
      metadata: { keywords: result.keywords || [] },
    },
  ]);

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: "create_combined_document",
    priority: 50,
  });
}

async function handleCreateCombinedDocument(job: any) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from("content_items")
    .select("*")
    .eq("id", job.content_item_id)
    .single();

  if (itemError) throw itemError;

  const { data: docs, error } = await supabaseAdmin
    .from("content_documents")
    .select("*")
    .eq("content_item_id", job.content_item_id);

  if (error) throw error;

  const byType = Object.fromEntries(
    (docs || []).map((d: any) => [d.document_type, d.content])
  );

  const combined = [
    `Titel: ${item.title || ""}`,
    `Beschreibung: ${item.description || ""}`,
    `Transkript: ${byType.transcript || ""}`,
    `Zusammenfassung: ${byType.summary || ""}`,
    `Keywords: ${byType.keywords || ""}`,
  ].join("\n\n");

  const { data: doc, error: insertError } = await supabaseAdmin
    .from("content_documents")
    .insert({
      content_item_id: job.content_item_id,
      document_type: "combined",
      content: combined,
      language: item.language || "de",
    })
    .select("*")
    .single();

  if (insertError) throw insertError;

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: "create_embedding",
    priority: 60,
    payload: { documentId: doc.id },
  });
}

async function handleCreateEmbedding(job: any) {
  const documentId = job.input?.documentId;

  const { data: doc, error } = await supabaseAdmin
    .from("content_documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error) throw error;

  const embedding = await createEmbedding(doc.content);

  const { error: insertError } = await supabaseAdmin
    .from("content_embeddings")
    .insert({
      content_item_id: job.content_item_id,
      document_id: doc.id,
      embedding_model: EMBEDDING_MODEL,
      embedding,
    });

  if (insertError) throw insertError;

  await supabaseAdmin
    .from("content_items")
    .update({ processing_status: "ready" })
    .eq("id", job.content_item_id);
}

async function handlePublishToPlatform(job: any) {
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

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: "cleanup_temp_upload",
    priority: 200,
  });
}

async function handleCleanupTempUpload(job: any) {
  const { upload } = await getSignedTempUrl(job.temporary_upload_id);

  const { error } = await supabaseAdmin.storage
    .from(upload.storage_bucket)
    .remove([upload.storage_path]);

  if (error) throw error;

  await supabaseAdmin
    .from("temporary_uploads")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", upload.id);
}
