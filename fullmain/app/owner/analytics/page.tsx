"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { loadZkLoginSession } from "@/lib/zklogin";
import { getProductsBySeller } from "@/lib/productStore";
import type { Product } from "@/lib/products";
import { AnalyticsTab } from "@/components/ProductOwnerDashboard";

export default function OwnerAnalyticsPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const role = sessionStorage.getItem("kawaii_role");
      if (role !== "owner") {
        router.push("/dashboard");
        return;
      }
      const session = await loadZkLoginSession();
      if (!session) {
        router.push("/shop");
        return;
      }
      if (cancelled) return;
      setAddress(session.address);
      setProducts(await getProductsBySeller(session.address));
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!products) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--cream)]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--muted-brown)]">Loading your real settlement data…</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cream)]">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <div className="mb-2">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
        </div>

        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-1">Product Owner</p>
          <h1 className="text-3xl font-bold text-[var(--espresso)] tracking-tight">Analytics</h1>
          <p className="text-sm text-[var(--muted-brown)] mt-1">Real performance across every product you've listed — {address?.slice(0, 6)}…{address?.slice(-6)}</p>
        </div>

        <AnalyticsTab products={products} />
      </main>
      <Footer />
    </div>
  );
}
