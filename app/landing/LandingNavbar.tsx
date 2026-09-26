"use client";

import Link from "next/link";
import { useState } from "react";

export default function LandingNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="w-full px-8 pt-6 pb-4">
      {/* Floating white pill navbar */}
      <nav className="max-w-7xl mx-auto bg-white border border-[#E8E3DC] rounded-2xl shadow-sm px-6 py-3.5 flex items-center justify-between">
        <span className="font-semibold text-[15px] tracking-tight text-[#1a1a1a]">
          Kawaii<span style={{ color: "#5a7a5a" }}>Pay</span>
        </span>

        <div className="hidden md:flex items-center gap-8 text-[13px] text-[#666] font-medium">
          <Link href="/shop" className="hover:text-[#1a1a1a] transition-colors">Shop</Link>
          <a href="#how-it-works" className="hover:text-[#1a1a1a] transition-colors">How It Works</a>
          <a href="#creators" className="hover:text-[#1a1a1a] transition-colors">For Creators</a>
          <a href="#" className="hover:text-[#1a1a1a] transition-colors">Docs</a>
        </div>

        <Link
          href="/shop"
          className="hidden md:flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1a1a1a] text-white text-[13px] font-semibold hover:bg-[#333] transition-colors"
        >
          Get Started
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <button className="md:hidden text-[#666]" onClick={() => setMenuOpen(!menuOpen)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </nav>

      {menuOpen && (
        <div className="mt-2 max-w-7xl mx-auto bg-white border border-[#E8E3DC] rounded-2xl px-6 py-4 flex flex-col gap-4 text-[13px] text-[#666] md:hidden">
          <Link href="/shop" onClick={() => setMenuOpen(false)}>Shop</Link>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a>
          <a href="#creators" onClick={() => setMenuOpen(false)}>For Creators</a>
          <a href="#">Docs</a>
          <Link href="/shop" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1a1a1a] text-white w-fit font-semibold">
            Get Started →
          </Link>
        </div>
      )}
    </div>
  );
}
