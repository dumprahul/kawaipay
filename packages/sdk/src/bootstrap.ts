// The actual shipped entrypoint (esbuild bundles this file to dist/sdk.js). Everything
// else in src/ is a plain, testable module — this file just wires them together and
// runs, matching the <script data-link="..."> embedding contract (spec section 6).
import { StatsCollector } from "./stats.js";
import { pickContentElement } from "./contentSelector.js";
import { SessionRunner } from "./sessionProtocol.js";

function main(): void {
  const scriptEl = document.currentScript as HTMLScriptElement | null;
  const linkId = scriptEl?.getAttribute("data-link");
  if (!linkId) return; // data-link is required; without it, do nothing (spec section 6)

  // Load only from our own first-party host — no third-party requests (privacy rules, MUST).
  const baseUrl = scriptEl?.src ? new URL(scriptEl.src).origin : window.location.origin;

  const contentEl = pickContentElement(scriptEl?.getAttribute("data-content-selector") ?? null);
  const collector = new StatsCollector(contentEl);
  collector.start();

  const runner = new SessionRunner({
    linkId,
    baseUrl,
    collector,
    fetchImpl: window.fetch.bind(window),
    now: () => performance.now(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms) as unknown as number,
    clearTimer: (id) => window.clearTimeout(id),
  });

  window.addEventListener("pagehide", () => runner.stop()); // step 7: no final heartbeat

  void runner.start();
}

main();
