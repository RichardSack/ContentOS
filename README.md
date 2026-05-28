# ContentOS

Schlanke, plattformagnostische Social-Content-Suchmaschine.

**Ziel:** Videos temporär hochladen, automatisch transkribieren, semantisch indexieren und über eine öffentliche Suchseite auffindbar machen. Unterstützt geplante Veröffentlichungen auf Social-Media-Plattformen über Cronjobs.

---

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS v4** (dark/black theme)
- **Supabase** (Postgres + pgvector + Storage)
- **OpenAI** (Embeddings + Summary/Keywords)
- **AssemblyAI** (Transkription)
- **Plattform-Adapter:** TikTok, YouTube, LinkedIn, Instagram (letztere experimentell)

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
| `APP_BASE_URL` | Basis-URL der App, z.B. `https://contentos.vercel.app` |
| `CRON_SECRET` | Geheimer Token für Cron-Endpunkte |
| `ADMIN_SECRET` | Geheimer Token für Upload- und Admin-Seite |
| **TikTok** | |
| `TIKTOK_CLIENT_KEY` | TikTok App Client Key |
| `TIKTOK_CLIENT_SECRET` | TikTok App Client Secret |
| `TIKTOK_REFRESH_TOKEN` | TikTok Refresh Token (für OAuth2) |
| **YouTube** | |
| `YOUTUBE_CLIENT_ID` | Google OAuth2 Client ID |
| `YOUTUBE_CLIENT_SECRET` | Google OAuth2 Client Secret |
| `YOUTUBE_REFRESH_TOKEN` | YouTube Refresh Token |
| **LinkedIn** | |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth2 Client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth2 Client Secret |
| `LINKEDIN_REFRESH_TOKEN` | LinkedIn Refresh Token |
| **Instagram / Facebook** | |
| `FACEBOOK_CLIENT_ID` | Facebook App ID (für Token-Exchange) |
| `FACEBOOK_CLIENT_SECRET` | Facebook App Secret (für Token-Exchange) |

---

## Architektur-Entscheidungen

- **Keine dauerhafte Videopeicherung:** Videos landen nur temporär in `temp_uploads` und werden nach erfolgreichem Publish gelöscht.
- **Plattformagnostisch:** Alle plattformspezifischen Logik lebt ausschließlich in `lib/platforms/<platform>.ts`.
- **Multi-User OAuth:** Neue Tabelle `platform_accounts` speichert pro Plattform `access_token`, `refresh_token`, `metadata`. Adapter rotten Tokens automatisch und schreiben neue Werte zurück.
- **Multi-Platform Upload:** Der Admin kann mehrere Plattformen gleichzeitig auswählen. Es wird ein `platform_posts` Eintrag pro Plattform erzeugt.
- **Job Queue:** Die Pipeline `transcribe → summary → combined document → embedding` läuft über `processing_jobs` mit Retry-Logik.
- **Multi-Platform-Safe Cleanup:** Die temporäre Datei wird erst gelöscht, wenn **alle** `platform_posts` für ein Content Item in einem finalen Zustand (`published`, `failed`, `cancelled`) sind.
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
4. OAuth-Credentials in `platform_accounts` Tabelle speichern (siehe unten).
5. Keine Änderungen an Suche, Content Items oder Embeddings nötig.

---

## AssemblyAI

- `ASSEMBLYAI_API_KEY` setzen.
- Transkription läuft über **signierte Supabase URLs** (1 Stunde gültig).
- Sprache ist auf `de` (Deutsch) eingestellt.

---

## Plattform-Accounts (OAuth)

Für jede Plattform muss ein Eintrag in `platform_accounts` existieren:

