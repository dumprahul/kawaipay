"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { loadZkLoginSession } from "@/lib/zklogin";
import { createLinkOnChain } from "@/lib/chainTransactions";

type Status = "idle" | "creating" | "done" | "error";

export default function ShareAndEarn({ product }: { product: Product }) {
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateLink() {
    const session = await loadZkLoginSession();
    if (!session) {
      setError("Sign in as a creator first to create a real shareable link.");
      setStatus("error");
      return;
    }

    setStatus("creating");
    setError(null);
    try {
      // Real on-chain link::create, signed by this creator's zkLogin session — permissionless
      // since every campaign created from this app has open_links: true.
      const { linkId } = await createLinkOnChain(session, product.id);
      const url = `${window.location.origin}/product/${product.id}?via=${linkId}`;
      setLink(url);
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setStatus("done");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create link");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--sand)] bg-[var(--ivory)] p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-[var(--espresso)] mb-1">Share &amp; Earn</h3>
        <p className="text-xs text-[var(--muted-brown)] leading-relaxed">
          Share this product with your audience and earn from verified human attention.
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 text-center border border-[var(--sand)]">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-brown)] mb-1">Reward interval</p>
          <p className="text-sm font-bold text-[var(--espresso)]">Every 5s</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-[var(--sand)]">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-brown)] mb-1">Creator reward</p>
          <p className="text-sm font-bold text-[var(--accent-green)]">+{product.rewardPerFiveSeconds} USDC</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-center border border-[var(--sand)]">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted-brown)] mb-1">Verification</p>
          <p className="text-sm font-bold text-[var(--espresso)]">✓ Human</p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="flex items-center gap-4 text-xs text-[var(--muted-brown)]">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] inline-block" />
          Attention tracking active
        </span>
        <span className="flex items-center gap-1.5">
          <span>◇</span>
          Settled on Sui
        </span>
      </div>

      {link && (
        <div className="bg-white border border-[var(--sand)] rounded-xl px-3 py-2 text-[11px] font-mono text-[var(--brown)] break-all">
          {link}
        </div>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <button
        onClick={handleCreateLink}
        disabled={status === "creating"}
        className="w-full py-2.5 rounded-full bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors disabled:opacity-60"
      >
        {status === "creating" ? "Creating on-chain link…" : copied ? "Link copied ✓" : "Create affiliate link"}
      </button>
    </div>
  );
}
