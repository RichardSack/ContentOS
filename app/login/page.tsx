"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await getSupabaseClient().auth.signUp({
          email,
          password,
          options: {
            data: { full_name: displayName || email.split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push("/admin");
        } else {
          setError("Bitte Email bestätigen, bevor du dich einloggst.");
        }
      } else {
        const { data, error: signInError } = await getSupabaseClient().auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.session) {
          router.push("/admin");
        }
      }
    } catch (err: any) {
      setError(err.message || "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm bg-surface-900/80 border border-surface-700 rounded-2xl p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {mode === "login" ? "Anmelden" : "Registrieren"}
        </h1>

        {error && (
          <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Anzeigename</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full bg-surface-800 border border-surface-600 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-surface-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-surface-500 hover:bg-surface-400 text-white py-3 rounded-lg transition disabled:opacity-50"
          >
            {loading
              ? "..."
              : mode === "login"
              ? "Einloggen"
              : "Registrieren"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          {mode === "login" ? (
            <>
              Noch kein Konto?{" "}
              <button
                onClick={() => setMode("register")}
                className="text-white underline hover:text-gray-200"
              >
                Registrieren
              </button>
            </>
          ) : (
            <>
              Bereits registriert?{" "}
              <button
                onClick={() => setMode("login")}
                className="text-white underline hover:text-gray-200"
              >
                Einloggen
              </button>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
