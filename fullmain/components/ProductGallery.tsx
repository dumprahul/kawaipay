"use client";

import { useState } from "react";
import type { Product } from "@/lib/products";

export default function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[var(--ivory)] flex items-center justify-center">
        <img
          src={product.images[active]}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      {/* Thumbnails */}
      <div className="flex gap-3">
        {product.images.map((url, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-16 h-16 rounded-xl overflow-hidden bg-[var(--ivory)] border-2 transition-all flex items-center justify-center ${
              active === i
                ? "border-[var(--espresso)]"
                : "border-transparent hover:border-[var(--beige)]"
            }`}
          >
            <img src={url} alt={`${product.name} ${i + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
