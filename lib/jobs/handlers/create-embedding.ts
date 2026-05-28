import { supabaseAdmin } from "@/lib/supabase/admin";
import { createEmbedding, EMBEDDING_MODEL } from "@/lib/ai/embeddings";

export async function handleCreateEmbedding(job: any) {
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
