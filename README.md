# ContentOS

Schlanke, plattformagnostische Social-Content-Suchmaschine.

**Ziel:** Videos temporär hochladen, automatisch transkribieren, semantisch indexieren und über eine öffentliche Suchseite auffindbar machen. Unterstützt geplante Veröffentlichungen auf Social-Media-Plattformen über Cronjobs.

> 📋 **Detaillierte Architektur, API-Routen und Entscheidungen** → [`CONTEXT.md`](./CONTEXT.md)

---

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS v4** (dark/black theme)
- **Supabase** (Postgres + pgvector + Storage)
- **OpenAI** (Embeddings + Summary/Keywords)
- **AssemblyAI** (Transkription)
- **Vitest** (31 Tests)

> 🔧 **Vollständiger File Tree, Job Pipeline, Adapter-Status** → [`CONTEXT.md`](./CONTEXT.md)

---

## Quickstart

```bash
npm install
cp .env.local .env.local
# .env.local mit echten Werten füllen (siehe Umgebungsvariaben)
npm run dev
```

### Supabase Setup

1. Neues Supabase-Projekt erstellen.
2. SQL Editor: Inhalt von [`schema.sql`](./schema.sql) ausführen.
3. Migrations: `migrations/001_oauth.sql` + `migrations/002_rls.sql` ausführen.
4. Storage Bucket `temp_uploads` anlegen:
   - **Private** (keine öffentlichen Leserechte)
   - Zugriff nur serverseitig über Service Role Key

---

## Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nur serverseitig** – für Storage + Admin DB |
| `OPENAI_API_KEY` | Embeddings + Summary |
| `ASSEMBLYAI_API_KEY` | Video-Transkription |
| `APP_BASE_URL` | z.B. `https://contentos.vercel.app` (für OAuth Redirects) |
| `ADMIN_SECRET` | Upload- und Admin-Seite |
| `CRON_SECRET` | Cron-Endpunkte |

### OAuth App Credentials (pro Plattform)

| Variable | Plattform |
|---|---|
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | YouTube (Google) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Instagram (via Meta) |

Nach OAuth-Callback landen die Tokens **automatisch** in `platform_accounts`. Env-Var-Token-Fallbacks existieren nur für Backwards-Kompatibilität.

---

## Architektur-Entscheidungen

- **Keine dauerhafte Videospeicherung:** Nur temporär in `temp_uploads` wird nach **allen** Plattform-Publishes gelöscht.
- **Plattformagnostisch:** Spezifische Logik lebt ausschließlich in `lib/platforms/{platform}.ts`.
- **OAuth2 statt Copy-Paste:** Admin verbindet Plattformen über `/admin` mit OAuth. Tokens rotieren sicher in `platform_accounts`.
- **RLS:** Public search liest nur `ready` + `public` Items über `match_content_items` (SECURITY DEFINER). Admin-Ops bypassen RLS via Service Role.
- **Chunked Upload:** YouTube Upload erfolgt in 8MB-Chunks (weniger RAM-Druck auf Serverless).
- **Job Queue:** `transcribe → summary → embedding` mit Retry + Locking.

> 🏗️ **Diagramm, File Tree, Pipeline** → [`CONTEXT.md`](./CONTEXT.md)

---

## OAuth Verbindung (Admin)

1. `/admin` öffnen → `ADMIN_SECRET` eingeben
2. Auf **Verbinden** bei gewünschter Plattform klicken
3. Plattform-Login bestätigen → Callback speichert Tokens in DB
4. **LinkedIn:** `owner_urn` wird **automatisch** gefetched und in `metadata` gespeichert

---

## Cronjobs

Empfohlene Frequenz:

```
*/5 * * * *  POST /api/cron/publish-scheduled   (Authorization: Bearer <CRON_SECRET>)
*/5 * * * *  POST /api/jobs/process
0 * * * *    POST /api/cron/cleanup-temp-uploads
```

---

## Deployment (Vercel)

1. Repo auf GitHub pushen
2. [vercel.com](https://vercel.com) → Projekt importieren
3. Alle Env-Variablen im Dashboard eintragen
4. Deployen (`next.config.ts` nutzt `output: 'standalone'`)
5. Cronjobs konfigurieren (z.B. Vercel Cron, GitHub Actions, oder externer Dienst)

---

## Deine persönliche TODO-Liste

1. [ ] **Supabase Projekt erstellen** + Verbindungsdaten notieren
2. [ ] **SQL ausführen:** `schema.sql` + `migrations/001_oauth.sql` + `migrations/002_rls.sql`
3. [ ] **Storage Bucket `temp_uploads`** anlegen (private)
4. [ ] **`.env.local` füllen** (alle Variablen aus `.env.example`)
5. [ ] **Starke Secrets setzen:** `ADMIN_SECRET`, `CRON_SECRET`
6. [ ] **OAuth Apps registrieren** bei TikTok, Google, LinkedIn, Meta
7. [ ] **Plattformen verbinden:** `/admin` → "Verbinden" für jede Plattform
8. [ ] **Deployen** (z.B. Vercel)
9. [ ] **Cronjobs einrichten** (3 Endpunkte mit `Authorization: Bearer <CRON_SECRET>`)
10. [ ] **Erster Upload testen:** Video hochladen, warten bis `processing_status = ready`
11. [ ] **Suche testen:** `/` öffnen, nach Keywords suchen
12. [ ] **Geplante Veröffentlichung testen** (optional)

---

*ContentOS – built for scale, ready for more platforms.*
