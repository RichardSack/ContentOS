import { describe, it, expect } from "vitest";
import { getOAuthConfig, tiktokConfig, youtubeConfig, linkedinConfig, facebookConfig } from "./config";

describe("getOAuthConfig", () => {
  it("returns config for tiktok", () => {
    const cfg = getOAuthConfig("tiktok");
    expect(cfg).toBeDefined();
    expect(cfg.authorizationUrl).toContain("tiktok.com");
  });

  it("returns config for youtube", () => {
    const cfg = getOAuthConfig("youtube");
    expect(cfg).toBeDefined();
    expect(cfg.authorizationUrl).toContain("google.com");
    expect(cfg.pkce).toBe(true);
  });

  it("returns config for linkedin", () => {
    const cfg = getOAuthConfig("linkedin");
    expect(cfg).toBeDefined();
    expect(cfg.authorizationUrl).toContain("linkedin.com");
    expect(cfg.pkce).toBe(true);
  });

  it("returns config for facebook", () => {
    const cfg = getOAuthConfig("facebook");
    expect(cfg).toBeDefined();
    expect(cfg.authorizationUrl).toContain("facebook.com");
  });

  it("throws for unknown platform", () => {
    expect(() => getOAuthConfig("unknown")).toThrow("No OAuth config");
  });
});

describe("buildAuthorizeUrl", () => {
  it("includes state and redirect_uri for tiktok", () => {
    const url = tiktokConfig.buildAuthorizeUrl({
      clientId: "test_key",
      redirectUri: "http://localhost:3000/api/auth",
      state: "abc123",
      scope: "video.publish",
    });
    expect(url).toContain("client_key=test_key");
    expect(url).toContain("state=abc123");
    expect(url).toContain("response_type=code");
    expect(url).toContain("redirect_uri=" + encodeURIComponent("http://localhost:3000/api/auth/tiktok/callback"));
  });

  it("includes PKCE for youtube", () => {
    const url = youtubeConfig.buildAuthorizeUrl({
      clientId: "test_id",
      redirectUri: "http://localhost:3000/api/auth",
      state: "xyz",
      scope: "youtube.upload",
      codeChallenge: "challenge123",
    });
    expect(url).toContain("code_challenge=challenge123");
    expect(url).toContain("code_challenge_method=S256");
  });
});

describe("exchangeBody", () => {
  it("includes code_verifier when PKCE is present", () => {
    const body = youtubeConfig.exchangeBody({
      clientId: "id",
      clientSecret: "secret",
      code: "authcode",
      redirectUri: "http://localhost:3000/api/auth",
      verifier: "pkce123",
    });
    expect(body.code_verifier).toBe("pkce123");
    expect(body.grant_type).toBe("authorization_code");
  });

  it("omits code_verifier for non-pkce platforms", () => {
    const body = tiktokConfig.exchangeBody({
      clientId: "key",
      clientSecret: "secret",
      code: "authcode",
      redirectUri: "http://localhost:3000/api/auth",
    });
    expect(body.code_verifier).toBeUndefined();
  });
});
