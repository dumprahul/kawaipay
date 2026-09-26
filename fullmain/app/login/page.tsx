"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { startZkLogin, buildBuyerOAuthUrl } from "@/lib/zklogin";
import { listCampaigns } from "@/lib/api";

type Role = "buyer" | "creator" | "owner";

const ROLES: { id: Role; label: string; description: string }[] = [
  { id: "buyer", label: "Buyer", description: "Discover and purchase products" },
  { id: "creator", label: "Creator", description: "Share products, earn verified-attention USDC" },
  { id: "owner", label: "Product Owner", description: "List products, fund campaigns on Sui" },
];

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<Role>("creator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);

  useEffect(() => {
    listCampaigns({ limit: 100 })
      .then((page) => setProductCount(page.campaigns.length))
      .catch(() => setProductCount(null));
  }, []);

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem("kawaii_role", selectedRole);
      if (selectedRole === "buyer") {
        window.location.href = buildBuyerOAuthUrl();
      } else {
        window.location.href = await startZkLogin("google");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start login");
      setLoading(false);
    }
  }

  const isBuyer = selectedRole === "buyer";

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[var(--cream)]">
      {/* ── Left: login panel ── */}
      <div className="flex flex-col justify-center px-8 sm:px-16 py-16">
        <div className="w-full max-w-md mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold text-[15px] tracking-tight text-[var(--espresso)] mb-16">
            Kawaii<span className="text-[var(--accent-green)]">Pay</span>
          </Link>

          <h1 className="text-4xl font-bold text-[var(--espresso)] tracking-tight leading-tight">
            Log in to
            <br />
            <span className="text-[var(--muted-brown)]">KawaiiPay</span>
          </h1>
          <p className="mt-4 text-[15px] text-[var(--muted-brown)] leading-relaxed">
            No email, no password — sign in with zkLogin and get a real Sui wallet derived
            straight from your Google identity. No seed phrase, nothing to lose.
          </p>

          {/* Role selection */}
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-3">I am a…</p>
            <div className="space-y-2">
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all text-left ${
                    selectedRole === role.id
                      ? "border-[var(--espresso)] bg-[var(--ivory)] text-[var(--espresso)]"
                      : "border-[var(--sand)] bg-[var(--ivory)] text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)]"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{role.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{role.description}</p>
                  </div>
                  {selectedRole === role.id && (
                    <svg className="w-4 h-4 ml-auto shrink-0 text-[var(--espresso)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={loading}
            className="mt-6 w-full flex items-center justify-between gap-3 px-6 py-4 rounded-xl bg-[var(--espresso)] text-white text-sm font-semibold hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            <span className="flex items-center gap-3">
              {loading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#fff" opacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#fff" opacity="0.7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#fff" opacity="0.6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#fff" opacity="0.8" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              {loading ? "Redirecting…" : "Continue with Google"}
            </span>
            {!loading && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {error && (
            <p className="mt-4 text-red-700 text-xs text-center bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
          )}

          <p className="mt-6 text-center text-[var(--muted-brown)] text-xs leading-relaxed">
            {isBuyer
              ? "Your Google account only identifies you — no blockchain interaction for buyers."
              : "Your Sui address is derived from your OAuth identity. Creators verify Proof of Humanity with World ID weekly to keep payouts flowing — no personal data ever touches the chain."}
          </p>

          <Link href="/shop" className="mt-8 block text-center text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors underline underline-offset-2">
            Skip to shop — browse without signing in
          </Link>
        </div>
      </div>

      {/* ── Right: visual panel ── */}
      <div className="hidden lg:block relative overflow-hidden bg-[var(--espresso)]">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18) 0, transparent 45%), radial-gradient(circle at 75% 60%, rgba(255,255,255,0.14) 0, transparent 50%), radial-gradient(circle at 50% 90%, rgba(255,255,255,0.10) 0, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
        />

        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-start justify-between">
            <h2 className="text-3xl font-bold tracking-tight max-w-xs leading-tight">
              More creators.
              <br />A bigger tomorrow.
            </h2>
            {productCount !== null && (
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Live now</p>
                <p className="text-3xl font-bold">{productCount}+</p>
                <p className="text-xs opacity-60">products on testnet</p>
              </div>
            )}
          </div>

          <div className="flex items-end justify-between">
            <h2 className="text-3xl font-bold tracking-tight max-w-xs leading-tight">
              A more open
              <br />creator economy.
            </h2>
            <div className="text-right space-y-2 text-xs">
              <p className="flex items-center justify-end gap-2 opacity-80">
                Real-time settlement
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              </p>
              <p className="flex items-center justify-end gap-2 opacity-80">
                Oracle-verified attention
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              </p>
              <p className="flex items-center justify-end gap-2 opacity-80">
                World ID Proof of Humanity
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
