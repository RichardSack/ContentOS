"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import LoginGate from "./components/LoginGate";
import OAuthPanel from "./components/OAuthPanel";
import DashboardStats from "./components/DashboardStats";
import UploadForm from "./components/UploadForm";

interface DashboardStatsType {
  processing: any[];
  failed: any[];
  jobs: any[];
  accounts: any[];
  scheduled: any[];
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<
    { id: string; platform_id: string; account_name: string | null; is_active: boolean; connected_at: string }[]
  >([]);
  const [stats, setStats] = useState<DashboardStatsType | null>(null);

  // Initial load: login check + platform list
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

  // After login: load accounts, stats, check OAuth callback params
  useEffect(() => {
    if (!isLoggedIn) return;

    async function loadAccounts() {
      try {
        const adminSecret = localStorage.getItem("cos_admin_secret") || "";
        const res = await fetch("/api/admin/accounts", {
          headers: { Authorization: `Bearer ${adminSecret}` },
        });
        if (!res.ok) throw new Error("Failed to load accounts");
        const json = await res.json();
        setConnectedAccounts(json.accounts || []);
      } catch {
        setConnectedAccounts([]);
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
        /* ignore silently */
      }
    }

    loadAccounts();
    loadStats();

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

  function handleLogin(secretInput: string) {
    localStorage.setItem("cos_admin_secret", secretInput);
    setIsLoggedIn(true);
    setSecret(secretInput);
  }

  function connectPlatform(platformId: string) {
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

  async function handleUpload(form: HTMLFormElement, formData: FormData) {
    setMessage("");
    const adminSecret = localStorage.getItem("cos_admin_secret") || "";

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminSecret}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    setMessage("Upload erfolgreich! Verarbeitung läuft im Hintergrund.");
    setSelectedPlatforms(platforms.map((p) => p.id));
  }

  if (!isLoggedIn) {
    return <LoginGate onLogin={handleLogin} />;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Content Upload</h1>

      {message && (
        <div className="bg-surface-600 border border-surface-500 rounded-lg p-4 mb-6 text-sm">
          {message}
        </div>
      )}

      <OAuthPanel
        platforms={platforms}
        accounts={connectedAccounts}
        onConnect={connectPlatform}
        onDisconnect={disconnectAccount}
      />

      {stats && <DashboardStats stats={stats} />}

      <UploadForm
        platforms={platforms}
        selectedPlatforms={selectedPlatforms}
        isConnected={isPlatformConnected}
        onToggle={togglePlatform}
        onSubmit={handleUpload}
      />
    </main>
  );
}
