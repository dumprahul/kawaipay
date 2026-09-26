"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/products";

interface FilterSidebarProps {
  onFilter: (filters: FilterState) => void;
  activeFilters: FilterState;
}

export interface FilterState {
  categories: string[];
  minPrice: number;
  maxPrice: number;
  minRating: number;
  inStock: boolean;
  onSale: boolean;
  trending: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  categories: [],
  minPrice: 0,
  maxPrice: 500,
  minRating: 0,
  inStock: false,
  onSale: false,
  trending: false,
};

export default function FilterSidebar({ onFilter, activeFilters }: FilterSidebarProps) {
  const [filters, setFilters] = useState<FilterState>(activeFilters);

  function update(patch: Partial<FilterState>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    onFilter(next);
  }

  function toggleCategory(cat: string) {
    const cats = filters.categories.includes(cat)
      ? filters.categories.filter((c) => c !== cat)
      : [...filters.categories, cat];
    update({ categories: cats });
  }

  return (
    <aside className="w-56 shrink-0 space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-[var(--muted-brown)] font-semibold mb-3">
          Category
        </h3>
        <div className="space-y-2">
          {CATEGORIES.filter((c) => c !== "Trending").map((cat) => (
            <label key={cat} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.categories.includes(cat)}
                onChange={() => toggleCategory(cat)}
                className="accent-[var(--espresso)] w-3.5 h-3.5"
              />
              <span className="text-sm text-[var(--muted-brown)] group-hover:text-[var(--espresso)] transition-colors">
                {cat}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-[var(--sand)]" />

      {/* Price */}
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-[var(--muted-brown)] font-semibold mb-3">
          Price
        </h3>
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={filters.maxPrice}
          onChange={(e) => update({ maxPrice: Number(e.target.value) })}
          className="w-full accent-[var(--espresso)]"
        />
        <div className="flex justify-between text-xs text-[var(--muted-brown)] mt-1">
          <span>$0</span>
          <span>Up to ${filters.maxPrice}</span>
        </div>
      </div>

      <div className="h-px bg-[var(--sand)]" />

      {/* Rating */}
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-[var(--muted-brown)] font-semibold mb-3">
          Rating
        </h3>
        <div className="space-y-2">
          {[4, 3, 2].map((r) => (
            <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="radio"
                name="rating"
                checked={filters.minRating === r}
                onChange={() => update({ minRating: filters.minRating === r ? 0 : r })}
                className="accent-[var(--espresso)] w-3.5 h-3.5"
              />
              <span className="text-sm text-[var(--muted-brown)] group-hover:text-[var(--espresso)] transition-colors">
                {r}★ & above
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-[var(--sand)]" />

      {/* Availability & Offers */}
      <div>
        <h3 className="text-[11px] uppercase tracking-widest text-[var(--muted-brown)] font-semibold mb-3">
          Offers
        </h3>
        <div className="space-y-2">
          {[
            { key: "inStock", label: "In stock" },
            { key: "onSale", label: "On sale" },
            { key: "trending", label: "Trending" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters[key as keyof FilterState] as boolean}
                onChange={(e) => update({ [key]: e.target.checked })}
                className="accent-[var(--espresso)] w-3.5 h-3.5"
              />
              <span className="text-sm text-[var(--muted-brown)] group-hover:text-[var(--espresso)] transition-colors">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
