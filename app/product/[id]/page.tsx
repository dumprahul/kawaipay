import Link from "next/link";
import PromoBar from "@/components/PromoBar";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductGallery from "@/components/ProductGallery";
import ProductInfo from "@/components/ProductInfo";
import ShareAndEarn from "@/components/ShareAndEarn";
import ProductGrid from "@/components/ProductGrid";
import { getProduct, PRODUCTS } from "@/lib/products";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  const related = PRODUCTS.filter(
    (p) => p.category === product.category && p.id !== product.id
  ).slice(0, 4);

  return (
    <div className="min-h-screen flex flex-col">
      <PromoBar />
      <Navbar />
      <main className="flex-1">
        {/* Breadcrumbs */}
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <nav className="flex items-center gap-2 text-xs text-[var(--muted-brown)]">
            <Link href="/shop" className="hover:text-[var(--espresso)] transition-colors">Shop</Link>
            <span>·</span>
            <Link href={`/category/${product.category.toLowerCase()}`} className="hover:text-[var(--espresso)] transition-colors">
              {product.category}
            </Link>
            <span>·</span>
            <span className="text-[var(--espresso)]">{product.name}</span>
          </nav>
        </div>

        {/* Main product section */}
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-14">
          <ProductGallery product={product} />
          <div className="space-y-8">
            <ProductInfo product={product} />
            {product.affiliateEligible && <ShareAndEarn product={product} />}
          </div>
        </div>

        {/* Product tabs */}
        <div className="max-w-7xl mx-auto px-6 py-10 border-t border-[var(--sand)]">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Description</h2>
            <p className="text-sm text-[var(--muted-brown)] leading-relaxed max-w-2xl">{product.description}</p>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="border-t border-[var(--sand)]">
            <ProductGrid products={related} title="You might also like" />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
