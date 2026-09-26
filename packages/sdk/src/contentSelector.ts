/** data-content-selector picks the element counted as "content in view" (spec section 6). */
export function pickContentElement(selectorAttr: string | null): Element | null {
  if (selectorAttr && selectorAttr.trim().length > 0) {
    try {
      const found = document.querySelector(selectorAttr);
      if (found) return found;
    } catch {
      // fall through to the default chain below
    }
  }
  // Default: main, article, body IN THAT PRIORITY ORDER — not a single combined selector,
  // which would return whichever matches first in document order instead.
  return document.querySelector("main") ?? document.querySelector("article") ?? document.body;
}
