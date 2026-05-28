"use client";

import { useState } from "react";

type PlatformPost = {
  id: string;
  platform_id: string;
  platform_url?: string;
  embed_url?: string;
  thumbnail_url?: string;
};

type ContentDoc = {
  id: string;
  document_type: string;
  content: string;
  metadata?: Record<string, any>;
};

type SearchItem = {
  id: string;
  title?: string;
  description?: string;
  platform_posts?: PlatformPost[];
  content_documents?: ContentDoc[];
};

function PlatformBadge({ platformId }: { platformId: string }) {
  const colors: Record<string, string> = {
    youtube: "bg-red-600",
    tiktok: "bg-black border border-white/20",
    linkedin: "bg-blue-600",
    instagram: "bg-pink-600",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        colors[platformId] || "bg-surface-600"
      }`}
    >
      {platformId}
    </span>
  );
}

function YoutubeEmbed({ src }: { src: string }) {
  return (
    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black mt-3 mb-2">
      <iframe
        src={src}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, matchCount: 10 }),
    });

    const data = await res.json();
    setResults(data.items || []);
    setLoading(false);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-3xl">
        <h1 className="text-4xl font-bold mb-2 text-center tracking-tight">
          ContentOS
        </h1>
        <p className="text-gray-400 text-center mb-2">
          Semantische Suche über deine Content-Bibliothek
        </p>
        <div className="text-center mb-6">
          <a href="/login" className="text-xs text-gray-600 hover:text-gray-400 transition">
            Creator Login →
          </a>
        </div>

        <form onSubmit={handleSearch} className="relative mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nach Themen, Keywords oder Inhalten suchen..."
            className="w-full bg-surface-700 border border-surface-600 rounded-2xl px-6 py-4 text-lg outline-none focus:ring-2 focus:ring-surface-400 transition placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 bg-surface-500 hover:bg-surface-400 text-white px-6 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "..." : "Suchen"}
          </button>
        </form>

        <ul className="space-y-6">
          {results.length === 0 && !loading && query && (
            <p className="text-center text-gray-500">Keine Ergebnisse gefunden.</p>
          )}

          {results.map((item) => {
            const summaryDoc = item.content_documents?.find(
              (d) => d.document_type === "summary"
            );
            const keywordsDoc = item.content_documents?.find(
              (d) => d.document_type === "keywords"
            );
            const keywords: string[] = keywordsDoc?.metadata?.keywords || [];
            const ytEmbed = item.platform_posts?.find(
              (p) => p.embed_url && p.platform_id === "youtube"
            );
            const thumbnail = item.platform_posts?.find(
              (p) => p.thumbnail_url
            )?.thumbnail_url;

            return (
              <li
                key={item.id}
                className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 hover:border-surface-600 transition"
              >
                {/* Thumbnail row */}
                {thumbnail && (
                  <div
                    className="w-full h-36 bg-cover bg-center rounded-lg mb-3"
                    style={{ backgroundImage: `url(${thumbnail})` }}
                  />
                )}

                <h2 className="text-lg font-semibold mb-1">
                  {item.title || "Ohne Titel"}
                </h2>

                {item.description && (
                  <p className="text-gray-400 text-sm mb-2 line-clamp-2">
                    {item.description}
                  </p>
                )}

                {summaryDoc?.content && (
                  <p className="text-sm text-gray-300 mb-2 line-clamp-3">
                    {summaryDoc.content}
                  </p>
                )}

                {/* Keywords */}
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {keywords.map((k) => (
                      <span
                        key={k}
                        className="bg-surface-700 text-xs px-2 py-0 rounded-full text-gray-300"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                )}

                {/* YouTube inline embed */}
                {ytEmbed?.embed_url && <YoutubeEmbed src={ytEmbed.embed_url} />}

                {/* Platform links */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {item.platform_posts?.map((post) => (
                    <a
                      key={post.id}
                      href={post.platform_url || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 transition"
                    >
                      <PlatformBadge platformId={post.platform_id} />
                      <span className="text-gray-300 hover:text-white">
                        {post.platform_id}
                      </span>
                    </a>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
