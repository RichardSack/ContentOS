-- Row-Level Security (RLS) for multi-user-ready ContentOS
-- Admin/service-role bypasses RLS by design.
-- Public search must only return published content.

-- Enable RLS on the two tables that may be queried directly by public clients
alter table content_items enable row level security;
alter table platforms enable row level security;

-- Ensure no other tables accidentally allow direct client access
alter table temporary_uploads force row level security;
alter table processing_jobs force row level security;
alter table platform_posts force row level security;
alter table platform_accounts force row level security;
alter table oauth_states force row level security;
alter table search_logs force row level security;

-- Public read: only ready and public content items
CREATE POLICY "content_items_public_read"
ON content_items
FOR SELECT
TO anon, authenticated
USING (visibility = 'public' AND processing_status = 'ready');

-- Public read: only active platforms (used in admin dropdown + search)
CREATE POLICY "platforms_public_read"
ON platforms
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- ============================================
-- CRITICAL: match_content_items must run as its owner,
-- otherwise anon calls will be blocked from reading embeddings
-- (embeddings have no RLS policy → service-role bypasses)
-- ============================================
CREATE OR REPLACE FUNCTION match_content_items (
  query_embedding vector(1536),
  match_count int default 5
)
RETURNS TABLE (
  content_item_id uuid,
  document_id uuid,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    ce.content_item_id,
    ce.document_id,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM content_embeddings ce
  JOIN content_items ci ON ci.id = ce.content_item_id
  WHERE ci.visibility = 'public'
    AND ci.processing_status = 'ready'
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Revoke execute on match_content_items from public so anon/authenticated
-- can only use it via the REST API (Supabase auto-exposes it through PostgREST)
REVOKE ALL ON FUNCTION match_content_items(vector, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION match_content_items(vector, int) TO anon, authenticated;
