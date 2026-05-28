# ContentOS

Schlanke, plattformagnostische Social-Content-Suchmaschine.

**Ziel:** Videos temporär hochladen, automatisch transkribieren, semantisch indexieren und über eine öffentliche Suchseite auffindbar machen. Unterstützt geplante Veröffentlichungen auf Social-Media-Plattformen über Cronjobs.

---

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS** (dark/black theme)
- **Supabase** (Postgres + pgvector + Storage)
- **OpenAI** (Embeddings + Summary/Keywords)
- **AssemblyAI** (Transkription)
- **TikTok** (erste Plattform, vorbereitet aber noch nicht final implementiert)

---

## Setup

```bash
npm install
cp .env.example .env.local
# .env.local mit echten Werten füllen
npm run dev
```

---

## Supabase Setup

1. Neues Supabase-Projekt erstellen.
2. In der SQL Editor Konsole den Inhalt von [`schema.sql`](./schema.sql) ausführen.
3. Storage Bucket `temp_uploads` erstellen:
   - Name: `temp_uploads`
   - **Private** (keine öffentlichen Leserechte)
   - Zugriff nur serverseitig über den Service Role Key.

---

## Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Deine Supabase Projekt-URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key (Client-seitig) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Nur serverseitig** – für Storage und DB Admin-Zugriff |
| `OPENAI_API_KEY` | Für Embeddings und Summary/Keywords |
| `ASSEMBLYAI_API_KEY` | Für Video-Transkription |
| `TIKTOK_CLIENT_KEY` | TikTok App Client Key (optional) |
| `TIKTOK_CLIENT_SECRET` | TikTok App Client Secret (optional) |
| `TIKTOK_ACCESS_TOKEN` | TikTok Access Token (optional) |
| `TIKTOK_REFRESH_TOKEN` | TikTok Refresh Token (optional) |
| `APP_BASE_URL` | Basis-URL der App, z.B. `https://contentos.vercel.app` |
| `CRON_SECRET` | Geheimer Token für Cron-Endpunkte |
| `ADMIN_SECRET` | Geheimer Token für Upload- und Admin-Seite |

---

## Architektur-Entscheidungen

- **Keine dauerhafte Videopeicherung:** Videos landen nur temporär in `temp_uploads` und werden nach erfolgreichem Publish gelöscht.
- **Plattformagnostisch:** Alle plattformspezifischen Logik lebt ausschließlich in `lib/platforms/<platform>.ts`.
- **Job Queue:** Die Pipeline `transcribe → summary → combined document → embedding` läuft über `processing_jobs` mit Retry-Logik.
- **Admin-Schutz:** Upload-Endpunkte und `/admin` erfordern `Bearer ADMIN_SECRET`.

---

## Cronjobs

Empfohlene Frequenz:

```
*/5 * * * *  POST /api/cron/publish-scheduled
*/5 * * * *  POST /api/jobs/process
0 * * * *    POST /api/cron/cleanup-temp-uploads
```

**Header für alle Cron-Requests:**

```http
Authorization: Bearer <CRON_SECRET>
```

---

## Deployment (Vercel)

Diese App ist optimiert für **Vercel**:

1. Repo auf GitHub pushen.
2. Neues Projekt auf [vercel.com](https://vercel.com) importieren.
3. Umgebungsvariablen in den Vercel-Projekt-Einstellungen eintragen.
4. Deployen – `next.config.ts` nutzt `output: 'standalone'` für einfaches Hosting.

Alternativ funktioniert auch jeder andere Node.js-Hosting-Anbieter.

---

## Weitere Plattform hinzufügen

1. Datensatz in Tabelle `platforms` aktivieren oder hinzufügen.
2. Adapter unter `lib/platforms/<platform>.ts` erstellen (siehe `types.ts`).
3. Adapter in `lib/platforms/index.ts` registrieren.
4. Keine Änderungen an Suche, Content Items oder Embeddings nötig.

---

## AssemblyAI

- `ASSEMBLYAI_API_KEY` setzen.
- Transkription läuft über **signierte Supabase URLs** (1 Stunde gültig).
- Sprache ist auf `de` (Deutsch) eingestellt.

---

## TikTok Integration

- Credentials in `.env.local` setzen.
- Content Posting API in `lib/platforms/tiktok.ts` ergänzen.
- Bis dahin wirft der Adapter einen klaren Fehler, der im Job-Log landet.

---

## Admin-Seite nutzen

1. Öffne `/admin` im Browser.
2. Gib dein `ADMIN_SECRET` ein – es wird lokal im Browser gespeichert.
3. Lade ein Video hoch. Alle weiteren Schritte (Transkription, Summary, Embedding) laufen automatisch über die Job Queue.

---

## Deine persönliche TODO-Liste

Um ContentOS vollständig nutzen zu können, erledige diese Schritte:

1. [ ] **Supabase Projekt erstellen** und die Verbindungsdaten notieren.
2. [ ] **SQL Schema ausführen** (`schema.sql` in Supabase SQL Editor einfügen und runnen).
3. [ ] **Storage Bucket `temp_uploads` anlegen** (private, keine öffentlichen Rechte).
4. [ ] **`.env.local` erstellen** und alle Variablen mit echten Werten füllen (siehe `.env.example`).
5. [ ] **Sichere Secrets setzen:** `CRON_SECRET` und `ADMIN_SECRET` auf starke, zufällige Werte ändern.
6. [ ] **App deployen** (z.B. auf Vercel).
7. [ ] **Cronjobs konfigurieren** (z.B. via Vercel Cron, GitHub Actions, oder externer Dienst), die die drei Endpunkte mit `Authorization: Bearer <CRON_SECRET>` aufrufen.
8. [ ] **Optional: TikTok API freischalten**
   - TikTok Developer Account + App erstellen.
   - Content Posting API Zugriff beantragen.
   - Credentials in `.env.local` und `lib/platforms/tiktok.ts` einbinden.
9. [ ] **Ersten Upload testen:**
   - `/admin` aufrufen, einloggen, Video hochladen.
   - Job Queue prüfen (`/api/jobs/process` manuell triggern oder warten, bis der Cron läuft).
   - Prüfen, ob `content_items.processing_status` auf `ready` wechselt.
10. [ ] **Suche testen:** Öffentliche Seite (`/`) öffnen und nach Keywords aus dem hochgeladenen Video suchen.
11. [ ] **Optional: Geplante Veröffentlichung testen**
   - Upload mit `scheduledAt` in der Vergangenheit (zum Testen).
   - Cron `/api/cron/publish-scheduled` laufen lassen.
   - Prüfen, ob TikTok-Adapter-Fehler im Log landet (erwartet, bis TikTok implementiert ist).
12. [ ] **Optional: Weitere Plattformen** (YouTube, Instagram, LinkedIn) nach dem gleichen Adapter-Muster hinzufügen.

---

*ContentOS – built for scale, ready for more platforms.*
