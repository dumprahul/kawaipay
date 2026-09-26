"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginModal from "./LoginModal";

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const router = useRouter();

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
      <nav className="sticky top-0 z-50 bg-[var(--cream)] border-b border-[var(--sand)]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/shop" className="shrink-0 font-semibold text-lg tracking-tight text-[var(--espresso)]">
            Kawaii<span className="text-[var(--accent-green)]">Pay</span>
          </Link>

          {/* Center nav */}
          <div className="hidden md:flex items-center gap-8 text-sm text-[var(--muted-brown)] font-medium">
            <Link href="/shop" className="hover:text-[var(--espresso)] transition-colors">Shop</Link>
            <Link href="/search" className="hover:text-[var(--espresso)] transition-colors">Categories</Link>
            <Link href="/search?q=trending" className="hover:text-[var(--espresso)] transition-colors">Trending</Link>
            <Link href="/creator" className="hover:text-[var(--espresso)] transition-colors">For Creators</Link>
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
                  className="w-48 text-sm border border-[var(--sand)] rounded-lg px-3 py-1.5 bg-[var(--ivory)] text-[var(--espresso)] placeholder:text-[var(--muted-brown)] outline-none focus:border-[var(--brown)] transition-colors"
                />
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors" aria-label="Search">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"/>
                </svg>
              </button>
            )}

            <button className="text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors" aria-label="Wishlist">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z"/>
              </svg>
            </button>

            <button
              onClick={() => setLoginOpen(true)}
              className="text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors"
              aria-label="Sign in"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </button>

            <button className="relative text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors" aria-label="Cart">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
              </svg>
            </button>

            <Link href="/creator" className="hidden lg:block text-xs font-medium px-4 py-2 rounded-full bg-[var(--espresso)] text-[var(--cream)] hover:bg-[var(--brown)] transition-colors whitespace-nowrap">
              Earn with Kawaii
            </Link>
          </div>
        </div>
      </nav>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </>
  );
}
