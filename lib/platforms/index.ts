import type { PlatformAdapter } from "./types";
import { tiktokAdapter } from "./tiktok";
import { youtubeAdapter } from "./youtube";
import { linkedinAdapter } from "./linkedin";
import { instagramAdapter } from "./instagram";

const adapters: Record<string, PlatformAdapter> = {
  tiktok: tiktokAdapter,
  youtube: youtubeAdapter,
  linkedin: linkedinAdapter,
  instagram: instagramAdapter,
};

export function getPlatformAdapter(platformId: string) {
  const adapter = adapters[platformId];
  if (!adapter) {
    throw new Error(`No platform adapter registered for ${platformId}`);
  }
  return adapter;
}
