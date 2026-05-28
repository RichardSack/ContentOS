"use client";

import { useState, useEffect } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("cos_admin_secret");
    if (saved) setIsLoggedIn(true);
  }, []);

  function login() {
    localStorage.setItem("cos_admin_secret", secret);
    setIsLoggedIn(true);
    setSecret("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    const form = e.currentTarget;
    const formData = new FormData(form);

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
          <label className="block text-sm text-gray-400 mb-1">Plattform</label>
          <select
            name="platformId"
            defaultValue="tiktok"
            className="w-full bg-surface-700 border border-surface-500 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
          >
            <option value="tiktok">TikTok</option>
          </select>
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
