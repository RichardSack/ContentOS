/**
 * Server-side Supabase client for auth validation in Route Handlers.
 * Accepts a Bearer token or falls back to parsing Supabase cookies.
 */

import { createClient } from "@supabase/supabase-js";

export function createServerClient(token?: string, cookieHeader?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookieHeader) headers.Cookie = cookieHeader;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { headers },
  });
}
