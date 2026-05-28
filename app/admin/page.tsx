"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface DashboardStats {
  processing: any[];
  failed: any[];
  jobs: any[];
  accounts: any[];
  scheduled: any[];
}

export default function AdminPage() {  const [secret, setSecret] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<
    {
      id: string;
      platform_id: string;
      account_name: string | null;
      is_active: boolean;
      connected_at: string;
    }[]
  >([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cos_admin_secret");
    if (saved) setIsLoggedIn(true);

    async function loadPlatforms() {
      try {
        const { data } = await getSupabaseClient()
          .from("platforms")
          .select("id, name")
          .eq("is_active", true);

        if (data) {
          const typed = data as { id: string; name: string }[];
          setPlatforms(typed);
          setSelectedPlatforms(typed.map((p) => p.id));
        }
      } catch {
        const fallback = [
          { id: "tiktok", name: "TikTok" },
          { id: "youtube", name: "YouTube" },
          { id: "linkedin", name: "LinkedIn" },
          { id: "instagram", name: "Instagram" },
        ];
        setPlatforms(fallback);
        setSelectedPlatforms(fallback.map((p) => p.id));
      }
    }

    loadPlatforms();
  }, []);

  // Load connected accounts after login
  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadAccounts() {
      try {
        const { data } = await getSupabaseClient()
          .from("platform_accounts")
          .select("id, platform_id, account_name, is_active, connected_at")
          .eq("is_active", true)
          .order("connected_at", { ascending: false });

        if (data) {
          setConnectedAccounts(
            data as {
              id: string;
              platform_id: string;
              account_name: string | null;
              is_active: boolean;
              connected_at: string;
            }[]
          );
        }
      } catch {
        // ignore — will just show no connected accounts
      }
    }

    async function loadStats() {
      try {
        const adminSecret = localStorage.getItem("cos_admin_secret") || "";
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${adminSecret}` },
        });
        if (res.ok) {
          const json = await res.json();
          setStats(json);
        }
      } catch {
        // ignore silently
      }
    }

    loadAccounts();
    loadStats();

    // Check URL for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setMessage(`✅ ${capitalize(connected)} verbunden!`);
    if (error) setMessage(`❌ Fehler: ${decodeURIComponent(error)}`);
    if (connected || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isLoggedIn]);

  function capitalize(s: string) {
    return s[0]?.toUpperCase() + s.slice(1);
  }

  function login() {
    localStorage.setItem("cos_admin_secret", secret);
    setIsLoggedIn(true);
    setSecret("");
  }

  async function connectPlatform(platformId: string) {
    window.location.href = `/api/auth/${platformId}`;
  }

  async function disconnectAccount(accountId: string) {
    const adminSecret = localStorage.getItem("cos_admin_secret") || "";
    try {
      const res = await fetch("/api/admin/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminSecret}`,
        },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) throw new Error("Disconnect failed");
      setConnectedAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setMessage("Account getrennt.");
    } catch (err: any) {
      setMessage(`Fehler: ${err.message}`);
    }
  }

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function isPlatformConnected(platformId: string) {
    return connectedAccounts.some(
      (a) => a.platform_id === platformId && a.is_active
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (selectedPlatforms.length === 0) {
      setMessage("Bitte mindestens eine Plattform auswählen.");
      return;
    }

    // Warn if uploading to unconnected platforms
    const unconnected = selectedPlatforms.filter(
      (pid) => !isPlatformConnected(pid)
    );
    if (unconnected.length > 0) {
      const names = unconnected
        .map((pid) => {
          const plat = platforms.find((p) => p.id === pid);
          return plat ? plat.name : pid;
        })
        .join(", ");
      if (
        !confirm(
          `Diese Plattformen sind nicht verbunden und werden u. U. fehlschlagen: ${names}. Trotzdem fortfahren?`
        )
      ) {
        return;
      }
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

      {/* OAuth Connections */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Verknüpfte Plattformen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {platforms.map((p) => {
            const connected = isPlatformConnected(p.id);
            const account = connectedAccounts.find(
              (a) => a.platform_id === p.id && a.is_active
            );
            return (
              <div
                key={p.id}
                className="flex items-center justify-between bg-surface-700 border border-surface-500 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      connected ? "bg-emerald-400" : "bg-gray-500"
                    }`}
                  />
                  <span className="text-sm">{p.name}</span>
                  {account?.account_name && (
                    <span className="text-xs text-gray-400">
                      ({account.account_name})
                    </span>
                  )}
                </div>
                {connected ? (
                  <button
                    onClick={() => disconnectAccount(account!.id)}
                    className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 px-3 py-1 rounded transition"
                  >
                    Trennen
                  </button>
                ) : (
                  <button
                    onClick={() => connectPlatform(p.id)}
                    className="text-xs bg-surface-600 hover:bg-surface-500 text-white px-3 py-1 rounded transition"
                  >
                    Verbinden
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Dashboard Stats */}
      {stats && (
        <section className="mb-8 space-y-4">
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.processing.length}</div>
              <div className="text-xs text-gray-400">In Bearbeitung</div>
            </div>
            <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.failed.length}</div>
              <div className="text-xs text-gray-400">Fehlgeschlagen</div>
            </div>
            <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.accounts.length}</div>
              <div className="text-xs text-gray-400">Verbunden</div>
            </div>
            <div className="bg-surface-700 border border-surface-500 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.scheduled.length}</div>
              <div className="text-xs text-gray-400">Geplant</div>
            </div>
          </div>

          {stats.jobs.length > 0 && (
            <div className="bg-surface-700 border border-surface-500 rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">Offene / Fehlgeschlagene Jobs</h3>
              <ul className="space-y-1 text-sm">
                {stats.jobs.slice(0, 5).map((job: any) => (
                  <li key={job.id} className="flex justify-between">
                    <span>{job.job_type}</span>
                    <span className={`text-xs ${job.status === "failed" ? "text-red-400" : "text-yellow-400"}`}>
                      {job.status} {job.attempts > 0 && `(${job.attempts})`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
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
          <label className="block text-sm text-gray-400 mb-1">
            Geplante Veröffentlichung (optional)
          </label>
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
