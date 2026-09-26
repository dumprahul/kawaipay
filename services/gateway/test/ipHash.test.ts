import { describe, expect, it } from "vitest";
import { hashIp } from "../src/ipHash.js";

describe("hashIp", () => {
  it("is deterministic for the same ip and salt", () => {
    expect(hashIp("1.2.3.4", "salt-a")).toBe(hashIp("1.2.3.4", "salt-a"));
  });

  it("differs when the salt changes (daily rotation)", () => {
    expect(hashIp("1.2.3.4", "salt-a")).not.toBe(hashIp("1.2.3.4", "salt-b"));
  });

  it("differs for different IPs under the same salt", () => {
    expect(hashIp("1.2.3.4", "salt-a")).not.toBe(hashIp("5.6.7.8", "salt-a"));
  });

  it("never contains the raw IP as a substring (sanity check against accidental passthrough)", () => {
    expect(hashIp("1.2.3.4", "salt-a")).not.toContain("1.2.3.4");
  });
});
