import PromoBar from "@/components/PromoBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductGrid from "@/components/ProductGrid";
import { getProductsByCategory, CATEGORIES } from "@/lib/products";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const label = CATEGORIES.find((c) => c.toLowerCase() === slug.toLowerCase());
  if (!label) notFound();

  const products = getProductsByCategory(label);

  return (
    <div className="min-h-screen flex flex-col">
      <PromoBar />
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
