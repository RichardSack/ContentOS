import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Generates a random 32-byte URL-safe state parameter for CSRF protection.
 */
export function generateState(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Generates PKCE code_verifier and code_challenge (S256).
 * Used by OAuth2 flows that require PKCE (Google, LinkedIn).
 */
export function generatePKCE(): {
  code_verifier: string;
  code_challenge: string;
  code_challenge_method: "S256";
} {
  const code_verifier = randomBytes(32).toString("base64url");
  const code_challenge = createHash("sha256")
    .update(code_verifier)
    .digest()
    .toString("base64url");
  return {
    code_verifier,
    code_challenge,
    code_challenge_method: "S256",
  };
}

/**
 * Returns a 10-minute-from-now ISO timestamp for oauth_states expiry.
 */
export function defaultExpiresAt(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

/**
 * Verifies a state parameter was not tampered with.
 * In the actual implementation this queries the DB; here we just define the interface.
 */
export function validateState(received: string, expected: string | null): boolean {
  if (!expected || !received) return false;
  // Timing-safe comparison for production
  const buf1 = Buffer.from(expected, "utf8");
  const buf2 = Buffer.from(received, "utf8");
  return buf1.length === buf2.length && timingSafeEqual(buf1, buf2);
}
