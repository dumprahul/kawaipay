import Link from "next/link";

export default function FinalCTA() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20 border-t border-[#E8E3DC]">
      <h2 className="text-[42px] font-bold text-[#1a1a1a] tracking-tight mb-4 leading-tight">
        Turn attention into value.
      </h2>
      <p className="text-[15px] text-[#555] max-w-md mb-10 leading-relaxed">
        Discover products, share what you love, and get rewarded for genuine human attention.
      </p>
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-[#1a1a1a] text-white text-[14px] font-semibold shadow-sm hover:bg-[#333] hover:-translate-y-px transition-all"
      >
        Get Started
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </section>
  );
}
