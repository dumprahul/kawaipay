"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FilterSidebar, { DEFAULT_FILTERS, type FilterState } from "@/components/FilterSidebar";
import ProductCard from "@/components/ProductCard";
import { type Product } from "@/lib/products";
import { getAllProducts } from "@/lib/productStore";

type SortKey = "relevance" | "price-asc" | "price-desc";

function SearchResults() {
  const params = useSearchParams();
  const query = params.get("q") || "";
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllProducts()
      .then(setAllProducts)
      .finally(() => setLoading(false));
  }, []);

  const base = useMemo(() => {
    if (!query) return allProducts;
    const q = query.toLowerCase();
    return allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }, [query, allProducts]);

  const results = useMemo(() => {
    let list = [...base];
    if (filters.categories.length > 0) {
      list = list.filter((p) => filters.categories.includes(p.category));
    }
    list = list.filter((p) => p.price <= filters.maxPrice);
    if (filters.inStock) list = list.filter((p) => p.inStock);

    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list.sort((a, b) => b.price - a.price);

    return list;
  }, [base, filters, sort]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 flex gap-10">
      <FilterSidebar onFilter={setFilters} activeFilters={filters} />

      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[var(--espresso)]">
              {query ? `Results for "${query}"` : "All Products"}
            </h1>
            <p className="text-sm text-[var(--muted-brown)]">{loading ? "Loading…" : `${results.length} products`}</p>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="text-sm border border-[var(--sand)] rounded-lg px-3 py-2 bg-[var(--ivory)] text-[var(--espresso)] outline-none focus:border-[var(--brown)]"
          >
            <option value="relevance">Sort: Relevance</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>

        {/* Grid */}
        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            {results.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-[var(--muted-brown)]">
            <p className="text-4xl mb-4">🔍</p>
            <p className="font-medium">No products found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense>
          <SearchResults />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
