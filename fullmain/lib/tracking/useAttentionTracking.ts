"use client";

import { useEffect, useRef } from "react";
import { StatsCollector } from "./stats";
import { SessionRunner } from "./sessionProtocol";
import { pickContentElement } from "./contentSelector";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8080";

/**
 * Mounts real attention tracking for one link — the same session/heartbeat protocol our
 * embeddable SDK (packages/sdk) runs on third-party pages, wired directly into a React
 * component instead of a <script> tag. Only ever call this with a real linkId: a visit
 * with no linkId (organic, no `via` referral) has nothing to attribute earnings to, so
 * the product page only mounts this when one is present.
 */
export function useAttentionTracking(linkId: string | null, contentSelector?: string) {
  const runnerRef = useRef<SessionRunner | null>(null);

  useEffect(() => {
    if (!linkId) return;

    const contentEl = pickContentElement(contentSelector ?? null);
    const collector = new StatsCollector(contentEl);
    collector.start();

    const runner = new SessionRunner({
      linkId,
      baseUrl: GATEWAY_URL,
      collector,
      fetchImpl: window.fetch.bind(window),
      now: () => performance.now(),
      setTimer: (fn, ms) => window.setTimeout(fn, ms) as unknown as number,
      clearTimer: (id) => window.clearTimeout(id),
    });
    runnerRef.current = runner;

    const onPageHide = () => runner.stop();
    window.addEventListener("pagehide", onPageHide);
    void runner.start();

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      runner.stop();
      collector.stop();
      runnerRef.current = null;
    };
  }, [linkId, contentSelector]);
}
