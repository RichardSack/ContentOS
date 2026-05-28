import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateSummaryAndKeywords } from "@/lib/ai/embeddings";
import { enqueueJob } from "../queue";

export async function handleGenerateSummary(job: any) {
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
