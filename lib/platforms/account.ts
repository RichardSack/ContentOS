import { supabaseAdmin } from "@/lib/supabase/admin";

export type PlatformAccount = {
  id: string;
  platform_id: string;
  account_name: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Fetches the first active platform account for a given platform.
 * In a multi-user system you may want to select by user_id or priority.
 */
export async function getActivePlatformAccount(
  platformId: string
): Promise<PlatformAccount> {
  const { data, error } = await supabaseAdmin
    .from("platform_accounts")
    .select("*")
    .eq("platform_id", platformId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(
      `No active platform account found for "${platformId}". ` +
        `Insert a row into platform_accounts with access_token and metadata.`
    );
  }

  return data as unknown as PlatformAccount;
}

/**
 * Persist updated tokens back to the database after a refresh.
 * Call this whenever a platform returns a new access_token or refresh_token.
 */
export async function persistTokens(
  accountId: string,
  tokens: {
    access_token: string;
    refresh_token?: string | null;
    expires_at?: string | null;
  }
) {
  const { error } = await supabaseAdmin
    .from("platform_accounts")
    .update({
      access_token: tokens.access_token,
      ...(tokens.refresh_token !== undefined
        ? { refresh_token: tokens.refresh_token }
        : {}),
      ...(tokens.expires_at !== undefined
        ? { token_expires_at: tokens.expires_at }
        : {}),
    })
    .eq("id", accountId);

  if (error) {
    console.error(
      `Failed to persist updated tokens for account ${accountId}:`,
      error.message
    );
  }
}
