"use client";

interface Account {
  id: string;
  platform_id: string;
  account_name: string | null;
  is_active: boolean;
  connected_at: string;
}

interface Props {
  platforms: { id: string; name: string }[];
  accounts: Account[];
  onConnect: (platformId: string) => void;
  onDisconnect: (accountId: string) => void;
}

export default function OAuthPanel({ platforms, accounts, onConnect, onDisconnect }: Props) {
  function isConnected(platformId: string) {
    return accounts.some((a) => a.platform_id === platformId && a.is_active);
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-3">Verknüpfte Plattformen</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {platforms.map((p) => {
          const connected = isConnected(p.id);
          const account = accounts.find(
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
                  onClick={() => onDisconnect(account!.id)}
                  className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 px-3 py-1 rounded transition"
                >
                  Trennen
                </button>
              ) : (
                <button
                  onClick={() => onConnect(p.id)}
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
  );
}
