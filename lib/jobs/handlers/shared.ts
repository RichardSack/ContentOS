import { supabaseAdmin } from "@/lib/supabase/admin";

export function addBackoffMinutes(attempts: number): string {
  return new Date(
    Date.now() + Math.min(60, 2 ** attempts) * 60_000
  ).toISOString();
}

export async function getSignedTempUrl(temporaryUploadId: string) {
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

  return { upload, signedUrl: data.signedUrl as string };
}
