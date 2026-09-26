import { afterEach, describe, expect, it } from "vitest";
import { pickContentElement } from "../src/contentSelector.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("pickContentElement", () => {
  it("uses the given selector when provided", () => {
    document.body.innerHTML = '<div id="x"></div>';
    expect(pickContentElement("#x")).toBe(document.getElementById("x"));
  });

  it("falls back to main, article, body when no selector is given", () => {
    document.body.innerHTML = "<article></article>";
    expect(pickContentElement(null)).toBe(document.querySelector("article"));
  });

  it("falls back to body when neither main nor article exist", () => {
    expect(pickContentElement(null)).toBe(document.body);
  });

  it("falls back to body on an invalid selector rather than throwing", () => {
    expect(() => pickContentElement(":::not-valid:::")).not.toThrow();
    expect(pickContentElement(":::not-valid:::")).toBe(document.body);
  });

  it("prefers main over article when both exist and no selector is given", () => {
    document.body.innerHTML = "<article></article><main></main>";
    expect(pickContentElement(null)).toBe(document.querySelector("main"));
  });
});
