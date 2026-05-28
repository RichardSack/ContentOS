# Social Content Search MVP

## Ziel

Schlanke, plattformagnostische Web-App für:

- temporären Video-Upload
- Transkription mit AssemblyAI
- Erstellung eines Suchdokuments
- Embedding-Erzeugung
- Supabase Vector Search
- geplante Veröffentlichung per Cronjobs
- TikTok als erste Plattform
- einfache Erweiterung weiterer Plattformen

## Tech Stack

- Next.js App Router
- Supabase Postgres + pgvector
- Supabase Storage Bucket `temp_uploads`
- AssemblyAI SDK für Transkription
- OpenAI Embeddings für Vektorsuche
- TikTok Adapter als erste Social-Plattform
- Cron-Endpunkte mit `CRON_SECRET`

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
ASSEMBLYAI_API_KEY=

TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=
TIKTOK_ACCESS_TOKEN=
TIKTOK_REFRESH_TOKEN=

YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
LINKEDIN_REFRESH_TOKEN=

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=

APP_BASE_URL=
CRON_SECRET=
```

## Supabase Schema

```sql
create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null default 'short_video',
  title text,
  description text,
  language text default 'de',
  visibility text not null default 'public',
  processing_status text not null default 'draft',
  duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platforms (
  id text primary key,
  name text not null,
  supports_upload boolean not null default false,
  supports_embed boolean not null default false,
  supports_metrics boolean not null default false,
  is_active boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into platforms (id, name, supports_upload, supports_embed, supports_metrics, is_active)
values
  ('tiktok', 'TikTok', true, true, true, true),
  ('youtube', 'YouTube', true, true, true, true),
  ('instagram', 'Instagram', true, true, true, true),
  ('linkedin', 'LinkedIn', true, true, true, true)
on conflict (id) do nothing;

-- Neue Tabelle für Multi-User OAuth Token Management
create table if not exists platform_accounts (
  id uuid primary key default gen_random_uuid(),
  platform_id text not null references platforms(id),
  account_name text,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_accounts_active
on platform_accounts (platform_id, is_active)
where is_active = true;

create table if not exists temporary_uploads (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  storage_bucket text not null default 'temp_uploads',
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  duration_seconds integer,
  status text not null default 'available',
  expires_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_posts (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  platform_id text not null references platforms(id),
  platform_post_id text,
  platform_url text,
  embed_url text,
  thumbnail_url text,
  title text,
  caption text,
  post_status text not null default 'draft',
  scheduled_at timestamptz,
  posted_at timestamptz,
  publish_attempts integer not null default 0,
  last_publish_error text,
  metrics jsonb not null default '{}'::jsonb,
  api_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform_id, platform_post_id)
);

create table if not exists content_documents (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  document_type text not null,
  content text not null,
  language text default 'de',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_embeddings (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  document_id uuid not null references content_documents(id) on delete cascade,
  embedding_model text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references content_items(id) on delete cascade,
  platform_post_id uuid references platform_posts(id) on delete set null,
  temporary_upload_id uuid references temporary_uploads(id) on delete set null,
  job_type text not null,
  status text not null default 'pending',
  priority integer not null default 100,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists search_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  result_count integer,
  matched_content_item_ids uuid[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_posts_scheduled
on platform_posts (post_status, scheduled_at)
where post_status = 'scheduled';

create index if not exists idx_processing_jobs_queue
on processing_jobs (status, run_after, priority, created_at)
where status = 'pending';

create index if not exists idx_content_documents_content_item
on content_documents (content_item_id);

create index if not exists idx_content_embeddings_embedding
on content_embeddings
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_content_items_updated_at
before update on content_items
for each row execute function set_updated_at();

create trigger set_temporary_uploads_updated_at
before update on temporary_uploads
for each row execute function set_updated_at();

create trigger set_platform_posts_updated_at
before update on platform_posts
for each row execute function set_updated_at();

create trigger set_content_documents_updated_at
before update on content_documents
for each row execute function set_updated_at();

create trigger set_processing_jobs_updated_at
before update on processing_jobs
for each row execute function set_updated_at();

create or replace function match_content_items (
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  content_item_id uuid,
  document_id uuid,
  similarity float
)
language sql stable
as $$
  select
    ce.content_item_id,
    ce.document_id,
    1 - (ce.embedding <=> query_embedding) as similarity
  from content_embeddings ce
  join content_items ci on ci.id = ce.content_item_id
  where ci.visibility = 'public'
    and ci.processing_status = 'ready'
  order by ce.embedding <=> query_embedding
  limit match_count;
$$;
```

## App-Struktur

```txt
app/
  page.tsx
  layout.tsx
  globals.css
  admin/page.tsx
  api/
    upload/route.ts
    search/route.ts
    jobs/process/route.ts
    cron/publish-scheduled/route.ts
    cron/cleanup-temp-uploads/route.ts
lib/
  supabase/admin.ts
  supabase/client.ts
  auth/admin.ts
  ai/assembly.ts
  ai/embeddings.ts
  platforms/types.ts
  platforms/account.ts
  platforms/utils.ts
  platforms/tiktok.ts
  platforms/youtube.ts
  platforms/linkedin.ts
  platforms/instagram.ts
  platforms/index.ts
  jobs/handlers.ts
  jobs/queue.ts
.env.example
schema.sql
```

## AssemblyAI SDK Integration

```ts
import { AssemblyAI } from 'assemblyai';

export const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export async function transcribeWithAssemblyAI(fileUrl: string) {
  const transcript = await assemblyClient.transcripts.transcribe({
    audio: fileUrl,
    language_code: 'de',
    punctuate: true,
    format_text: true,
  });

  if (transcript.status === 'error') {
    throw new Error(transcript.error || 'AssemblyAI transcription failed');
  }

  return transcript.text || '';
}
```

## Plattform-Adapter Interface

```ts
export type PublishInput = {
  temporaryUploadUrl: string;
  title?: string;
  caption?: string;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
};

export type PublishResult = {
  platformPostId?: string;
  platformUrl?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  rawResponse?: unknown;
};

export interface PlatformAdapter {
  platformId: string;
  publish(input: PublishInput): Promise<PublishResult>;
}
```

## Plattform-Adapter

### TikTok

Voll implementiert. OAuth2 Refresh + Content Posting API (`PULL_FROM_URL`).

### YouTube

Voll implementiert. Resumable Upload via Data API v3.

### LinkedIn

Voll implementiert. 3-Step Upload: `registerUpload` → PUT Bytes → `ugcPosts`.

### Instagram

⚠️ Experimental. Graph API Container-Flow mit Polling. Erfordert Business Account.

### Alle Adapter
Laden Credentials bevorzugt aus `platform_accounts` (DB) mit Fallback auf `.env.local`.
Token-Rotation wird automatisch persistiert.
```

## Pipeline-Übersicht

```text
1. Temp Upload
2. AssemblyAI Transkription
3. Summary + Keywords
4. Combined Document
5. Embedding
6. Supabase Vector Search
7. Cron Publishing
8. Cleanup Temp Upload
```

## Job Pipeline

### Upload erzeugt Jobs

Nach Upload eines Videos:

1. `transcribe`
2. `generate_summary`
3. `generate_keywords`
4. `create_combined_document`
5. `create_embedding`

### Scheduled Publishing

Cronjob findet fällige `platform_posts`:

```sql
select *
from platform_posts
where post_status = 'scheduled'
  and scheduled_at <= now();
```

Dann wird ein Job erstellt:

```text
job_type = publish_to_platform
```

### Cleanup

Nach erfolgreicher Veröffentlichung auf **allen** geplanten Plattformen:

1. `publish_to_platform` prüft ob ALLE sibling `platform_posts` finished sind (`published`/`failed`/`cancelled`).
2. Nur dann wird `cleanup_temp_upload` Job enqueued.
3. Cleanup ist idempotent (`status === 'deleted'` wird übersprungen).

## Nächster Build-Schritt

1. Next.js Projekt anlegen
2. Dependencies installieren:
   - `@supabase/supabase-js`
   - `openai`
   - `assemblyai`
3. `.env.example` erstellen
4. Supabase SQL ausführen
5. API-Routen implementieren
6. Admin Upload UI bauen
7. Search UI bauen
8. TikTok Adapter finalisieren
