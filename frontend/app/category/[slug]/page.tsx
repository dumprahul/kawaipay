"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import { CATEGORIES, type Product } from "@/lib/products";
import { getAllProducts, getOwnerProducts } from "@/lib/productStore";

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [label, setLabel] = useState<string>("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const matched = CATEGORIES.find((c) => c.toLowerCase() === slug.toLowerCase());
    if (!matched) { setNotFound(true); return; }
    setLabel(matched);

    const all = getAllProducts();
    const ownerIds = new Set(getOwnerProducts().map((p) => p.id));

    const inCategory = all.filter((p) => p.category === matched);
    // Owner-added products appear first
    const sorted = [
      ...inCategory.filter((p) => ownerIds.has(p.id)),
      ...inCategory.filter((p) => !ownerIds.has(p.id)),
    ];
    setProducts(sorted);
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-[var(--espresso)] font-semibold">Category not found</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 pt-10">
          <p className="text-xs uppercase tracking-widest text-[var(--muted-brown)] mb-2">Category</p>
          <h1 className="text-3xl font-bold text-[var(--espresso)]">{label}</h1>
          <p className="text-sm text-[var(--muted-brown)] mt-1">{products.length} products</p>
        </div>
        <ProductGrid products={products} />
      </main>
      <Footer />
    </div>
  );
}
