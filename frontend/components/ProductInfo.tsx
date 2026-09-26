"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= Math.round(rating) ? "text-[var(--brown)]" : "text-[var(--sand)]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ProductInfo({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-[var(--muted-brown)] font-medium mb-2">
          {product.category}
        </p>
        <h1 className="text-3xl font-bold text-[var(--espresso)] leading-tight">
          {product.name}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <Stars rating={product.rating} />
        <span className="text-sm text-[var(--muted-brown)]">
          {product.rating} · {product.reviewCount} reviews
        </span>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-[var(--espresso)]">${product.price}</span>
        {product.originalPrice && (
          <>
            <span className="text-lg text-[var(--muted-brown)] line-through">${product.originalPrice}</span>
            <span className="text-sm font-medium text-[var(--accent-green)]">
              {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% off
            </span>
          </>
        )}
      </div>

      <p className="text-sm text-[var(--muted-brown)] leading-relaxed">{product.description}</p>

      {/* Quantity */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-[var(--muted-brown)]">Quantity</span>
        <div className="flex items-center border border-[var(--sand)] rounded-lg overflow-hidden">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-[var(--muted-brown)] hover:bg-[var(--ivory)] transition-colors"
          >
            −
          </button>
          <span className="px-4 py-2 text-sm font-medium text-[var(--espresso)] min-w-[2.5rem] text-center">
            {qty}
          </span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="px-3 py-2 text-[var(--muted-brown)] hover:bg-[var(--ivory)] transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          className="flex-1 py-3 rounded-full bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors"
        >
          {added ? "Added ✓" : "Add to cart"}
        </button>
        <button className="flex-1 py-3 rounded-full border border-[var(--espresso)] text-[var(--espresso)] text-sm font-medium hover:bg-[var(--ivory)] transition-colors">
          Buy now
        </button>
      </div>

      {/* Meta */}
      {(product.brand || product.material) && (
        <div className="pt-2 space-y-1.5 text-xs text-[var(--muted-brown)] border-t border-[var(--sand)]">
          {product.brand && <p><span className="font-medium">Brand</span> · {product.brand}</p>}
          {product.material && <p><span className="font-medium">Material</span> · {product.material}</p>}
        </div>
      )}
    </div>
  );
}