```sql
insert into platform_accounts (platform_id, account_name, access_token, refresh_token, metadata)
values ('tiktok', 'Mein TikTok Account', 'act.xxx', 'rft.yyy', '{}');

-- YouTube braucht keine spezielle metadata
insert into platform_accounts (platform_id, account_name, access_token, refresh_token, metadata)
values ('youtube', 'Mein Kanal', 'ya29.xxx', '1//abc', '{}');

-- LinkedIn braucht metadata.linkedin_owner_urn
insert into platform_accounts (platform_id, account_name, access_token, refresh_token, metadata)
values ('linkedin', 'Mein Profil', 'AQxxx', 'AQyyy', '{"linkedin_owner_urn": "urn:li:person:ABC123"}'::jsonb);

-- Instagram braucht metadata.instagram_business_account_id
insert into platform_accounts (platform_id, account_name, access_token, refresh_token, metadata)
values ('instagram', 'Mein Business', 'EAAxxx', 'EAAyyy', '{"instagram_business_account_id": "987654321"}'::jsonb);
```

**Wichtig:** Die Adapter verwalten Token-Rotation automatisch. Rotierte `refresh_token` werden in die DB zurückgeschrieben, solange die Adapter-Implementierung dies unterstützt.

---

## Admin-Seite nutzen

1. Öffne `/admin` im Browser.
2. Gib dein `ADMIN_SECRET` ein – es wird lokal im Browser gespeichert.
3. Aktive Plattformen werden dynamisch aus der DB geladen (Checkboxen).
4. Lade ein Video hoch. Alle weiteren Schritte (Transkription, Summary, Embedding) laufen automatisch über die Job Queue.
5. Du kannst mehrere Plattformen gleichzeitig auswählen. Jede bekommt einen eigenen `platform_posts` Eintrag.

---

## Deine persönliche TODO-Liste

Um ContentOS vollständig nutzen zu können, erledige diese Schritte:

1. [ ] **Supabase Projekt erstellen** und die Verbindungsdaten notieren.
2. [ ] **SQL Schema ausführen** (`schema.sql` in Supabase SQL Editor einfügen und runnen).
3. [ ] **Storage Bucket `temp_uploads` anlegen** (private, keine öffentlichen Rechte).
4. [ ] **`.env.local` erstellen** und alle Variablen mit echten Werten füllen (siehe `.env.example`).
5. [ ] **Sichere Secrets setzen:** `CRON_SECRET` und `ADMIN_SECRET` auf starke, zufällige Werte ändern.
6. [ ] **Plattform-Accounts anlegen:**
   - Für jede Plattform, die du nutzen willst, einen Eintrag in `platform_accounts` erstellen.
   - Für LinkedIn: `metadata.linkedin_owner_urn` setzen.
   - Für Instagram: `metadata.instagram_business_account_id` setzen (erfordert Business/Creator Account).
7. [ ] **App deployen** (z.B. auf Vercel).
8. [ ] **Cronjobs konfigurieren** (z.B. via Vercel Cron, GitHub Actions, oder externer Dienst), die die drei Endpunkte mit `Authorization: Bearer <CRON_SECRET>` aufrufen.
9. [ ] **Ersten Upload testen:**
   - `/admin` aufrufen, einloggen, Video hochladen.
   - Option: mehrere Plattformen gleichzeitig auswählen.
   - Job Queue prüfen (`/api/jobs/process` manuell triggern oder warten, bis der Cron läuft).
   - Prüfen, ob `content_items.processing_status` auf `ready` wechselt.
10. [ ] **Suche testen:** Öffentliche Seite (`/`) öffnen und nach Keywords aus dem hochgeladenen Video suchen.
11. [ ] **Optional: Geplante Veröffentlichung testen**
    - Upload mit `scheduledAt` in der Vergangenheit (zum Testen).
    - Cron `/api/cron/publish-scheduled` laufen lassen.
    - Prüfen, ob die Veröffentlichung auf den gewählten Plattformen funktioniert.
12. [ ] **Optional: Neue Plattformen** nach dem Adapter-Muster hinzufügen.

---

*ContentOS – built for scale, ready for more platforms.*
