# Coding Agent Implementation Plan

## Projektziel

Baue eine Next.js App für eine schlanke, plattformagnostische Social-Content-Suchmaschine.

Der MVP soll zunächst TikTok unterstützen und später einfach um weitere Plattformen erweitert werden können.

Kernfunktionen:

1. Öffentliche semantische Suche über gespeicherte Content-Daten.
2. Admin-only Upload/Import von Videos.
3. Temporäre Speicherung von Videos, keine dauerhafte Archivierung.
4. Transkription mit AssemblyAI SDK.
5. Summary/Keywords und Embeddings mit OpenAI.
6. Speicherung in Supabase Postgres + pgvector.
7. Geplante Veröffentlichung über Cronjobs.
8. TikTok als erster Plattform-Adapter.
9. Dokumentation, wie weitere Plattformen ergänzt werden.

---

## Wichtige Designregeln

- Speichere keine Videodateien dauerhaft.
- Nutze Supabase Storage nur temporär über Bucket `temp_uploads`.
- Die Datenbankstruktur muss plattformagnostisch bleiben.
- TikTok darf nicht fest in die Kernlogik eingebaut werden.
- Plattform-spezifische Logik gehört ausschließlich in Adapter unter `lib/platforms/`.
- Die Suche läuft über `content_items`, `content_documents` und `content_embeddings`.
- Für den MVP reicht ein `combined` Dokument und ein Embedding pro Content Item.
- Der Admin Upload darf für öffentliche Nutzer nicht sichtbar oder zugänglich sein.
- Alle Cron-Endpunkte müssen mit `CRON_SECRET` geschützt werden.

---

## Environment Variables

Lege eine `.env.example` an:

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

APP_BASE_URL=
CRON_SECRET=
ADMIN_SECRET=
```

`ADMIN_SECRET` kann für den MVP als einfacher Schutz für Admin-Endpunkte verwendet werden. Später kann Auth ergänzt werden.

---

## Dependencies

Installiere:

```bash
npm install @supabase/supabase-js openai assemblyai
```

Falls noch nicht vorhanden:

```bash
npm install zod
```

Nutze TypeScript.

---

## Supabase Setup

### 1. Storage Bucket

Erstelle Supabase Storage Bucket:

```text
temp_uploads
```

Empfehlung:

- private bucket
- keine öffentlichen Leserechte
- Zugriff nur serverseitig über Service Role Key

### 2. SQL Schema

Führe das finale Schema aus dem Projekt-Dokument aus:

- `content_items`
- `platforms`
- `temporary_uploads`
- `platform_posts`
- `content_documents`
- `content_embeddings`
- `processing_jobs`
- `search_logs`
- Indexe
- `set_updated_at` Trigger
- `match_content_items` RPC Function

Achte darauf, dass `vector(1536)` zum verwendeten OpenAI Embedding Modell `text-embedding-3-small` passt.

---

## Ziel-Dateistruktur

Implementiere diese Struktur:

```txt
app/
  page.tsx
  admin/
    page.tsx
  api/
    upload/
      route.ts
    search/
      route.ts
    jobs/
      process/
        route.ts
    cron/
      publish-scheduled/
        route.ts
      cleanup-temp-uploads/
        route.ts
lib/
  supabase/
    admin.ts
  ai/
    assembly.ts
    embeddings.ts
  jobs/
    queue.ts
    handlers.ts
  platforms/
    types.ts
    tiktok.ts
    index.ts
  auth/
    admin.ts
README.md
.env.example
```

---

## Implementierungsschritte

## Phase 1: Projektbasis

1. Erstelle oder prüfe Next.js App mit App Router und TypeScript.
2. Richte Tailwind ein, falls noch nicht vorhanden.
3. Lege `.env.example` an.
4. Ergänze README mit:
   - Projektziel
   - Setup
   - Supabase Setup
   - Cron Setup
   - Plattform-Adapter-Erweiterung
   - TikTok Integration Notes
   - AssemblyAI Nutzung

---

## Phase 2: Supabase Admin Client

Datei: `lib/supabase/admin.ts`

Implementiere serverseitigen Supabase Client:

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

Wichtig:

- Dieser Client darf nur serverseitig genutzt werden.
- Nicht in Client Components importieren.

---

## Phase 3: Admin Protection

Datei: `lib/auth/admin.ts`

Für MVP reicht einfacher Header-Schutz:

```ts
import { NextRequest } from 'next/server';

export function assertAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.ADMIN_SECRET}`) {
    throw new Error('Unauthorized');
  }
}

export function assertCron(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Error('Unauthorized');
  }
}
```

Nutze `assertAdmin` für Upload/Admin APIs und `assertCron` für Cron/Worker APIs.

---

## Phase 4: AI Services

### AssemblyAI

Datei: `lib/ai/assembly.ts`

