"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";
import { loadZkLoginSession } from "@/lib/zklogin";
import { createLinkOnChain } from "@/lib/chainTransactions";

type Status = "idle" | "creating" | "done" | "error";

interface GenerateLinkModalProps {
  product: Product;
  onClose: () => void;
}

/**
 * The one place a creator turns a product into a shareable, on-chain-tracked affiliate
 * link. Nothing is "shared" until this succeeds — the link only exists once link::create
 * has actually confirmed on-chain, so there's no way to hand out a link that isn't real.
 */
export default function GenerateLinkModal({ product, onClose }: GenerateLinkModalProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setStatus("creating");
    setError(null);
    try {
      const session = await loadZkLoginSession();
      if (!session) {
        setError("Sign in as a creator first to generate a real, on-chain shareable link.");
        setStatus("error");
        return;
      }
      // Real on-chain link::create, signed by this creator's zkLogin session —
      // permissionless since every campaign created from this app has open_links: true.
      const { linkId } = await createLinkOnChain(session, product.id);
      const url = `${window.location.origin}/product/${product.id}?via=${linkId}`;
      setLink(url);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate link");
      setStatus("error");
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: product.name, url: link }).catch(() => {});
    } else {
      handleCopy();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-[var(--espresso)]/40 backdrop-blur-sm" />

      <div className="relative w-full max-w-md bg-[var(--cream)] rounded-2xl shadow-2xl border border-[var(--sand)] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Product preview */}
        <div className="px-8 pt-8 pb-5 border-b border-[var(--sand)] flex items-center gap-4">
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-16 h-16 rounded-xl object-cover border border-[var(--sand)] shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[var(--muted-brown)] font-medium">{product.category}</p>
            <h2 className="text-base font-semibold text-[var(--espresso)] tracking-tight truncate">{product.name}</h2>
            <p className="text-sm text-[var(--muted-brown)]">${product.price}</p>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {status !== "done" && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-[var(--espresso)] mb-1">Generate your affiliate link</h3>
                <p className="text-xs text-[var(--muted-brown)] leading-relaxed">
                  A real, on-chain shareable link is created for you — earn from every verified
                  human who spends time on it.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[var(--ivory)] rounded-xl p-3 text-center border border-[var(--sand)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-brown)] mb-1">Interval</p>
                  <p className="text-sm font-bold text-[var(--espresso)]">Every 5s</p>
                </div>
                <div className="bg-[var(--ivory)] rounded-xl p-3 text-center border border-[var(--sand)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-brown)] mb-1">You earn</p>
                  <p className="text-sm font-bold text-[var(--accent-green)]">+{product.rewardPerFiveSeconds} USDC</p>
                </div>
                <div className="bg-[var(--ivory)] rounded-xl p-3 text-center border border-[var(--sand)]">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--muted-brown)] mb-1">Checked by</p>
                  <p className="text-sm font-bold text-[var(--espresso)]">Oracle</p>
                </div>
              </div>

              <p className="text-[11px] text-[var(--muted-brown)] leading-relaxed bg-[var(--ivory)] border border-[var(--sand)] rounded-xl px-4 py-3">
                Every visit through your link is monitored in the background by our oracle,
                which verifies real human attention before anything settles on Sui — nothing
                is paid out for bot traffic or an empty tab.
              </p>

              {error && (
                <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {error}
                </p>
              )}

              <button
                onClick={handleGenerate}
                disabled={status === "creating"}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors disabled:opacity-60"
              >
                {status === "creating" ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Creating on-chain link…
                  </>
                ) : (
                  "Generate my affiliate link"
                )}
              </button>
            </>
          )}

          {status === "done" && link && (
            <>
              <div className="flex items-center gap-2 text-[var(--accent-green)]">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <h3 className="text-sm font-semibold">Your link is live on-chain</h3>
              </div>
              <p className="text-xs text-[var(--muted-brown)] leading-relaxed">
                Share it now — every second of verified attention it gets is tracked by the
                oracle and pays out straight to your wallet.
              </p>

              <div className="bg-white border border-[var(--sand)] rounded-xl px-4 py-3 text-[12px] font-mono text-[var(--brown)] break-all">
                {link}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleCopy}
                  className="py-2.5 rounded-xl border border-[var(--sand)] bg-[var(--ivory)] text-sm text-[var(--espresso)] hover:border-[var(--brown)] transition-colors"
                >
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
                <button
                  onClick={handleShare}
                  className="py-2.5 rounded-xl bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors"
                >
                  Share
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full text-center text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors pt-1"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
