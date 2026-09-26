"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductGallery from "@/components/ProductGallery";
import ProductInfo from "@/components/ProductInfo";
import ShareAndEarn from "@/components/ShareAndEarn";
import ProductGrid from "@/components/ProductGrid";
import { getAllProducts } from "@/lib/productStore";
import type { Product } from "@/lib/products";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [related, setRelated] = useState<Product[]>([]);

  useEffect(() => {
    const all = getAllProducts();
    const found = all.find((p) => p.id === id) ?? null;
    setProduct(found);
    if (found) {
      setRelated(all.filter((p) => p.category === found.category && p.id !== found.id).slice(0, 4));
    }
  }, [id]);

  // Still loading
  if (product === undefined) return null;

  // Not found
  if (product === null) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-2xl font-bold text-[var(--espresso)]">Product not found</p>
            <Link href="/shop" className="text-sm text-[var(--muted-brown)] hover:text-[var(--espresso)] underline">
              Back to shop
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Breadcrumbs */}
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <nav className="flex items-center gap-2 text-xs text-[var(--muted-brown)]">
            <Link href="/shop" className="hover:text-[var(--espresso)] transition-colors">Shop</Link>
            <span>·</span>
            <Link href={`/category/${product.category.toLowerCase()}`} className="hover:text-[var(--espresso)] transition-colors">
              {product.category}
            </Link>
            <span>·</span>
            <span className="text-[var(--espresso)]">{product.name}</span>
          </nav>
        </div>

        {/* Main product section */}
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-14">
          <ProductGallery product={product} />
          <div className="space-y-8">
            <ProductInfo product={product} />
            {product.affiliateEligible && <ShareAndEarn product={product} />}
          </div>
        </div>

        {/* Description */}
        <div className="max-w-7xl mx-auto px-6 py-10 border-t border-[var(--sand)]">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Description</h2>
            <p className="text-sm text-[var(--muted-brown)] leading-relaxed max-w-2xl">{product.description}</p>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="border-t border-[var(--sand)]">
            <ProductGrid products={related} title="You might also like" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
