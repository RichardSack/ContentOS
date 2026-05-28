# Coding Agent Implementation Plan

> ⚠️ **Dieser Plan ist abgeschlossen.** Der aktuelle Systemzustand ist in [`CONTEXT.md`](./CONTEXT.md) dokumentiert.
> Für neue Features oder Refactorings: Kontext in CONTEXT.md lesen, dann hier das Delta ergänzen.

---

## Ziel (erreicht)

Next.js App für eine plattformagnostische Social-Content-Suchmaschine mit OAuth2-Integration, semantischer Suche und geplanter Veröffentlichung.

---

## Was bereits implementiert ist

| Phase | Status | Details |
|-------|--------|---------|
| **Projekt-Setup** | ✅ | Next.js 15 + TypeScript + Tailwind v4 |
| **Supabase** | ✅ | Postgres + pgvector(1536) + Storage `temp_uploads` + RLS |
| **AI-Pipeline** | ✅ | AssemblyAI (DE) → OpenAI summary + `text-embedding-3-small` |
| **Job Queue** | ✅ | 6 Handler: transcribe, summary, combine, embedding, publish, cleanup |
| **Upload** | ✅ | Multipart, 500MB Limit, MIME/Extension validiert, Multi-Platform |
| **Search** | ✅ | `match_content_items()` RPC mit SECURITY DEFINER |
| **OAuth2** | ✅ | Admin verbindet Plattformen über `/admin`. Callback tauscht Code → Tokens |
| **Adapters** | ✅ | TikTok, YouTube (chunked), LinkedIn (auto-URN), Instagram (experimental) |
| **Admin Dashboard** | ✅ | Stats API (processing/failed/jobs/accounts/scheduled) + UI |
| **Security** | ✅ | RLS, `ADMIN_SECRET`, `CRON_SECRET`, `assertAdmin`, `assertCron` |
| **Tests** | ✅ | 31 Vitest-Tests |

---

## Architekturprinzipien (gilt für alle neuen Features)

1. **Plattformlogik isoliert:** Nur in `lib/platforms/{platform}.ts`
2. **DB plattformagnostisch:** `content_items`, `documents`, `embeddings` kennen keine Plattformen
3. **Service Role für Admin:** `supabaseAdmin` bypass RLS. Public reads via Anon Key + RLS
4. **Lazy Init:** Browser-Supabase-Client erst bei Bedarf (`getSupabaseClient()`)
5. **Idempotent:** Cleanup-Handler toleriert bereits-gelöschte Files
6. **Chunked Upload:** Serverless-RAM schonen (YouTube 8MB)
7. **Timed Out:** Alle externen Calls mit `fetchWithTimeout` (30s AbortController)

---

## Noch offen für zukünftige Iterationen

- **Multi-User Auth:** `platform_users` Tabelle, `user_id` in `oauth_states` füllen, Auth UI
- **Webhook Polling:** TikTok/Instagram async processing (aktuell nur LinkedIn blockt, TikTok ist sync)
- **Such-Analytics:** `search_logs` auswerten, Top-Queries
- **Thumbnail-Generierung:** FFmpeg frames aus Video extrahieren statt Plattform-Thumbnails
- **Content-Typen erweitern:** Podcasts (Audio) über AssemblyAI
- **Metrics:** Post-Performance von Plattformen zurück in `platform_posts.metrics`

---

## Einen Adapter hinzufügen (Checkliste)

1. `lib/platforms/{platform}.ts` erstellen → `PlatformAdapter` implementieren
2. In `lib/platforms/index.ts` registrieren
3. OAuth Config in `lib/oauth/config.ts` ergänzen (`authorizationUrl`, `tokenUrl`, `scopes`, `pkce`)
4. OAuth App registrieren (Redirect URI: `/api/auth/{platform}/callback`)
5. Env vars (`{PLATFORM}_CLIENT_ID`, `{PLATFORM}_CLIENT_SECRET`) in `.env.example` + Vercel
6. `assertAdmin`-API route testen (`/api/upload` mit Multi-Platform-Selektion)
7. Handler: `publish_to_platform` Logik testen (Token-Refresh, Upload-Methode, Fehler-Handling)
8. Test schreiben: `lib/platforms/{platform}.test.ts` (mindestens: mock token refresh + mock publish)

> 📋 Architektur-Diagramm, Job Pipeline, DB Schema, Env-Variablen → [`CONTEXT.md`](./CONTEXT.md)