Nutze AssemblyAI SDK:

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

Wichtig:

- AssemblyAI muss die signierte Supabase URL abrufen können.
- Signed URL sollte lange genug gültig sein, z. B. 1 Stunde.

### OpenAI Embeddings + Summary

Datei: `lib/ai/embeddings.ts`

Implementiere:

- `createEmbedding(input: string)`
- `generateSummaryAndKeywords(transcript: string)`

Nutze:

- Embedding Modell: `text-embedding-3-small`
- Chat Modell: günstiges Modell wie `gpt-4o-mini`
- JSON response_format

---

## Phase 5: Plattform-Adapter-System

### Interface

Datei: `lib/platforms/types.ts`

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

### TikTok Adapter

Datei: `lib/platforms/tiktok.ts`

Implementiere zunächst robusten Platzhalter, der klaren Fehler wirft, falls TikTok noch nicht angebunden ist.

Danach optional TikTok Content Posting API integrieren.

Wichtig:

- TikTok-spezifische API Calls dürfen nur hier liegen.
- Kein TikTok-Code in Job Handlern außer `getPlatformAdapter('tiktok')`.

### Adapter Registry

Datei: `lib/platforms/index.ts`

```ts
import type { PlatformAdapter } from './types';
import { tiktokAdapter } from './tiktok';

const adapters: Record<string, PlatformAdapter> = {
  tiktok: tiktokAdapter,
};

export function getPlatformAdapter(platformId: string) {
  const adapter = adapters[platformId];
  if (!adapter) throw new Error(`No platform adapter registered for ${platformId}`);
  return adapter;
}
```

---

## Phase 6: Job Queue

Dateien:

- `lib/jobs/queue.ts`
- `lib/jobs/handlers.ts`

### Queue Funktionen

Implementiere:

- `enqueueJob(...)`
- `claimPendingJobs(limit)`

Achte auf:

- pending jobs mit `run_after <= now()`
- Sortierung nach `priority`, dann `created_at`
- Locking durch Statuswechsel von `pending` auf `running`
- `locked_by` mit eindeutiger Worker-ID

### Job Handler

Implementiere Handler für:

1. `transcribe`
2. `generate_summary`
3. `create_combined_document`
4. `create_embedding`
5. `publish_to_platform`
6. `cleanup_temp_upload`

Fehlerbehandlung:

- `attempts += 1`
- Retry mit exponential backoff
- nach `max_attempts` Status `failed`
- bei finalem Fehler `content_items.processing_status = failed`

Business Flow:

```text
transcribe
→ generate_summary
→ create_combined_document
→ create_embedding
→ content_items.processing_status = ready
```

Publishing Flow:

```text
publish_to_platform
→ adapter.publish(...)
→ platform_posts.post_status = published
→ cleanup_temp_upload Job enqueue
```

Cleanup Flow:

```text
cleanup_temp_upload
→ Supabase Storage Datei löschen
→ temporary_uploads.status = deleted
```

Wichtig:

- Temporäre Datei erst löschen, wenn sie für geplante Plattform-Posts nicht mehr gebraucht wird.
- Für MVP kann nach erfolgreichem TikTok Publish gelöscht werden, solange nur TikTok aktiv ist.
- Später prüfen: Sind alle Platform Posts published/failed/cancelled?

---

## Phase 7: Upload API

Datei: `app/api/upload/route.ts`

Methode: `POST`

Schutz:

- `assertAdmin(req)`

Input: `multipart/form-data`

Felder:

- `file`
- `title`
- `description`
- `caption`
- `scheduledAt`
- `platformId`, default `tiktok`

Ablauf:

1. Datei validieren.
2. `content_items` Eintrag erstellen.
3. Datei in Supabase Storage `temp_uploads` hochladen.
4. `temporary_uploads` Eintrag erstellen.
5. `platform_posts` Eintrag erstellen.
6. `transcribe` Job enqueuen.
7. Response mit IDs zurückgeben.

Validierung:

- file muss vorhanden sein
- MIME Type sollte `video/*` sein
- `scheduledAt` optional, aber wenn vorhanden valides Datum
- `platformId` muss existierende aktive Plattform sein

Status:

- `content_items.processing_status = uploaded`
- `platform_posts.post_status = scheduled`, wenn `scheduledAt` vorhanden
- sonst `draft`

---

## Phase 8: Search API

Datei: `app/api/search/route.ts`

Methode: `POST`

Input JSON:

```json
{
  "query": "KI Automatisierung",
  "matchCount": 5
}
```

Ablauf:

1. Query validieren.
2. Query Embedding erzeugen.
3. Supabase RPC `match_content_items` aufrufen.
4. Content Items mit Platform Posts und Documents laden.
5. Search Log speichern.
6. Ergebnisse sortiert nach Similarity zurückgeben.

