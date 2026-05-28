"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("cos_admin_secret");
    if (saved) setIsLoggedIn(true);

    getSupabaseClient()
      .from("platforms")
      .select("id, name")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const typed = data as { id: string; name: string }[];
          setPlatforms(typed);
          setSelectedPlatforms(typed.map((p) => p.id));
        }
      });
  }, []);

  function login() {
    localStorage.setItem("cos_admin_secret", secret);
    setIsLoggedIn(true);
    setSecret("");
  }

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (selectedPlatforms.length === 0) {
      setMessage("Bitte mindestens eine Plattform auswählen.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    // ensure only selected platforms are sent (in case checked state drifted)
    const checked = form.querySelectorAll<HTMLInputElement>(
      'input[name="platformId"]:checked'
    );
    if (checked.length === 0) {
      setMessage("Bitte mindestens eine Plattform auswählen.");
      return;
    }

    const adminSecret = localStorage.getItem("cos_admin_secret") || "";

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminSecret}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setMessage("Upload erfolgreich! Verarbeitung läuft im Hintergrund.");
      form.reset();
      setSelectedPlatforms(platforms.map((p) => p.id));
    } catch (err: any) {
      setMessage(`Fehler: ${err.message}`);
    }
  }

  if (!isLoggedIn) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm bg-surface-700 border border-surface-500 rounded-xl p-6">
          <h1 className="text-2xl font-bold mb-4">Admin Login</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_SECRET eingeben"
            className="w-full bg-surface-800 border border-surface-500 rounded-lg px-4 py-3 mb-4 outline-none focus:ring-2 focus:ring-surface-400"
          />
          <button
            onClick={login}
            className="w-full bg-surface-500 hover:bg-surface-400 text-white py-3 rounded-lg transition"
          >
            Einloggen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Content Upload</h1>

      {message && (
        <div className="bg-surface-600 border border-surface-500 rounded-lg p-4 mb-6 text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Video-Datei</label>
          <input
            name="file"
            type="file"
            accept="video/*"
            required
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 file:bg-surface-600 file:border-0 file:rounded file:px-3 file:py-1 file:text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Titel</label>
          <input
            name="title"
            type="text"
            required
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Beschreibung</label>
          <textarea
            name="description"
            rows={3}
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Caption</label>
          <textarea
            name="caption"
            rows={2}
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Geplante Veröffentlichung (optional)</label>
          <input
            name="scheduledAt"
            type="datetime-local"
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Plattformen</label>
          <div className="space-y-2">
            {platforms.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  name="platformId"
                  value={p.id}
                  checked={selectedPlatforms.includes(p.id)}
                  onChange={() => togglePlatform(p.id)}
                  className="accent-white w-4 h-4"
                />
                <span>{p.name}</span>
              </label>
            ))}
          </div>
          {selectedPlatforms.length === 0 && (
            <p className="text-red-400 text-xs mt-1">
              Mindestens eine Plattform erforderlich.
            </p>
          )}
        </div>

        <button
          type="submit"
          className="w-full bg-surface-500 hover:bg-surface-400 text-white py-3 rounded-lg transition"
        >
          Hochladen & Verarbeiten starten
        </button>
      </form>
    </main>
  );
}
