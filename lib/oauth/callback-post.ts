/**
 * Post-OAuth callback helpers.
 * Run AFTER token exchange to fetch platform-specific metadata.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";

/**
 * Fetches the LinkedIn member URN (e.g. urn:li:person:xxx).
 * Requires a valid access token.
 */
export async function fetchLinkedInOwnerUrn(
  accessToken: string
): Promise<string | null> {
  const res = await fetchWithTimeout(
    "https://api.linkedin.com/v2/me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
    },
    10000

  );
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const urn = data.id as string | undefined;
  if (!urn) return null;
  return `urn:li:person:${urn}`;
}
