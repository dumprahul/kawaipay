"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import { PRODUCTS, type Product } from "@/lib/products";
import { getOwnerProducts } from "@/lib/productStore";

export default function ShopPage() {
  const [allProducts, setAllProducts] = useState<Product[]>(PRODUCTS);

  useEffect(() => {
    const ownerProducts = getOwnerProducts();
    if (ownerProducts.length > 0) {
      setAllProducts([...PRODUCTS, ...ownerProducts]);
    }
  }, []);

  const featured = allProducts.filter((p) => p.featured);
  const trending = allProducts.filter((p) => p.trending && !p.featured);
  const rest = allProducts.filter((p) => !p.featured && !p.trending);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-4">
        <ProductGrid products={featured} title="Featured" />
        <div className="border-t border-[var(--sand)]" />
        <ProductGrid products={trending} title="Trending now" />
        <div className="border-t border-[var(--sand)]" />
        <ProductGrid products={rest} title="More to explore" />
      </main>
      <Footer />
    </div>
  );
}
