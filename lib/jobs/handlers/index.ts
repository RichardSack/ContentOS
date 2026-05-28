import { supabaseAdmin } from "@/lib/supabase/admin";
import { handleCleanupTempUpload } from "./cleanup-temp-upload";
import { handleCreateCombinedDocument } from "./create-combined-document";
import { handleCreateEmbedding } from "./create-embedding";
import { handleGenerateSummary } from "./generate-summary";
import { handlePublishToPlatform } from "./publish-to-platform";
import { handleTranscribe } from "./transcribe";
import { addBackoffMinutes } from "./shared";

const HANDLERS: Record<string, (job: any) => Promise<void>> = {
  transcribe: handleTranscribe,
  generate_summary: handleGenerateSummary,
  create_combined_document: handleCreateCombinedDocument,
  create_embedding: handleCreateEmbedding,
  publish_to_platform: handlePublishToPlatform,
  cleanup_temp_upload: handleCleanupTempUpload,
};

export async function runJob(job: any) {
  const handler = HANDLERS[job.job_type];
  if (!handler) {
    throw new Error(`Unknown job type: ${job.job_type}`);
  }

  try {
    await handler(job);

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
