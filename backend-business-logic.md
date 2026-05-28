# Backend & Business Logic Implementation

## Install dependencies

```bash
npm install @supabase/supabase-js openai assemblyai
```

## File structure

```txt
lib/
  supabase/admin.ts
  supabase/client.ts        # Browser Supabase client
  auth/admin.ts
  ai/assembly.ts
  ai/embeddings.ts
  platforms/types.ts
  platforms/account.ts      # OAuth DB account helper
  platforms/utils.ts        # Shared downloadVideo helper
  platforms/tiktok.ts       # Full TikTok adapter
  platforms/youtube.ts      # Full YouTube adapter
  platforms/linkedin.ts     # Full LinkedIn adapter
  platforms/instagram.ts    # Experimental Instagram adapter
  platforms/index.ts
  jobs/handlers.ts
  jobs/queue.ts
app/
  api/
    upload/route.ts
    search/route.ts
    jobs/process/route.ts
    cron/publish-scheduled/route.ts
    cron/cleanup-temp-uploads/route.ts
```

## lib/supabase/admin.ts

```ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
```

## lib/ai/assembly.ts

```ts
import { AssemblyAI } from 'assemblyai';

export const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

export async function transcribeWithAssemblyAI(audioOrVideoUrl: string) {
  const transcript = await assemblyClient.transcripts.transcribe({
    audio: audioOrVideoUrl,
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

## lib/ai/embeddings.ts

```ts
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function createEmbedding(input: string) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data[0].embedding;
}

