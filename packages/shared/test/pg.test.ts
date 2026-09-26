import { describe, expect, it } from "vitest";
import { createPgPool } from "../src/pg.js";

describe("createPgPool", () => {
  it("disables SSL for a plain localhost connection string", () => {
    const pool = createPgPool("postgres://localhost/kawaipay");
    expect(pool.options.ssl).toBeUndefined();
  });

  it("disables SSL for 127.0.0.1 and a user@host form", () => {
    expect(createPgPool("postgres://apple@127.0.0.1/kawaipay").options.ssl).toBeUndefined();
    expect(createPgPool("postgres://user:pass@localhost:5432/kawaipay").options.ssl).toBeUndefined();
  });

  it("enables SSL (accepting the provider's own cert) for anything else, e.g. Supabase", () => {
    const pool = createPgPool("postgres://postgres:pw@db.abcxyz.supabase.co:5432/postgres");
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("lets the caller override the computed defaults", () => {
    const pool = createPgPool("postgres://localhost/kawaipay", { max: 5 });
    expect(pool.options.max).toBe(5);
  });
});
