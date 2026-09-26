"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_LINKS = [
  {
    id: "1",
    product: "Haven Watch — Minimalist Timepiece",
    slug: "kawaii.pay/r/haven-watch-xk9",
    unverified: "0.0010",
    verified: "0.0020",
    bonus: "0.05",
    createdAgo: "2d ago",
  },
  {
    id: "2",
    product: "Lumina Glow Serum — 30ml",
    slug: "kawaii.pay/r/lumina-serum-m4t",
    unverified: "0.0010",
    verified: "0.0020",
    bonus: "0.05",
    createdAgo: "5d ago",
  },
  {
    id: "3",
    product: "CloudStep Runners — Unisex",
    slug: "kawaii.pay/r/cloudstep-zp2",
    unverified: "0.0010",
    verified: "0.0020",
    bonus: "0.08",
    createdAgo: "9d ago",
  },
  {
    id: "4",
    product: "Aura Diffuser — Bamboo Edition",
    slug: "kawaii.pay/r/aura-diff-k7r",
    unverified: "0.0010",
    verified: "0.0020",
    bonus: "0.05",
    createdAgo: "12d ago",
  },
];

const MOCK_PAYOUTS = [
  { id: "p1", type: "Attention payout", score: 0.91, amount: "$0.00005", stable: "0.0010 USDC", from: "0x0.10481756", status: "Completed", time: "09/24/26 14:37 PM" },
  { id: "p2", type: "Attention payout", score: 0.95, amount: "$0.00005", stable: "0.0010 USDC", from: "0x0.10481756", status: "Completed", time: "09/24/26 14:36 PM" },
  { id: "p3", type: "Attention payout", score: 0.95, amount: "$0.0004",  stable: "0.0070 USDC", from: "0x0.10481756", status: "Completed", time: "09/24/26 14:27 PM" },
  { id: "p4", type: "Attention payout", score: 0.95, amount: "$0.0004",  stable: "0.0070 USDC", from: "0x0.10481756", status: "Completed", time: "09/24/26 14:27 PM" },
  { id: "p5", type: "Conversion bonus", score: 0.94, amount: "$0.0500",  stable: "0.0500 USDC", from: "0x0.10481756", status: "Completed", time: "09/23/26 11:12 PM" },
  { id: "p6", type: "Attention payout", score: 0.80, amount: "$0.00005", stable: "0.0010 USDC", from: "0x0.10520214", status: "Completed", time: "09/22/26 09:27 PM" },
  { id: "p7", type: "Attention payout", score: 0.80, amount: "$0.00005", stable: "0.0010 USDC", from: "0x0.10520214", status: "Completed", time: "09/22/26 09:26 PM" },
  { id: "p8", type: "Attention payout", score: 0.83, amount: "$0.00005", stable: "0.0010 USDC", from: "0x0.10519322", status: "Pending",   time: "09/21/26 18:51 PM" },
  { id: "p9", type: "Attention payout", score: 0.93, amount: "$0.00005", stable: "0.0010 USDC", from: "0x0.10523099", status: "Pending",   time: "09/21/26 18:42 PM" },
  { id: "pa", type: "Conversion bonus", score: 0.70, amount: "$0.0500",  stable: "0.0500 USDC", from: "0x0.10522660", status: "Cancelled", time: "09/20/26 07:03 PM" },
];