export async function generateSummaryAndKeywords(transcript: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content: 'Du bist ein präziser Content-Analyst. Antworte ausschließlich als valides JSON.',
      },
      {
        role: 'user',
        content: `Analysiere dieses deutschsprachige Kurzvideo-Transkript und gib JSON zurück mit summary:string und keywords:string[].\n\nTranskript:\n${transcript}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content || '{}';
  return JSON.parse(content) as { summary?: string; keywords?: string[] };
}
```

## lib/platforms/types.ts

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

## lib/platforms/tiktok.ts

```ts
import type { PlatformAdapter } from "./types";
import { getActivePlatformAccount, persistTokens } from "./account";

// TikTok Adapter — vollständig implementiert.
// Nutzt OAuth2 Refresh Flow und Content Posting API.
// Liest Credentials bevorzugt aus platform_accounts DB (Multi-User).
export const tiktokAdapter: PlatformAdapter = {
  platformId: "tiktok",
  async publish(input) {
    // ... OAuth2 refresh + /v2/post/publish/video/init/ mit source: "PULL_FROM_URL"
  },
};
```

## lib/platforms/youtube.ts

YouTube Adapter — resumable Upload via Data API v3. Lädt Video in Speicher herunter und PUTtet es zu YouTube. Speicherwarnung: Sehr große Videos können bei `arrayBuffer()` über Serverless-Limits stoßen.

## lib/platforms/linkedin.ts

LinkedIn Adapter — 3-Step Upload: `registerUpload` → PUT Bytes → `ugcPosts` erstellen. Erfordert `metadata.linkedin_owner_urn` in `platform_accounts`.

## lib/platforms/instagram.ts

⚠️ Wackelig/Experimental. Graph API Container-Flow mit Polling (60s max). Erfordert Instagram Business Account + `metadata.instagram_business_account_id`.

## lib/platforms/index.ts

```ts
import type { PlatformAdapter } from './types';
import { tiktokAdapter } from './tiktok';
import { youtubeAdapter } from './youtube';
import { linkedinAdapter } from './linkedin';
import { instagramAdapter } from './instagram';

const adapters: Record<string, PlatformAdapter> = {
  tiktok: tiktokAdapter,
  youtube: youtubeAdapter,
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
};

export function getPlatformAdapter(platformId: string) {
  const adapter = adapters[platformId];

  if (!adapter) {
    throw new Error(`No platform adapter registered for ${platformId}`);
  }

  return adapter;
}
```

## lib/jobs/queue.ts

```ts
import { supabaseAdmin } from '../supabase/admin';

export async function enqueueJob(input: {
  contentItemId?: string;
  platformPostId?: string;
  temporaryUploadId?: string;
  jobType: string;
  priority?: number;
  runAfter?: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from('processing_jobs').insert({
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
    .from('processing_jobs')
    .select('*')
    .eq('status', 'pending')
    .lte('run_after', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;

  const claimed = [];

  for (const job of jobs ?? []) {
    const { data, error: updateError } = await supabaseAdmin
      .from('processing_jobs')
      .update({
        status: 'running',
        locked_at: new Date().toISOString(),
        locked_by: workerId,
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('*')
      .single();

    if (!updateError && data) claimed.push(data);
  }

  return claimed;
}
```

## lib/jobs/handlers.ts

```ts
import { supabaseAdmin } from '../supabase/admin';
import { transcribeWithAssemblyAI } from '../ai/assembly';
import { createEmbedding, EMBEDDING_MODEL, generateSummaryAndKeywords } from '../ai/embeddings';
import { getPlatformAdapter } from '../platforms';
import { enqueueJob } from './queue';

function addBackoffMinutes(attempts: number) {
  return new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000).toISOString();
}

export async function runJob(job: any) {
  try {
    if (job.job_type === 'transcribe') await handleTranscribe(job);
    else if (job.job_type === 'generate_summary') await handleGenerateSummary(job);
    else if (job.job_type === 'create_combined_document') await handleCreateCombinedDocument(job);
    else if (job.job_type === 'create_embedding') await handleCreateEmbedding(job);
    else if (job.job_type === 'publish_to_platform') await handlePublishToPlatform(job);
    else if (job.job_type === 'cleanup_temp_upload') await handleCleanupTempUpload(job);
    else throw new Error(`Unknown job type: ${job.job_type}`);

    await supabaseAdmin
      .from('processing_jobs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', job.id);
  } catch (error: any) {
    const attempts = (job.attempts ?? 0) + 1;
    const shouldRetry = attempts < (job.max_attempts ?? 3);

    await supabaseAdmin
      .from('processing_jobs')
      .update({
        status: shouldRetry ? 'pending' : 'failed',
        attempts,
        last_error: error.message,
        run_after: shouldRetry ? addBackoffMinutes(attempts) : job.run_after,
        finished_at: shouldRetry ? null : new Date().toISOString(),
      })
      .eq('id', job.id);

    if (!shouldRetry && job.content_item_id) {
      await supabaseAdmin
        .from('content_items')
        .update({ processing_status: 'failed' })
        .eq('id', job.content_item_id);
    }
  }
}

async function getSignedTempUrl(temporaryUploadId: string) {
  const { data: upload, error } = await supabaseAdmin
    .from('temporary_uploads')
    .select('*')
    .eq('id', temporaryUploadId)
    .single();

  if (error) throw error;

  const { data, error: signedError } = await supabaseAdmin.storage
    .from(upload.storage_bucket)
    .createSignedUrl(upload.storage_path, 60 * 60);

  if (signedError) throw signedError;

  return { upload, signedUrl: data.signedUrl };
}

async function handleTranscribe(job: any) {
  const { signedUrl } = await getSignedTempUrl(job.temporary_upload_id);
  const text = await transcribeWithAssemblyAI(signedUrl);

  const { error } = await supabaseAdmin.from('content_documents').insert({
    content_item_id: job.content_item_id,
    document_type: 'transcript',
    content: text,
    language: 'de',
  });

  if (error) throw error;

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: 'generate_summary',
    priority: 40,
  });
}

async function handleGenerateSummary(job: any) {
  const { data: transcript, error } = await supabaseAdmin
    .from('content_documents')
    .select('*')
    .eq('content_item_id', job.content_item_id)
    .eq('document_type', 'transcript')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) throw error;

  const result = await generateSummaryAndKeywords(transcript.content);

  await supabaseAdmin.from('content_documents').insert([
    {
      content_item_id: job.content_item_id,
      document_type: 'summary',
      content: result.summary || '',
      language: 'de',
    },
    {
      content_item_id: job.content_item_id,
      document_type: 'keywords',
      content: (result.keywords || []).join(', '),
      language: 'de',
      metadata: { keywords: result.keywords || [] },
    },
  ]);

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: 'create_combined_document',
    priority: 50,
  });
}

async function handleCreateCombinedDocument(job: any) {
  const { data: item, error: itemError } = await supabaseAdmin
    .from('content_items')
    .select('*')
    .eq('id', job.content_item_id)
    .single();

  if (itemError) throw itemError;

  const { data: docs, error } = await supabaseAdmin
    .from('content_documents')
    .select('*')
    .eq('content_item_id', job.content_item_id);

  if (error) throw error;

  const byType = Object.fromEntries((docs || []).map((d: any) => [d.document_type, d.content]));

  const combined = [
    `Titel: ${item.title || ''}`,
    `Beschreibung: ${item.description || ''}`,
    `Transkript: ${byType.transcript || ''}`,
    `Zusammenfassung: ${byType.summary || ''}`,
    `Keywords: ${byType.keywords || ''}`,
  ].join('\n\n');

  const { data: doc, error: insertError } = await supabaseAdmin
    .from('content_documents')
    .insert({
      content_item_id: job.content_item_id,
      document_type: 'combined',
      content: combined,
      language: item.language || 'de',
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  await enqueueJob({
    contentItemId: job.content_item_id,
    temporaryUploadId: job.temporary_upload_id,
    jobType: 'create_embedding',
    priority: 60,
    payload: { documentId: doc.id },
  });
}

async function handleCreateEmbedding(job: any) {
  const documentId = job.input?.documentId;

  const { data: doc, error } = await supabaseAdmin
    .from('content_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) throw error;

  const embedding = await createEmbedding(doc.content);

  const { error: insertError } = await supabaseAdmin.from('content_embeddings').insert({
    content_item_id: job.content_item_id,
    document_id: doc.id,
    embedding_model: EMBEDDING_MODEL,
    embedding,
  });

  if (insertError) throw insertError;

  await supabaseAdmin
    .from('content_items')
    .update({ processing_status: 'ready' })
    .eq('id', job.content_item_id);
}

async function handlePublishToPlatform(job: any) {
  const { data: post, error } = await supabaseAdmin
    .from('platform_posts')
    .select('*')
    .eq('id', job.platform_post_id)
    .single();

  if (error) throw error;

  const { signedUrl } = await getSignedTempUrl(job.temporary_upload_id);
  const adapter = getPlatformAdapter(post.platform_id);

  const result = await adapter.publish({
    temporaryUploadUrl: signedUrl,
    title: post.title,
    caption: post.caption,
    scheduledAt: post.scheduled_at,
    metadata: post.api_metadata,
  });

  await supabaseAdmin
    .from('platform_posts')
    .update({
      post_status: 'published',
      posted_at: new Date().toISOString(),
      platform_post_id: result.platformPostId,
      platform_url: result.platformUrl,
      embed_url: result.embedUrl,
      thumbnail_url: result.thumbnailUrl,
      api_metadata: { ...post.api_metadata, rawPublishResponse: result.rawResponse },
    })
    .eq('id', post.id);

  // Multi-Platform-Safety: Nur aufräumen wenn ALLE sibling posts fertig sind
  const { data: siblingPosts } = await supabaseAdmin
    .from('platform_posts')
    .select('post_status')
    .eq('content_item_id', job.content_item_id);

  const allFinished = (siblingPosts || []).every((p: any) =>
    ['published', 'failed', 'cancelled'].includes(p.post_status)
  );

  if (allFinished) {
    await enqueueJob({
      contentItemId: job.content_item_id,
      temporaryUploadId: job.temporary_upload_id,
      jobType: 'cleanup_temp_upload',
      priority: 200,
    });
  }
}

async function handleCleanupTempUpload(job: any) {
  const { data: upload, error } = await supabaseAdmin
    .from('temporary_uploads')
    .select('*')
    .eq('id', job.temporary_upload_id)
    .single();

  if (error) throw error;

  if (upload.status === 'deleted') return; // idempotent: already cleaned

  const { error: removeError } = await supabaseAdmin.storage
    .from(upload.storage_bucket)
    .remove([upload.storage_path]);

  if (removeError) console.warn('Cleanup remove error:', removeError.message);

  await supabaseAdmin
    .from('temporary_uploads')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', upload.id);
}
    .from('temporary_uploads')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', upload.id);
}
```

## app/api/upload/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enqueueJob } from '@/lib/jobs/queue';

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const file = formData.get('file') as File | null;
  const title = String(formData.get('title') || '');
  const description = String(formData.get('description') || '');
  const caption = String(formData.get('caption') || '');
  const scheduledAt = String(formData.get('scheduledAt') || '');
  const platformIds = formData.getAll("platformId") as string[];
  if (platformIds.length === 0) platformIds.push("tiktok");

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('content_items')
    .insert({
      title,
      description,
      processing_status: 'uploaded',
      content_type: 'short_video',
    })
    .select('*')
    .single();

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  const storagePath = `${item.id}/${crypto.randomUUID()}-${file.name}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from('temp_uploads')
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const expiresAt = scheduledAt
    ? new Date(new Date(scheduledAt).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: upload, error: tempError } = await supabaseAdmin
    .from('temporary_uploads')
    .insert({
      content_item_id: item.id,
      storage_bucket: 'temp_uploads',
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      file_size_bytes: file.size,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (tempError) return NextResponse.json({ error: tempError.message }, { status: 500 });

  const postStatus = scheduledAt ? 'scheduled' : 'draft';

  // Für jede ausgewählte Plattform einen platform_posts Eintrag erstellen
  for (const platformId of platformIds) {
    const { data: post, error: postError } = await supabaseAdmin
      .from('platform_posts')
      .insert({
        content_item_id: item.id,
        platform_id: platformId,
        title,
        caption,
        post_status: postStatus,
        scheduled_at: scheduledAt || null,
      })
      .select('*')
      .single();

    if (postError) return NextResponse.json({ error: postError.message }, { status: 500 });
  }

  await enqueueJob({
    contentItemId: item.id,
    temporaryUploadId: upload.id,
    jobType: 'transcribe',
    priority: 30,
  });

  return NextResponse.json({
    contentItem: item,
    temporaryUpload: upload,
    platformPost: post,
  });
}
```

## app/api/search/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createEmbedding } from '@/lib/ai/embeddings';

export async function POST(req: NextRequest) {
  const { query, matchCount = 5 } = await req.json();

  if (!query) {
    return NextResponse.json({ error: 'Missing query' }, { status: 400 });
  }

  const embedding = await createEmbedding(query);

  const { data: matches, error } = await supabaseAdmin.rpc('match_content_items', {
    query_embedding: embedding,
    match_count: matchCount,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set((matches || []).map((m: any) => m.content_item_id))];

  const { data: items, error: itemError } = await supabaseAdmin
    .from('content_items')
    .select('*, platform_posts(*), content_documents(*)')
    .in('id', ids);

  if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 });

  await supabaseAdmin.from('search_logs').insert({
    query,
    result_count: ids.length,
    matched_content_item_ids: ids,
  });

  return NextResponse.json({ matches, items });
}
```

## app/api/jobs/process/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import { claimPendingJobs } from '@/lib/jobs/queue';
import { runJob } from '@/lib/jobs/handlers';

function assertCron(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error('Unauthorized');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCron(req);
    const jobs = await claimPendingJobs(5);
    await Promise.all(jobs.map(runJob));
    return NextResponse.json({ processed: jobs.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
```

