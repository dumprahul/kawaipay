"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { loadZkLoginSession } from "@/lib/zklogin";
import { listCreatorLinks, getLinkHistory, type CreatorLinkSummary, type SettlementHistoryEntry } from "@/lib/api";
import { withTimeout } from "@/lib/withTimeout";

const USDC_DECIMALS = 1_000_000;

interface PayoutRow extends SettlementHistoryEntry {
  linkId: string;
  productTitle: string | null;
}

function StatusBadge() {
  // Every row here comes from the settlements table — a PayoutSettled event the indexer
  // has already confirmed on-chain. There's no "pending"/"cancelled" concept at this
  // layer (that's batch_items, an internal pipeline state) — if it's here, it's real
  // and it's done.
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full text-[var(--accent-green)] bg-[#eaf2ea]">
      Confirmed on-chain
    </span>
  );
}

export default function CreatorPayoutsPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [links, setLinks] = useState<CreatorLinkSummary[] | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);
  const [ready, setReady] = useState(false);
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

        // A single link's history failing shouldn't blank the whole page — settle for
        // whatever came back and keep going, same as the analytics page.
        const perLink = await Promise.allSettled(
          creatorLinks.map(async (l) => {
            const page = await getLinkHistory(l.linkId, { limit: 25 });
            return (page?.settlements ?? []).map((s) => ({ ...s, linkId: l.linkId, productTitle: l.title }));
          }),
        );
        if (cancelled) return;
        const merged = perLink
          .flatMap((r) => {
            if (r.status !== "fulfilled") {
              console.error("[creator/payouts] failed to load link history:", r.reason);
              return [];
            }
            return r.value;
          })
          .sort((a, b) => new Date(b.settledAt).getTime() - new Date(a.settledAt).getTime());
        setPayouts(merged);
        setReady(true);
      } catch (err) {
        console.error("[creator/payouts] failed to load:", err);
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your payouts");
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

  if (!ready || !links || !payouts) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cream)]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--muted-brown)]">Loading your real payout history…</p>
        </main>
        <Footer />
      </div>
    );
  }

  const totalEarned = links.reduce((s, l) => s + l.earnedTotal, 0);
  const totalSettled = links.reduce((s, l) => s + l.settledTotal, 0);
  const pendingSettlement = totalEarned - totalSettled;
  const successRate = payouts.length > 0 ? 100 : 0; // every row here already succeeded on-chain

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
          <Link href="/creator/analytics" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors">
            View analytics
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-1">Creator</p>
          <h1 className="text-3xl font-bold text-[var(--espresso)] tracking-tight">Payouts</h1>
          <p className="text-sm text-[var(--muted-brown)] mt-1">Every real, on-chain settlement across all your links — {address?.slice(0, 6)}…{address?.slice(-6)}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Settled (on-chain)", value: (totalSettled / USDC_DECIMALS).toFixed(4), sub: "USDC actually paid out" },
            { label: "Earned (all-time)", value: (totalEarned / USDC_DECIMALS).toFixed(4), sub: "USDC, verified attention" },
            { label: "Awaiting settlement", value: (pendingSettlement / USDC_DECIMALS).toFixed(4), sub: "USDC accrued, not yet batched" },
            { label: "Payout events", value: String(payouts.length), sub: `${successRate}% confirmed` },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[var(--sand)] rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">{s.label}</p>
              <p className="text-2xl font-bold text-[var(--espresso)] tracking-tight">{s.value}</p>
              <p className="text-[11px] text-[var(--muted-brown)] mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-[var(--sand)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--sand)]">
                  {["Product / Link", "Amount", "Seconds verified", "Tx", "Status", "Settled at"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payouts.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-[13px] text-[var(--muted-brown)]">No settlements yet — payouts appear here once the batcher confirms one on-chain.</td></tr>
                ) : (
                  payouts.map((p, i) => (
                    <tr key={`${p.linkId}-${p.seq}`} className={`border-b border-[var(--sand)] last:border-0 ${i % 2 === 0 ? "" : "bg-[var(--cream)]/30"}`}>
                      <td className="px-5 py-4">
                        <p className="font-medium text-[var(--espresso)] text-[13px]">{p.productTitle ?? "Untitled product"}</p>
                        <p className="text-[11px] text-[var(--muted-brown)] mt-0.5 font-mono">{p.linkId.slice(0, 10)}…</p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[var(--espresso)] text-[13px]">
                        {(p.amount / USDC_DECIMALS).toFixed(6)} <span className="text-[10px] font-semibold text-[var(--accent-green)] bg-[#eaf2ea] px-1.5 py-0.5 rounded ml-1">USDC</span>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[var(--muted-brown)]">{p.secondsVerified}s</td>
                      <td className="px-5 py-4">
                        <a href={`https://suiscan.xyz/testnet/tx/${p.txDigest}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] text-[var(--muted-brown)] hover:text-[var(--espresso)]">
                          {p.txDigest.slice(0, 8)}… ↗
                        </a>
                      </td>
                      <td className="px-5 py-4"><StatusBadge /></td>
                      <td className="px-5 py-4 text-[12px] text-[var(--muted-brown)] whitespace-nowrap">{new Date(p.settledAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
