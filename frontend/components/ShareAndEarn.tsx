"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";

export default function ShareAndEarn({ product }: { product: Product }) {
  const [copied, setCopied] = useState(false);

  function handleCreateLink() {
    const mockLink = `https://kawaipay.xyz/ref/${product.id}?via=demo`;
    navigator.clipboard.writeText(mockLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
          <p className="text-sm font-bold text-[var(--accent-green)]">+{product.rewardPerFiveSeconds} SUI</p>
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

      <button
        onClick={handleCreateLink}
        className="w-full py-2.5 rounded-full bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors"
      >
        {copied ? "Link copied ✓" : "Create affiliate link"}
      </button>
    </div>
  );
}
