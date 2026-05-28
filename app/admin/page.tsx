"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
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

interface UserSession {
  id: string;
  email: string;
  role: string | null;
  accessToken: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<
    { id: string; platform_id: string; account_name: string | null; is_active: boolean; connected_at: string }[]
  >([]);
  const [stats, setStats] = useState<DashboardStatsType | null>(null);

  // Auth check: redirect to /login if not authenticated
  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("sb_access_token");
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Session invalid");

        const data = await res.json();
        setUser({
          id: data.id,
          email: data.email,
          role: data.role || "creator",
          accessToken: token,
        });
        setLoading(false);
      } catch {
        localStorage.removeItem("sb_access_token");
        localStorage.removeItem("sb_refresh_token");
        router.replace("/login");
      }
    }

    checkAuth();
  }, [router]);

  // Load platforms (public data, works without full auth)
  useEffect(() => {
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

  // Load creator-specific data after auth confirmed
  useEffect(() => {
    if (!user) return;

    async function loadAccounts() {
      try {
        const res = await fetch("/api/admin/accounts", {
          headers: { Authorization: `Bearer ${user!.accessToken}` },
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
        const res = await fetch("/api/admin/stats", {
          headers: { Authorization: `Bearer ${user!.accessToken}` },
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

    // Check URL for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) setMessage(`✅ ${capitalize(connected)} verbunden!`);
    if (error) setMessage(`❌ Fehler: ${decodeURIComponent(error)}`);
    if (connected || error) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  function capitalize(s: string) {
    return s[0]?.toUpperCase() + s.slice(1);
  }

  async function logout() {
    localStorage.removeItem("sb_access_token");
    localStorage.removeItem("sb_refresh_token");
    router.replace("/login");
  }

  function connectPlatform(platformId: string) {
    window.location.href = `/api/auth/${platformId}`;
  }

  async function disconnectAccount(accountId: string) {
    if (!user) return;
    try {
      const res = await fetch("/api/admin/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.accessToken}`,
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
    if (!user) return;
    setMessage("");

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.accessToken}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");

    setMessage("Upload erfolgreich! Verarbeitung läuft im Hintergrund.");
    setSelectedPlatforms(platforms.map((p) => p.id));
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Lade...</div>
      </main>
    );
  }

  if (!user) return null; // router.replace already fired

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Content Upload</h1>
          <p className="text-sm text-gray-400">
            {user.email} • {user.role === "admin" ? "Admin" : "Creator"}
          </p>
        </div>
        <button
          onClick={logout}
          className="text-sm bg-surface-700 hover:bg-surface-600 border border-surface-500 px-4 py-2 rounded-lg transition"
        >
          Ausloggen
        </button>
      </div>

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