const CHART_POINTS = [0, 0, 0, 0, 0, 0, 0, 0, 0.02, 0.06, 0.11, 0.08, 0.04, 0.01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const CHART_LABELS = ["9/1", "9/5", "9/9", "9/13", "9/17", "9/21", "9/26"];

const TOP_LINKS = [
  { slug: "haven-watch-xk9",  events: 13, amount: "0.11 USDC" },
  { slug: "lumina-serum-m4t", events: 16, amount: "0.05 USDC" },
  { slug: "cloudstep-zp2",    events:  1, amount: "0.05 USDC" },
  { slug: "aura-diff-k7r",    events:  8, amount: "0.02 USDC" },
];

const ESCROW_BUDGETS = [
  { product: "Haven Watch — Minimalist Timepiece",    spent: 0.0000, total: 15 },
  { product: "Lumina Glow Serum — 30ml",              spent: 0.0310, total: 15 },
  { product: "CloudStep Runners — Unisex",            spent: 0.0210, total: 15 },
  { product: "Aura Diffuser — Bamboo Edition",        spent: 0.0000, total: 15 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const STABLE_SYMBOL = (
  <span className="text-[11px] font-semibold text-[var(--accent-green)] bg-[#eaf2ea] px-1.5 py-0.5 rounded ml-1">USDC</span>
);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Completed: "text-[var(--accent-green)] bg-[#eaf2ea]",
    Pending:   "text-[#b07d2a] bg-[#fdf3e0]",
    Cancelled: "text-[var(--muted-brown)] bg-[var(--sand)]",
  };
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

type Tab = "links" | "payouts" | "analytics";

// ── Main component ────────────────────────────────────────────────────────────

export default function CreatorDashboard({ address, onLogout }: { address: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("links");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  function copySlug(slug: string) {
    navigator.clipboard.writeText(`https://${slug}`);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  const maxChart = Math.max(...CHART_POINTS, 0.01);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cream)]">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-1">Creator</p>
            <h1 className="text-3xl font-bold text-[var(--espresso)] tracking-tight">
              {tab === "links" ? "Your Links" : tab === "payouts" ? "Payouts" : "Analytics"}
            </h1>
            {tab === "payouts" && (
              <p className="text-sm text-[var(--muted-brown)] mt-1">Track every attention payout, conversion bonus and queued retry in one place.</p>
            )}
            {tab === "analytics" && (
              <p className="text-sm text-[var(--muted-brown)] mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] inline-block" />
                Live · refreshes every 12s
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Address pill */}
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted-brown)] bg-[var(--ivory)] border border-[var(--sand)] px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              {address.slice(0, 6)}…{address.slice(-6)}
            </span>
            <button onClick={onLogout} className="px-4 py-2 rounded-full border border-[var(--sand)] text-sm text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors">
              Sign out
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-8 bg-[var(--ivory)] border border-[var(--sand)] rounded-xl p-1 w-fit">
          {(["links", "payouts", "analytics"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t
                  ? "bg-white shadow-sm text-[var(--espresso)] border border-[var(--sand)]"
                  : "text-[var(--muted-brown)] hover:text-[var(--espresso)]"
              }`}
            >
              {t === "links" ? "Links" : t === "payouts" ? "Payouts" : "Analytics"}
            </button>
          ))}
        </div>

        {/* ══════════════════ LINKS TAB ══════════════════ */}
        {tab === "links" && (
          <div className="space-y-3">
            {MOCK_LINKS.map((link) => (
              <div key={link.id} className="bg-white border border-[var(--sand)] rounded-2xl px-6 py-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--espresso)]">{link.product}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] text-[var(--muted-brown)]">
                    <span>unverified {link.unverified} USDC/tick</span>
                    <span>verified {link.verified} USDC/tick</span>
                    <span>bonus {link.bonus} USDC</span>
                    <span className="text-[#bbb]">{link.createdAgo}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copySlug(link.slug)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--sand)] text-xs font-medium text-[var(--espresso)] hover:border-[var(--brown)] transition-colors bg-[var(--ivory)]"
                  >
                    {copiedSlug === link.slug ? (
                      <svg className="w-3.5 h-3.5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                    {copiedSlug === link.slug ? "Copied!" : "Copy link"}
                  </button>
                  <a
                    href={`https://suiscan.xyz/testnet`}
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

        {/* ══════════════════ PAYOUTS TAB ══════════════════ */}
        {tab === "payouts" && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Payouts",  value: "$0.0078", sub: "0.16 USDC · in range" },
                { label: "Completed",      value: "59",      sub: "92.2% success rate" },
                { label: "Pending",        value: "2",       sub: "$0.005 · 0.10 USDC queued" },
                { label: "Cancelled",      value: "3",       sub: "4.7% of all events" },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-[var(--sand)] rounded-2xl p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">{s.label}</p>
                  <p className="text-2xl font-bold text-[var(--espresso)] tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-[var(--muted-brown)] mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="bg-white border border-[var(--sand)] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--sand)]">
                      {["Activity", "Amount", "Type", "From", "Status", "Time"].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_PAYOUTS.map((p, i) => (
                      <tr key={p.id} className={`border-b border-[var(--sand)] last:border-0 ${i % 2 === 0 ? "" : "bg-[var(--cream)]/30"}`}>
                        <td className="px-5 py-4">
                          <p className="font-medium text-[var(--espresso)] text-[13px]">{p.type}</p>
                          <p className="text-[11px] text-[var(--muted-brown)] mt-0.5">pay_full · score {p.score.toFixed(2)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[var(--espresso)] text-[13px]">{p.amount}</p>
                          <p className="text-[11px] text-[var(--muted-brown)] mt-0.5 flex items-center gap-1">
                            {p.stable.split(" ")[0]}{STABLE_SYMBOL}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-[var(--muted-brown)]">{p.type.includes("Conversion") ? "Conversion" : "Attention"}</td>
                        <td className="px-5 py-4 font-mono text-[12px] text-[var(--muted-brown)]">{p.from} ↗</td>
                        <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                        <td className="px-5 py-4 text-[12px] text-[var(--muted-brown)] whitespace-nowrap">{p.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ ANALYTICS TAB ══════════════════ */}
        {tab === "analytics" && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Payouts",  value: "$0.0078", sub: "0.16 USDC · in range" },
                { label: "Completed",      value: "59",      sub: "92.2% success rate" },
                { label: "Pending",        value: "2",       sub: "$0.005 · 0.10 USDC queued" },
                { label: "Cancelled",      value: "3",       sub: "4.7% of all events" },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-[var(--sand)] rounded-2xl p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">{s.label}</p>
                  <p className="text-2xl font-bold text-[var(--espresso)] tracking-tight">{s.value}</p>
                  <p className="text-[11px] text-[var(--muted-brown)] mt-1">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Chart */}
              <div className="lg:col-span-2 bg-white border border-[var(--sand)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Completed Payout Volume</p>
                  <span className="text-[11px] text-[var(--muted-brown)]">9 active links in range</span>
                </div>
                {/* SVG sparkline */}
                <div className="relative h-32">
                  <svg viewBox="0 0 300 80" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5a7a5a" stopOpacity="0.15" />
                        <stop offset="100%" stopColor="#5a7a5a" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Fill area */}
                    <path
                      d={[
                        `M 0 80`,
                        ...CHART_POINTS.map((v, i) => `L ${(i / (CHART_POINTS.length - 1)) * 300} ${80 - (v / maxChart) * 70}`),
                        `L 300 80 Z`,
                      ].join(" ")}
                      fill="url(#chartFill)"
                    />
                    {/* Line */}
                    <polyline
                      points={CHART_POINTS.map((v, i) => `${(i / (CHART_POINTS.length - 1)) * 300},${80 - (v / maxChart) * 70}`).join(" ")}
                      fill="none"
                      stroke="#5a7a5a"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* Dots */}
                    {CHART_POINTS.map((v, i) => (
                      <circle key={i} cx={(i / (CHART_POINTS.length - 1)) * 300} cy={80 - (v / maxChart) * 70} r="2.5" fill="#5a7a5a" />
                    ))}
                  </svg>
                </div>
                <div className="flex justify-between mt-2">
                  {CHART_LABELS.map((l) => (
                    <span key={l} className="text-[10px] text-[var(--muted-brown)]">{l}</span>
                  ))}
                </div>
              </div>

              {/* By event type */}
              <div className="bg-white border border-[var(--sand)] rounded-2xl p-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-5">By Event Type</p>
                <div className="space-y-5">
                  {[
                    { label: "Conversion bonuses", value: "0.15 USDC", pct: 58 },
                    { label: "Attention payouts",  value: "0.11 USDC", pct: 42 },
                    { label: "Pending retries",    value: "0.0040 USDC", pct: 2 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[12px] mb-1.5">
                        <span className="text-[var(--espresso)]">{item.label}</span>
                        <span className="text-[var(--muted-brown)] font-mono">{item.value}</span>
                      </div>
                      <div className="h-1 bg-[var(--sand)] rounded-full overflow-hidden">
                        <div className="h-full bg-[var(--espresso)] rounded-full" style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top earning links */}
              <div className="bg-white border border-[var(--sand)] rounded-2xl p-6">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-5">Top Earning Links</p>
                <div className="space-y-4">
                  {TOP_LINKS.map((l) => {
                    const pct = Math.round((parseFloat(l.amount) / 0.11) * 100);
                    return (
                      <div key={l.slug}>
                        <div className="flex justify-between text-[12px] mb-1">
                          <span className="font-mono text-[var(--espresso)]">{l.slug}</span>
                          <span className="text-[var(--muted-brown)]">{l.amount}</span>
                        </div>
                        <p className="text-[10px] text-[var(--muted-brown)] mb-1">{l.events} events</p>
                        <div className="h-1 bg-[var(--sand)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--brown)] rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-product escrow budgets */}
              <div className="bg-white border border-[var(--sand)] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Per-Product Escrow Budgets</p>
                  <span className="text-[11px] text-[var(--muted-brown)]">{ESCROW_BUDGETS.length} with a cap set</span>
                </div>
                <div className="space-y-4">
                  {ESCROW_BUDGETS.map((e) => (
                    <div key={e.product}>
                      <p className="text-[12px] text-[var(--espresso)] mb-1">{e.product}</p>
                      <p className="text-[11px] text-[var(--muted-brown)] mb-1.5">
                        {e.spent.toFixed(4)} / {e.total}.0000 USDC spent
                      </p>
                      <div className="h-1 bg-[var(--sand)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-green)] rounded-full"
                          style={{ width: `${Math.max((e.spent / e.total) * 100, e.spent > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}
