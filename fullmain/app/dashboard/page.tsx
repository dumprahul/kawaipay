"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  loadZkLoginSession, clearZkLoginSession,
  loadBuyerSession, clearBuyerSession,
  type BuyerSession,
} from "@/lib/zklogin";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CreatorDashboard from "@/components/CreatorDashboard";
import ProductOwnerDashboard from "@/components/ProductOwnerDashboard";

export default function DashboardPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [buyer, setBuyer] = useState<BuyerSession | null>(null);
  const [ready, setReady] = useState(false);

  async function fetchBalance(addr: string) {
    try {
      const res = await fetch("https://graphql.testnet.sui.io/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{ address(address: "${addr}") { balance { totalBalance } } }`,
        }),
      });
      const { data } = await res.json();
      const raw = data?.address?.balance?.totalBalance ?? "0";
      setBalance((Number(raw) / 1_000_000_000).toFixed(4));
    } catch {
      setBalance("0.0000");
    }
  }

  useEffect(() => {
    const r = sessionStorage.getItem("kawaii_role");
    setRole(r);

    async function init() {
      if (r === "buyer") {
        const bs = loadBuyerSession();
        if (!bs) { router.push("/shop"); return; }
        setBuyer(bs);
      } else {
        const session = await loadZkLoginSession();
        if (!session) { router.push("/shop"); return; }
        setAddress(session.address);
        fetchBalance(session.address);
      }
      setReady(true);
    }
    init();
  }, [router]);

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLogout() {
    clearZkLoginSession();
    clearBuyerSession();
    sessionStorage.removeItem("kawaii_role");
    router.push("/shop");
  }

  if (!ready) return null;

  const roleLabel = role === "owner" ? "Product Owner" : role === "creator" ? "Creator" : "Buyer";

  // ── Buyer dashboard
  if (buyer) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cream)]">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--espresso)] tracking-tight">My Account</h1>
              <p className="text-sm text-[var(--muted-brown)] mt-0.5">Signed in with Google</p>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 rounded-full border border-[var(--sand)] text-sm text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors">
              Sign out
            </button>
          </div>
          <div className="bg-[var(--ivory)] border border-[var(--sand)] rounded-2xl p-6 flex items-center gap-5">
            {buyer.picture && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={buyer.picture} alt="" className="w-14 h-14 rounded-full border border-[var(--sand)]" />
            )}
            <div>
              <p className="text-base font-semibold text-[var(--espresso)]">{buyer.name}</p>
              <p className="text-sm text-[var(--muted-brown)]">{buyer.email}</p>
              <span className="mt-1.5 inline-block text-xs font-medium px-3 py-1 rounded-full bg-[var(--sand)] text-[var(--espresso)]">Buyer</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/shop" className="flex items-center gap-3 p-4 rounded-xl bg-[var(--ivory)] border border-[var(--sand)] hover:border-[var(--brown)] hover:bg-[var(--cream)] transition-all group">
              <svg className="w-5 h-5 text-[var(--muted-brown)] group-hover:text-[var(--espresso)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--espresso)]">Browse Shop</p>
                <p className="text-xs text-[var(--muted-brown)]">Discover products</p>
              </div>
            </Link>
            <Link href="/search?q=trending" className="flex items-center gap-3 p-4 rounded-xl bg-[var(--ivory)] border border-[var(--sand)] hover:border-[var(--brown)] hover:bg-[var(--cream)] transition-all group">
              <svg className="w-5 h-5 text-[var(--muted-brown)] group-hover:text-[var(--espresso)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--espresso)]">Trending</p>
                <p className="text-xs text-[var(--muted-brown)]">What&apos;s hot right now</p>
              </div>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Creator dashboard — full 3-tab layout
  if (role === "creator" && address) {
    return <CreatorDashboard address={address} onLogout={handleLogout} />;
  }

  // ── Product Owner dashboard — Add Product + Analytics
  if (role === "owner" && address) {
    return <ProductOwnerDashboard address={address} onLogout={handleLogout} />;
  }
  return (
    <div className="min-h-screen flex flex-col bg-[var(--cream)]">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--espresso)] tracking-tight">My Account</h1>
            <p className="text-sm text-[var(--muted-brown)] mt-0.5">Signed in via zkLogin · Testnet</p>
          </div>
          <button onClick={handleLogout} className="px-4 py-2 rounded-full border border-[var(--sand)] text-sm text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors">
            Sign out
          </button>
        </div>

        <div className="bg-[var(--ivory)] border border-[var(--sand)] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Sui Address</p>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-[var(--sand)] text-[var(--espresso)]">{roleLabel}</span>
          </div>
          <div className="flex items-start gap-3">
            <code className="text-[var(--brown)] text-xs break-all flex-1 leading-relaxed font-mono">{address}</code>
            <button onClick={handleCopy} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--sand)] bg-[var(--cream)] text-xs text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors">
              {copied ? (
                <><svg className="w-3.5 h-3.5 text-[var(--accent-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied</>
              ) : (
                <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy</>
              )}
            </button>
          </div>
          <a href={`https://suiscan.xyz/testnet/account/${address}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors">
            View on Suiscan
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        </div>

        <div className="bg-[var(--ivory)] border border-[var(--sand)] rounded-2xl p-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Balance</p>
          <p className="text-4xl font-bold text-[var(--espresso)] tracking-tight">
            {balance !== null ? balance : "—"}
            <span className="text-xl text-[var(--brown)] ml-2">SUI</span>
          </p>
          <p className="text-xs text-[var(--muted-brown)]">Testnet · Updated just now</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/shop" className="flex items-center gap-3 p-4 rounded-xl bg-[var(--ivory)] border border-[var(--sand)] hover:border-[var(--brown)] hover:bg-[var(--cream)] transition-all group">
            <svg className="w-5 h-5 text-[var(--muted-brown)] group-hover:text-[var(--espresso)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            <div>
              <p className="text-sm font-medium text-[var(--espresso)]">Browse Shop</p>
              <p className="text-xs text-[var(--muted-brown)]">Discover products</p>
            </div>
          </Link>
          <Link href="/creator" className="flex items-center gap-3 p-4 rounded-xl bg-[var(--ivory)] border border-[var(--sand)] hover:border-[var(--brown)] hover:bg-[var(--cream)] transition-all group">
            <svg className="w-5 h-5 text-[var(--muted-brown)] group-hover:text-[var(--espresso)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="text-sm font-medium text-[var(--espresso)]">Earn Rewards</p>
              <p className="text-xs text-[var(--muted-brown)]">Share & get SUI</p>
            </div>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
