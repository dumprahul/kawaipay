"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import { type Product } from "@/lib/products";
import { getAllProducts } from "@/lib/productStore";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 pt-4">
        {loading ? (
          <p className="text-center text-sm text-[var(--muted-brown)] py-20">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-brown)] py-20">No products listed yet.</p>
        ) : (
          <ProductGrid products={products} title="All products" />
        )}
      </main>
      <Footer />
    </div>
  );
}
