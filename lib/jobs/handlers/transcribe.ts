import { supabaseAdmin } from "@/lib/supabase/admin";
import { transcribeWithAssemblyAI } from "@/lib/ai/assembly";
import { enqueueJob } from "../queue";
import { getSignedTempUrl } from "./shared";

export async function handleTranscribe(job: any) {
  const { signedUrl } = await getSignedTempUrl(job.temporary_upload_id);
  const text = await transcribeWithAssemblyAI(signedUrl);

  const { error } = await supabaseAdmin
    .from("content_documents")
    .insert({
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
