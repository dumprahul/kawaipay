"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/products";
import GenerateLinkModal from "@/components/GenerateLinkModal";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i <= Math.round(rating) ? "text-[var(--brown)]" : "text-[var(--sand)]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  function handleClick(e: React.MouseEvent) {
    // A signed-in creator clicking an affiliate-eligible product goes straight to
    // generating their link instead of the regular buyer product page — nothing is
    // "shared" until that succeeds, so this is the only way in for a creator here.
    if (!product.affiliateEligible) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("kawaii_role") !== "creator") return;
    e.preventDefault();
    setLinkModalOpen(true);
  }

  return (
    <>
    <Link href={`/product/${product.id}`} className="group block" onClick={handleClick}>
      {/* Image container */}
      <div className="relative rounded-xl overflow-hidden aspect-square mb-3 bg-[var(--ivory)] transition-transform duration-300 group-hover:-translate-y-1">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.originalPrice && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--espresso)] text-[var(--cream)]">
              Sale
            </span>
          )}
          {product.trending && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--accent-green)] text-white">
              Trending
            </span>
          )}
        </div>

        {/* Affiliate badge */}
        {product.affiliateEligible && (
          <div className="absolute bottom-3 left-3">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/80 text-[var(--accent-green)] border border-[var(--accent-green)]/20">
              ◉ Earn with this
            </span>
          </div>
        )}

        {/* Wishlist */}
        <button
          onClick={(e) => {
            e.preventDefault();
            setWishlisted((w) => !w);
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors"
          aria-label="Wishlist"
        >
          <svg
            className={`w-4 h-4 transition-colors ${wishlisted ? "text-red-400 fill-current" : "text-[var(--muted-brown)]"}`}
            fill={wishlisted ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 20.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-[var(--muted-brown)] font-medium">
          {product.category}
        </p>
        <h3 className="text-sm font-semibold text-[var(--espresso)] group-hover:text-[var(--brown)] transition-colors leading-snug">
          {product.name}
        </h3>
        <div className="flex items-center gap-1.5">
          <Stars rating={product.rating} />
          <span className="text-xs text-[var(--muted-brown)]">
            {product.rating} ({product.reviewCount})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[var(--espresso)]">
            ${product.price}
          </span>
          {product.originalPrice && (
            <span className="text-xs text-[var(--muted-brown)] line-through">
              ${product.originalPrice}
            </span>
          )}
        </div>
      </div>
    </Link>
    {linkModalOpen && (
      <GenerateLinkModal product={product} onClose={() => setLinkModalOpen(false)} />
    )}
    </>
  );
}
