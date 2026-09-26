"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadZkLoginSession, loadBuyerSession } from "@/lib/zklogin";
import LoginModal from "./LoginModal";

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsLoggedIn(!!(loadZkLoginSession() || loadBuyerSession()));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
  }

  return (
    <>
      <div className="w-full px-8 pt-6 pb-4 sticky top-0 z-50 bg-[var(--cream)]">
        <nav className="max-w-7xl mx-auto bg-white border border-[var(--sand)] rounded-2xl shadow-sm px-6 py-3.5 relative flex items-center justify-between gap-6">

          {/* Logo */}
          <Link href="/" className="shrink-0 font-semibold text-[15px] tracking-tight text-[var(--espresso)]">
            Kawaii<span className="text-[var(--accent-green)]">Pay</span>
          </Link>

          {/* Center nav — absolutely centred */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-7 text-[13px] text-[#666] font-medium">
            <Link href="/shop" className="hover:text-[var(--espresso)] transition-colors">Shop</Link>
            <Link href="/search" className="hover:text-[var(--espresso)] transition-colors">Categories</Link>
            <Link href="/search?q=trending" className="hover:text-[var(--espresso)] transition-colors">Trending</Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            {searchOpen ? (
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onBlur={() => { if (!query) setSearchOpen(false); }}
                  placeholder="Search products…"
                  className="w-44 text-[13px] border border-[var(--sand)] rounded-lg px-3 py-1.5 bg-[var(--ivory)] text-[var(--espresso)] placeholder:text-[#999] outline-none focus:border-[#999] transition-colors"
                />
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="text-[#888] hover:text-[var(--espresso)] transition-colors" aria-label="Search">
                <svg className="w-4.5 h-4.5" style={{width:"18px",height:"18px"}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"/>
                </svg>
              </button>
            )}

            <button className="text-[#888] hover:text-[var(--espresso)] transition-colors" aria-label="Wishlist">
              <svg style={{width:"18px",height:"18px"}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"/>
              </svg>
            </button>

            <button
              onClick={() => isLoggedIn ? router.push("/dashboard") : setLoginOpen(true)}
              className="text-[#888] hover:text-[var(--espresso)] transition-colors"
              aria-label={isLoggedIn ? "My account" : "Sign in"}
            >
              <svg style={{width:"18px",height:"18px"}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </button>

            <button className="text-[#888] hover:text-[var(--espresso)] transition-colors" aria-label="Cart">
              <svg style={{width:"18px",height:"18px"}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
            </button>

            <Link
              href="/creator"
              className="hidden lg:block text-[12px] font-semibold px-4 py-2 rounded-xl bg-[var(--espresso)] text-white hover:bg-[#333] transition-colors whitespace-nowrap"
            >
              Earn with Kawaii
            </Link>
          </div>
        </nav>
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </>
  );
}
