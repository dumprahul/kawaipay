import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitAlert } from "../src/alerts.js";

describe("emitAlert", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("logs a structured, machine-filterable alert object to stderr", () => {
    emitAlert("batcher", "critical", "RATE_EXCEEDED", "sanity check failed", { linkId: "0xabc" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0]![0] as string);
    expect(parsed).toMatchObject({
      alert: true,
      severity: "critical",
      code: "RATE_EXCEEDED",
      service: "batcher",
      message: "sanity check failed",
      meta: { linkId: "0xabc" },
    });
    expect(typeof parsed.ts).toBe("string");
    expect(new Date(parsed.ts).toString()).not.toBe("Invalid Date");
  });

  it("omits meta when not provided", () => {
    emitAlert("sentinel", "warning", "LINK_HELD", "link put on hold");
    const parsed = JSON.parse(errorSpy.mock.calls[0]![0] as string);
    expect(parsed.meta).toBeUndefined();
  });
});
