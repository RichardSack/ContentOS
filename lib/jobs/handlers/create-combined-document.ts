import { supabaseAdmin } from "@/lib/supabase/admin";
import { enqueueJob } from "../queue";

export async function handleCreateCombinedDocument(job: any) {
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
