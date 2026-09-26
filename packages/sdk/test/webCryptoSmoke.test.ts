import { describe, expect, it } from "vitest";

describe("Web Crypto availability under jsdom (sanity check before trusting mac.ts)", () => {
  it("has crypto.subtle.digest", async () => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hello"));
    expect(digest.byteLength).toBe(32);
  });

  it("has crypto.subtle HMAC sign", async () => {
    const key = await crypto.subtle.importKey("raw", new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("hello"));
    expect(sig.byteLength).toBe(32);
  });

  it("has btoa/atob", () => {
    expect(atob(btoa("hello"))).toBe("hello");
  });
});
