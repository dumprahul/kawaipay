import Link from "next/link";
import { CATEGORIES } from "@/lib/products";

const CategoryIcon = ({ category }: { category: string }) => {
  const cls = "w-6 h-6 stroke-current fill-none stroke-[1.5]";
  switch (category) {
    case "Fashion":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 3H7L3 7l2 1 1-1v13h12V7l1 1 2-1-4-4h-2s0 2-3 2-3-2-3-2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Beauty":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2c0 0-1 3-4 4 0 3 1.5 5 4 6 2.5-1 4-3 4-6-3-1-4-4-4-4z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 12v10M9 22h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Electronics":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Lifestyle":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="6" y1="2" x2="6" y2="4" strokeLinecap="round" />
          <line x1="10" y1="2" x2="10" y2="4" strokeLinecap="round" />
          <line x1="14" y1="2" x2="14" y2="4" strokeLinecap="round" />
        </svg>
      );
    case "Home":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Wellness":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Books":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "Trending":
      return (
        <svg className={cls} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

export default function CategoryNavigation() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-brown)]">
          Browse by category
        </h2>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/category/${cat.toLowerCase()}`}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--ivory)] border border-[var(--sand)] hover:border-[var(--brown)] hover:bg-[var(--cream)] transition-all group text-[var(--muted-brown)] hover:text-[var(--espresso)]"
          >
            <CategoryIcon category={cat} />
            <span className="text-xs font-medium transition-colors text-center">
              {cat}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