Response sollte enthalten:

- `contentItemId`
- `title`
- `description`
- `summary`
- `keywords`
- `similarity`
- `platformPosts`

---

## Phase 9: Cron APIs

### Process Jobs

Datei: `app/api/jobs/process/route.ts`

Methode: `POST`

Schutz:

- `assertCron(req)`

Ablauf:

1. Pending Jobs claimen.
2. Jobs ausführen.
3. Ergebnis `{ processed: number }` zurückgeben.

### Publish Scheduled

Datei: `app/api/cron/publish-scheduled/route.ts`

Methode: `POST`

Schutz:

- `assertCron(req)`

Ablauf:

1. Finde `platform_posts` mit:
   - `post_status = scheduled`
   - `scheduled_at <= now()`
2. Finde zugehörigen `temporary_uploads` Eintrag.
3. Setze Post auf `publishing`.
4. Enqueue `publish_to_platform` Job.
5. Rückgabe `{ queued: number }`.

### Cleanup Temp Uploads

Datei: `app/api/cron/cleanup-temp-uploads/route.ts`

Methode: `POST`

Schutz:

- `assertCron(req)`

Ablauf:

1. Finde `temporary_uploads` mit:
   - `status = available`
   - `expires_at < now()`
2. Enqueue `cleanup_temp_upload` Jobs.
3. Rückgabe `{ queued: number }`.

---

## Phase 10: Frontend minimal anschließen

Noch keine großen Design-Anpassungen.

### Öffentliche Suche

`app/page.tsx`

- Suchfeld
- POST `/api/search`
- Ergebnisliste
- zeige Titel, Summary, Plattform-Link/Embed

### Admin-Seite

`app/admin/page.tsx`

- einfacher Schutz über Eingabe von `ADMIN_SECRET` oder Header-basierter Test
- Upload Form
- Felder:
  - Datei
  - Titel
  - Beschreibung
  - Caption
  - scheduledAt
  - Plattform-Auswahl, erstmal TikTok
- POST `/api/upload`

Wichtig:

- Admin UI nicht auf öffentlicher Seite anzeigen.
- Admin Route kann für MVP simpel sein; später echte Auth ergänzen.

---

## Phase 11: README ergänzen

README muss enthalten:

### Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

### Supabase

- Schema ausführen
- Bucket `temp_uploads` erstellen
- Service Role Key nur serverseitig verwenden

### Cronjobs

Empfohlene Frequenz:

```text
*/5 * * * * POST /api/cron/publish-scheduled
*/5 * * * * POST /api/jobs/process
0 * * * * POST /api/cron/cleanup-temp-uploads
```

Header:

```http
Authorization: Bearer <CRON_SECRET>
```

### Weitere Plattform hinzufügen

1. Datensatz in `platforms` aktivieren oder hinzufügen.
2. Adapter unter `lib/platforms/<platform>.ts` erstellen.
3. Adapter in `lib/platforms/index.ts` registrieren.
4. Keine Änderungen an Suche, Content Items oder Embeddings nötig.

### AssemblyAI

- `ASSEMBLYAI_API_KEY` setzen
- Transkription läuft über signierte Supabase URL

### TikTok

- Credentials in `.env.local` setzen
- TikTok Content Posting API im Adapter ergänzen
- Bis dahin wirft der Adapter einen klaren Fehler

---

## Qualitätssicherung

Vor Abschluss prüfen:

1. TypeScript kompiliert.
2. Keine Client Component importiert `supabaseAdmin`.
3. Upload API ist geschützt.
4. Cron APIs sind geschützt.
5. Job Queue kann Jobs ausführen.
6. AssemblyAI SDK wird korrekt genutzt.
7. Embeddings werden gespeichert.
8. Search API gibt Ergebnisse zurück.
9. Temporäre Datei wird nach Cleanup gelöscht.
10. TikTok-spezifische Logik ist isoliert im Adapter.

---

## Akzeptanzkriterien

Der MVP ist fertig, wenn:

1. Admin kann ein Video hochladen und ein Veröffentlichungsdatum setzen.
2. Video wird temporär in Supabase Storage gespeichert.
3. `content_items`, `temporary_uploads`, `platform_posts` werden erstellt.
4. Job Queue transkribiert mit AssemblyAI.
5. Summary/Keywords werden erzeugt.
6. Combined Document wird erstellt.
7. Embedding wird gespeichert.
8. Content Item wird `ready`.
9. Öffentliche Suche findet den Content semantisch.
10. Cronjob erkennt fällige Posts und erzeugt Publish Jobs.
11. TikTok Adapter ist vorbereitet und sauber isoliert.
12. Temporäre Dateien können per Cleanup Job gelöscht werden.
13. README erklärt, wie weitere Plattformen integriert werden.
