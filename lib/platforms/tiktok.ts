import type { PlatformAdapter } from "./types";

export const tiktokAdapter: PlatformAdapter = {
  platformId: "tiktok",

  async publish(input) {
    throw new Error(
      "TikTok adapter not implemented yet. Add TikTok Content Posting API credentials and implementation in lib/platforms/tiktok.ts."
    );
  },
};
