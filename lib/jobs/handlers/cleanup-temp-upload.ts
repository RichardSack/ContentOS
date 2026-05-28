import { supabaseAdmin } from "@/lib/supabase/admin";

export async function handleCleanupTempUpload(job: any) {
  const { data: upload, error: uploadError } = await supabaseAdmin
    .from("temporary_uploads")
    .select("*")
    .eq("id", job.temporary_upload_id)
    .single();

  if (uploadError) throw uploadError;
  if (!upload) throw new Error("Upload not found");

  if (upload.status === "deleted") {
    // Idempotent: already cleaned up by a sibling platform post
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(upload.storage_bucket)
    .remove([upload.storage_path]);

  if (removeError) {
    // Tolerate "not found" — file may have been removed already
    console.warn(
      "Cleanup: storage remove returned error:",
      removeError.message
    );
  }

  await supabaseAdmin
    .from("temporary_uploads")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", upload.id);
}
