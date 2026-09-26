"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { loadZkLoginSession } from "@/lib/zklogin";
import { listCreatorLinks, getLinkHistory, type CreatorLinkSummary } from "@/lib/api";
import { withTimeout } from "@/lib/withTimeout";

const USDC_DECIMALS = 1_000_000;
const DAYS_IN_CHART = 14;

interface DayPoint {
  label: string;
  amount: number;
}

export default function CreatorAnalyticsPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [links, setLinks] = useState<CreatorLinkSummary[] | null>(null);
  const [dailyEarnings, setDailyEarnings] = useState<DayPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const role = sessionStorage.getItem("kawaii_role");
        if (role !== "creator") {
          router.push("/dashboard");
          return;
        }
        const session = await withTimeout(loadZkLoginSession(), 15_000, "Timed out checking your session — please refresh and try again.");
        if (!session) {
          router.push("/shop");
          return;
        }
        if (cancelled) return;
        setAddress(session.address);

        const creatorLinks = await withTimeout(listCreatorLinks(session.address), 15_000, "Timed out loading your links — please refresh and try again.");
        if (cancelled) return;
        setLinks(creatorLinks);

        // Real daily earnings, built from actual on-chain settlement timestamps — not a
        // synthetic curve. Bucket every settlement across every link into its calendar day.
        // A single link's history failing shouldn't blank out everyone else's — settle for
        // whatever came back and keep going.
        const perLink = await Promise.allSettled(creatorLinks.map((l) => getLinkHistory(l.linkId, { limit: 100 })));
        if (cancelled) return;

        const buckets = new Map<string, number>();
        const today = new Date();
        for (let i = DAYS_IN_CHART - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          buckets.set(d.toISOString().slice(0, 10), 0);
        }
        for (const result of perLink) {
          if (result.status !== "fulfilled") {
            console.error("[creator/analytics] failed to load link history:", result.reason);
            continue;
          }
          for (const s of result.value?.settlements ?? []) {
            const day = s.settledAt.slice(0, 10);
            if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + s.amount);
          }
        }
        setDailyEarnings(
          [...buckets.entries()].map(([day, amount]) => ({
            label: new Date(day).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
            amount: amount / USDC_DECIMALS,
          })),
        );
      } catch (err) {
        console.error("[creator/analytics] failed to load:", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your analytics");
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cream)]">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 max-w-md">{error}</p>
          <button onClick={() => window.location.reload()} className="text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] underline underline-offset-2">
            Try again
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!links || !dailyEarnings) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cream)]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--muted-brown)]">Crunching your real settlement history…</p>
        </main>
        <Footer />
      </div>
    );
  }

  const totalEarned = links.reduce((s, l) => s + l.earnedTotal, 0);
  const totalSettled = links.reduce((s, l) => s + l.settledTotal, 0);
  const totalBudgetRemaining = links.reduce((s, l) => s + l.budgetRemaining, 0);
  const activeLinks = links.filter((l) => !l.frozen).length;

  const topLinks = [...links].sort((a, b) => b.earnedTotal - a.earnedTotal).slice(0, 5);
  const maxTopEarned = Math.max(...topLinks.map((l) => l.earnedTotal), 1);
  const maxChart = Math.max(...dailyEarnings.map((d) => d.amount), 0.000001);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cream)]">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="flex items-center justify-between mb-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
          <Link href="/creator/payouts" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors">
            View payout history
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-1">Creator</p>
          <h1 className="text-3xl font-bold text-[var(--espresso)] tracking-tight">Analytics</h1>
          <p className="text-sm text-[var(--muted-brown)] mt-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] inline-block" />
            Real data from your on-chain settlements and live accruals — {address?.slice(0, 6)}…{address?.slice(-6)}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Earned (all-time)", value: (totalEarned / USDC_DECIMALS).toFixed(4), sub: "USDC across all links" },
            { label: "Settled on-chain", value: (totalSettled / USDC_DECIMALS).toFixed(4), sub: "USDC actually paid out" },
            { label: "Escrow available", value: (totalBudgetRemaining / USDC_DECIMALS).toFixed(2), sub: "USDC left in your links' campaigns" },
            { label: "Active links", value: String(activeLinks), sub: `of ${links.length} total` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[var(--sand)] rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">{s.label}</p>
              <p className="text-2xl font-bold text-[var(--espresso)] tracking-tight">{s.value}</p>
              <p className="text-[11px] text-[var(--muted-brown)] mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Real daily earnings chart */}
          <div className="lg:col-span-2 bg-white border border-[var(--sand)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Settled Earnings — Last {DAYS_IN_CHART} Days</p>
              <span className="text-[11px] text-[var(--muted-brown)]">{links.length} link{links.length === 1 ? "" : "s"} in range</span>
            </div>
            <div className="relative h-32">
              <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="creatorChartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5a7a5a" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#5a7a5a" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={[
                    `M 0 80`,
                    ...dailyEarnings.map((d, i) => `L ${(i / (dailyEarnings.length - 1)) * 300} ${80 - (d.amount / maxChart) * 70}`),
                    `L 300 80 Z`,
                  ].join(" ")}
                  fill="url(#creatorChartFill)"
                />
                <polyline
                  points={dailyEarnings.map((d, i) => `${(i / (dailyEarnings.length - 1)) * 300},${80 - (d.amount / maxChart) * 70}`).join(" ")}
                  fill="none"
                  stroke="#5a7a5a"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {dailyEarnings.map((d, i) => (
                  <circle key={i} cx={(i / (dailyEarnings.length - 1)) * 300} cy={80 - (d.amount / maxChart) * 70} r="2.5" fill="#5a7a5a" />
                ))}
              </svg>
            </div>
            <div className="flex justify-between mt-2">
              {dailyEarnings.filter((_, i) => i % 2 === 0).map((d) => (
                <span key={d.label} className="text-[10px] text-[var(--muted-brown)]">{d.label}</span>
              ))}
            </div>
          </div>

          {/* Top earning links */}
          <div className="bg-white border border-[var(--sand)] rounded-2xl p-6">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-5">Top Earning Links</p>
            <div className="space-y-4">
              {topLinks.length === 0 ? (
                <p className="text-xs text-[var(--muted-brown)]">No links yet.</p>
              ) : (
                topLinks.map((l) => (
                  <div key={l.linkId}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-[var(--espresso)] truncate max-w-[140px]">{l.title ?? "Untitled"}</span>
                      <span className="text-[var(--muted-brown)] font-mono">{(l.earnedTotal / USDC_DECIMALS).toFixed(4)}</span>
                    </div>
                    <div className="h-1 bg-[var(--sand)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--brown)] rounded-full" style={{ width: `${Math.max((l.earnedTotal / maxTopEarned) * 100, l.earnedTotal > 0 ? 2 : 0)}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* All links table */}
        <div className="bg-white border border-[var(--sand)] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--sand)]">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Every Link You've Created</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--sand)]">
                {["Product", "Status", "Earned / Settled", "Escrow Remaining"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-[13px] text-[var(--muted-brown)]">You haven't created any affiliate links yet.</td></tr>
              ) : (
                links.map((l, i) => (
                  <tr key={l.linkId} className={`border-b border-[var(--sand)] last:border-0 ${i % 2 === 0 ? "" : "bg-[var(--cream)]/30"}`}>
                    <td className="px-5 py-4 text-[13px] font-medium text-[var(--espresso)]">{l.title ?? "Untitled product"}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${l.frozen ? "text-[var(--muted-brown)] bg-[var(--sand)]" : "text-[var(--accent-green)] bg-[#eaf2ea]"}`}>
                        {l.frozen ? "Frozen" : "Active"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-mono text-[var(--muted-brown)]">
                      {(l.earnedTotal / USDC_DECIMALS).toFixed(4)} / {(l.settledTotal / USDC_DECIMALS).toFixed(4)}
                    </td>
                    <td className="px-5 py-4 text-[13px] font-mono text-[var(--muted-brown)]">{(l.budgetRemaining / USDC_DECIMALS).toFixed(2)} USDC</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </div>
  );
}