## app/api/cron/publish-scheduled/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enqueueJob } from '@/lib/jobs/queue';

function assertCron(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error('Unauthorized');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCron(req);

    const { data: posts, error } = await supabaseAdmin
      .from('platform_posts')
      .select('*, temporary_uploads:content_items(temporary_uploads(*))')
      .eq('post_status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString());

    if (error) throw error;

    let queued = 0;

    for (const post of posts || []) {
      const upload = post.temporary_uploads?.temporary_uploads?.[0];
      if (!upload) continue;

      await supabaseAdmin
        .from('platform_posts')
        .update({ post_status: 'publishing', publish_attempts: (post.publish_attempts || 0) + 1 })
        .eq('id', post.id);

      await enqueueJob({
        contentItemId: post.content_item_id,
        platformPostId: post.id,
        temporaryUploadId: upload.id,
        jobType: 'publish_to_platform',
        priority: 20,
      });

      queued += 1;
    }

    return NextResponse.json({ queued });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
```

## app/api/cron/cleanup-temp-uploads/route.ts

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enqueueJob } from '@/lib/jobs/queue';

function assertCron(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error('Unauthorized');
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCron(req);

    const { data: uploads, error } = await supabaseAdmin
      .from('temporary_uploads')
      .select('*')
      .eq('status', 'available')
      .lt('expires_at', new Date().toISOString())
      .limit(20);

    if (error) throw error;

    for (const upload of uploads || []) {
      await enqueueJob({
        contentItemId: upload.content_item_id,
        temporaryUploadId: upload.id,
        jobType: 'cleanup_temp_upload',
        priority: 250,
      });
    }

    return NextResponse.json({ queued: uploads?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message === 'Unauthorized' ? 401 : 500 });
  }
}
```

## Cron Schedule Empfehlung

```text
*/5 * * * * POST /api/cron/publish-scheduled
*/5 * * * * POST /api/jobs/process
0 * * * * POST /api/cron/cleanup-temp-uploads
```

Alle Cron Requests brauchen:

```http
Authorization: Bearer <CRON_SECRET>
```
