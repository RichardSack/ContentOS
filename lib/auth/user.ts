/**
 * Authentication helpers for the SaaS multi-user model.
 *
 * - getUser          → validates Bearer token or Supabase session cookie
 * - getUserWithRole  → user + role lookup from public.users
 * - requireAuth      → assert: any authenticated user
 * - requireAdmin     → assert: admin role
 * - requireCreator   → assert: creator OR admin role
 *
 * The caller (browser) must send:
 *   Authorization: Bearer <supabase-access-token>
 */

import { createServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface UserWithRole {
  id: string;
  email: string;
  role: "admin" | "creator" | null;
  displayName?: string | null;
}

export async function getUser(req: Request): Promise<{ id: string; email: string } | null> {
  // 1. Try Bearer token first (preferred for API calls from client)
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  // 2. Fallback to cookies (for cookie-based SSR/Route-Handler requests)
  const cookieHeader = req.headers.get("cookie") ?? undefined;

  const client = createServerClient(token || undefined, cookieHeader);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email || "" };
}

export async function getUserWithRole(req: Request): Promise<UserWithRole | null> {
  const user = await getUser(req);
  if (!user) return null;

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    role: (profile?.role as "admin" | "creator") ?? null,
    displayName: profile?.display_name,
  };
}

function throwAuth(code: number, message: string): never {
  const err = new Error(message) as any;
  err.status = code;
  throw err;
}

export async function requireAuth(req: Request): Promise<UserWithRole> {
  const user = await getUserWithRole(req);
  if (!user) throwAuth(401, "Unauthorized");
  return user;
}

export async function requireAdmin(req: Request): Promise<UserWithRole> {
  const user = await requireAuth(req);
  if (user.role !== "admin") throwAuth(403, "Forbidden — admin required");
  return user;
}

export async function requireCreator(req: Request): Promise<UserWithRole> {
  const user = await requireAuth(req);
  if (user.role !== "admin" && user.role !== "creator") {
    throwAuth(403, "Forbidden — creator required");
  }
  return user;
}
