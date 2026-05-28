"use client";

import { useState } from "react";

export default function LoginGate({ onLogin }: { onLogin: (secret: string) => void }) {
  const [secret, setSecret] = useState("");

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
          onClick={() => onLogin(secret)}
          className="w-full bg-surface-500 hover:bg-surface-400 text-white py-3 rounded-lg transition"
        >
          Einloggen
        </button>
      </div>
    </main>
  );
}
