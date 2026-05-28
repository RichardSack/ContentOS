"use client";

import { useState } from "react";

interface Props {
  platforms: { id: string; name: string }[];
  selectedPlatforms: string[];
  isConnected: (id: string) => boolean;
  onToggle: (id: string) => void;
  onSubmit: (form: HTMLFormElement, data: FormData) => Promise<void>;
}

export default function UploadForm({
  platforms,
  selectedPlatforms,
  isConnected,
  onToggle,
  onSubmit,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (selectedPlatforms.length === 0) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    const unconnected = selectedPlatforms.filter((pid) => !isConnected(pid));
    if (unconnected.length > 0) {
      const names = unconnected
        .map((pid) => {
          const plat = platforms.find((p) => p.id === pid);
          return plat ? plat.name : pid;
        })
        .join(", ");
      if (
        !confirm(
          `Diese Plattformen sind nicht verbunden: ${names}. Trotzdem fortfahren?`
        )
      ) {
        return;
      }
    }

    const checked = form.querySelectorAll<HTMLInputElement>(
      'input[name="platformId"]:checked'
    );
    if (checked.length === 0) return;

    setLoading(true);
    try {
      await onSubmit(form, formData);
      form.reset();
    } finally {
      setLoading(false);
    }
  }

  return (
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
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="platformId"
                value={p.id}
                checked={selectedPlatforms.includes(p.id)}
                onChange={() => onToggle(p.id)}
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
        disabled={loading}
        className="w-full bg-surface-500 hover:bg-surface-400 text-white py-3 rounded-lg transition disabled:opacity-50"
      >
        {loading ? "Wird hochgeladen..." : "Hochladen & Verarbeiten starten"}
      </button>
    </form>
  );
}
