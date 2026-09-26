"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WorldIdVerification from "@/components/WorldIdVerification";
import { listCreatorLinks, type CreatorLinkSummary } from "@/lib/api";

const USDC_DECIMALS = 1_000_000;

// ── Main component ────────────────────────────────────────────────────────────

export default function CreatorDashboard({ address, onLogout }: { address: string; onLogout: () => void }) {
  const [links, setLinks] = useState<CreatorLinkSummary[] | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCreatorLinks(address).then((l) => !cancelled && setLinks(l));
    return () => {
      cancelled = true;
    };
  }, [address]);

  function copyShareUrl(link: CreatorLinkSummary) {
    const url = `${window.location.origin}/product/${link.campaignId}?via=${link.linkId}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkId(link.linkId);
    setTimeout(() => setCopiedLinkId(null), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cream)]">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-1">Creator</p>
            <h1 className="text-3xl font-bold text-[var(--espresso)] tracking-tight">Your Links</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted-brown)] bg-[var(--ivory)] border border-[var(--sand)] px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              {address.slice(0, 6)}…{address.slice(-6)}
            </span>
            <button onClick={onLogout} className="px-4 py-2 rounded-full border border-[var(--sand)] text-sm text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors">
              Sign out
            </button>
          </div>
        </div>

        <WorldIdVerification address={address} />

        {/* ── Tabs — Links is real & in-page; Payouts/Analytics are dedicated pages ── */}
        <div className="flex items-center gap-1 mb-8 bg-[var(--ivory)] border border-[var(--sand)] rounded-xl p-1 w-fit">
          <span className="px-5 py-2 rounded-lg text-sm font-medium bg-white shadow-sm text-[var(--espresso)] border border-[var(--sand)]">
            Links
          </span>
          <Link href="/creator/payouts" className="px-5 py-2 rounded-lg text-sm font-medium text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-all">
            Payouts
          </Link>
          <Link href="/creator/analytics" className="px-5 py-2 rounded-lg text-sm font-medium text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-all">
            Analytics
          </Link>
        </div>

        {/* ══════════════════ LINKS (real) ══════════════════ */}
        {links === null ? (
          <p className="text-sm text-[var(--muted-brown)] py-10 text-center">Loading your real links…</p>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--ivory)] border border-[var(--sand)] flex items-center justify-center">
              <svg className="w-7 h-7 text-[var(--muted-brown)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 010 5.656l-4 4a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l4-4a4 4 0 015.656 5.656l-1.5 1.5" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[var(--espresso)]">No affiliate links yet</p>
              <p className="text-sm text-[var(--muted-brown)] mt-1">Browse the shop and generate one from any product to start earning.</p>
            </div>
            <Link href="/shop" className="px-5 py-2.5 rounded-xl bg-[var(--espresso)] text-white text-sm font-medium hover:bg-[var(--brown)] transition-colors mt-2">
              Browse shop
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.linkId} className="bg-white border border-[var(--sand)] rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--espresso)] truncate">{link.title ?? "Untitled product"}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-[var(--muted-brown)]">
                    <span>earned {(link.earnedTotal / USDC_DECIMALS).toFixed(4)} USDC</span>
                    <span>settled {(link.settledTotal / USDC_DECIMALS).toFixed(4)} USDC</span>
                    <span className={link.frozen ? "text-[var(--brown)]" : "text-[var(--accent-green)]"}>{link.frozen ? "Frozen" : "Active"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyShareUrl(link)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sand)] text-xs font-medium text-[var(--espresso)] hover:border-[var(--brown)] transition-colors bg-[var(--ivory)]"
                  >
                    {copiedLinkId === link.linkId ? (
                      <svg className="w-3.5 h-3.5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                    {copiedLinkId === link.linkId ? "Copied!" : "Copy link"}
                  </button>
                  <a
                    href={`https://suiscan.xyz/testnet/object/${link.linkId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-[var(--sand)] text-xs font-medium text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors bg-[var(--ivory)]"
                  >
                    SuiScan
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
