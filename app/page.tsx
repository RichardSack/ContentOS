"use client";

import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
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
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-center tracking-tight">
          ContentOS
        </h1>
        <p className="text-gray-400 text-center mb-8">
          Semantische Suche über deine Content-Bibliothek
        </p>

        <form onSubmit={handleSearch} className="relative mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nach Themen, Keywords oder Inhalten suchen..."
            className="w-full bg-surface-700 border border-surface-500 rounded-2xl px-6 py-4 text-lg outline-none focus:ring-2 focus:ring-surface-400 transition placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 bg-surface-500 hover:bg-surface-400 text-white px-6 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "..." : "Suchen"}
          </button>
        </form>

        <div className="space-y-6">
          {results.length === 0 && !loading && query && (
            <p className="text-center text-gray-500">Keine Ergebnisse gefunden.</p>
          )}

          {results.map((item: any) => (
            <div
              key={item.id}
              className="bg-surface-700 border border-surface-600 rounded-xl p-5 hover:border-surface-400 transition"
            >
              <h2 className="text-xl font-semibold mb-1">
                {item.title || "Ohne Titel"}
              </h2>
              <p className="text-gray-400 text-sm mb-3">
                {item.description || ""}
              </p>

              {item.content_documents?.map((doc: any) => {
                if (doc.document_type === "summary") {
                  return (
                    <p key={doc.id} className="text-sm text-gray-300 mb-2">
                      {doc.content}
                    </p>
                  );
                }
                if (doc.document_type === "keywords") {
                  return (
                    <div key={doc.id} className="flex flex-wrap gap-2 mb-3">
                      {(doc.metadata?.keywords || []).map((k: string) => (
                        <span
                          key={k}
                          className="bg-surface-600 text-xs px-2 py-1 rounded-full text-gray-300"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  );
                }
                return null;
              })}

              <div className="flex flex-wrap gap-3 mt-2">
                {item.platform_posts?.map((post: any) => (
                  <a
                    key={post.id}
                    href={post.platform_url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 underline"
                  >
                    Auf {post.platform_id} ansehen
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
