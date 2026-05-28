import { describe, it, expect } from "vitest";
import { generateState, generatePKCE, defaultExpiresAt, validateState } from "./core";

describe("generateState", () => {
  it("generates a non-empty URL-safe string", () => {
    const state = generateState();
    expect(state.length).toBeGreaterThan(10);
    expect(state).not.toContain("+");
    expect(state).not.toContain("/");
    expect(state).not.toContain("=");
  });

  it("generates unique states each time", () => {
    const s1 = generateState();
    const s2 = generateState();
    expect(s1).not.toBe(s2);
  });
});

describe("generatePKCE", () => {
  it("returns verifier, challenge, and method", () => {
    const pkce = generatePKCE();
    expect(pkce.code_verifier).toBeTruthy();
    expect(pkce.code_challenge).toBeTruthy();
    expect(pkce.code_challenge_method).toBe("S256");
  });

  it("challenge is derived from verifier via S256", () => {
    const pkce = generatePKCE();
    const expected =
      require("crypto")
        .createHash("sha256")
        .update(pkce.code_verifier)
        .digest()
        .toString("base64url");
    expect(pkce.code_challenge).toBe(expected);
  });
});

describe("defaultExpiresAt", () => {
  it("returns a timestamp ~10 minutes in the future", () => {
    const before = Date.now();
    const exp = new Date(defaultExpiresAt()).getTime();
    const after = Date.now();
    expect(exp).toBeGreaterThanOrEqual(before + 9 * 60 * 1000);
    expect(exp).toBeLessThanOrEqual(after + 11 * 60 * 1000);
  });
});

describe("validateState", () => {
  it("returns true for matching states", () => {
    expect(validateState("abc", "abc")).toBe(true);
  });

  it("returns false for mismatched states", () => {
    expect(validateState("abc", "def")).toBe(false);
  });

  it("returns false when expected is null", () => {
    expect(validateState("abc", null)).toBe(false);
  });

  it("returns false when received is empty", () => {
    expect(validateState("", "abc")).toBe(false);
  });
});
