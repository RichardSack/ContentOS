import type { PlatformAdapter } from "./types";
import { tiktokAdapter } from "./tiktok";

const adapters: Record<string, PlatformAdapter> = {
  tiktok: tiktokAdapter,
};

export function getPlatformAdapter(platformId: string) {
  const adapter = adapters[platformId];
  if (!adapter) {
    throw new Error(`No platform adapter registered for ${platformId}`);
  }
  return adapter;
}
