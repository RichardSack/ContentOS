import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createEmbedding } from "@/lib/ai/embeddings";

export async function POST(req: NextRequest) {
  const { query, matchCount = 5 } = await req.json();

  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const embedding = await createEmbedding(query);

  const { data: matches, error } = await supabaseAdmin.rpc(
    "match_content_items",
    {
      query_embedding: embedding,
      match_count: matchCount,
    }
  );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [
    ...new Set((matches || []).map((m: any) => m.content_item_id)),
  ];

  const { data: items, error: itemError } = await supabaseAdmin
    .from("content_items")
    .select("*, platform_posts(*), content_documents(*)")
    .in("id", ids)
    .eq("visibility", "public")
    .eq("processing_status", "ready");

  if (itemError)
    return NextResponse.json({ error: itemError.message }, { status: 500 });

  await supabaseAdmin.from("search_logs").insert({
    query,
    result_count: ids.length,
    matched_content_item_ids: ids,
  });

  return NextResponse.json({ matches, items });
}
