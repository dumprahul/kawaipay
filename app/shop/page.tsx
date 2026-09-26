import PromoBar from "@/components/PromoBar";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import CategoryNavigation from "@/components/CategoryNavigation";
import ProductGrid from "@/components/ProductGrid";
import Footer from "@/components/Footer";
import { PRODUCTS } from "@/lib/products";

export default function ShopPage() {
  // Each section gets a distinct slice — no product repeats across rows
  const featured = PRODUCTS.filter((p) => p.featured);
  const trending = PRODUCTS.filter((p) => p.trending && !p.featured);
  const rest = PRODUCTS.filter((p) => !p.featured && !p.trending);

  return (
    <div className="min-h-screen flex flex-col">
      <PromoBar />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <div className="border-t border-[var(--sand)]" />
        <CategoryNavigation />
        <div className="border-t border-[var(--sand)]" />
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
