import { supabaseAdmin } from "@/lib/supabase/admin";

export async function enqueueJob(input: {
  contentItemId?: string;
  platformPostId?: string;
  temporaryUploadId?: string;
  jobType: string;
  priority?: number;
  runAfter?: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("processing_jobs").insert({
    content_item_id: input.contentItemId,
    platform_post_id: input.platformPostId,
    temporary_upload_id: input.temporaryUploadId,
    job_type: input.jobType,
    priority: input.priority ?? 100,
    run_after: input.runAfter ?? new Date().toISOString(),
    input: input.payload ?? {},
  });

  if (error) throw error;
}

export async function claimPendingJobs(limit = 5) {
  const workerId = `worker-${crypto.randomUUID()}`;

  const { data: jobs, error } = await supabaseAdmin
    .from("processing_jobs")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const claimed = [];

  for (const job of jobs ?? []) {
    const { data, error: updateError } = await supabaseAdmin
      .from("processing_jobs")
      .update({
        status: "running",
        locked_at: new Date().toISOString(),
        locked_by: workerId,
        started_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("*")
      .single();

    if (!updateError && data) claimed.push(data);
  }

  return claimed;
}
