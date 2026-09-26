import Link from "next/link";

export default function Hero() {
  return (
    <section
      className="relative max-w-full overflow-hidden"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1535397318751-32521c97e1c3?q=80&w=2573&auto=format&fit=crop')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay for text contrast */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative max-w-7xl mx-auto px-6 py-16 flex flex-col md:flex-row items-center gap-12">
      {/* Text */}
      <div className="flex-1 space-y-6">
        <p className="text-xs uppercase tracking-widest text-[var(--accent-green-light)] font-semibold">
          Verified attention economy
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Discover products<br />
          <span className="text-[var(--sand)]">worth your attention.</span>
        </h1>
        <p className="text-base text-[var(--ivory)] max-w-md leading-relaxed opacity-90">
          Shop products you love. Share them with your audience. Get rewarded
          for genuine human attention — settled instantly on Sui.
        </p>
        <div className="flex items-center gap-4 pt-2">
          <Link
            href="/shop"
            className="px-6 py-3 rounded-full bg-white text-[var(--espresso)] text-sm font-medium hover:bg-[var(--ivory)] transition-colors"
          >
            Explore products
          </Link>
          <Link
            href="/creator"
            className="px-6 py-3 rounded-full border border-white/70 text-white text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Earn with Kawaii
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="flex items-center gap-6 pt-4">
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span className="text-[var(--accent-green-light)]">✓</span>
            Human verified
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span>◇</span>
            Settled on Sui
          </div>
          <div className="flex items-center gap-2 text-xs text-white/70">
            <span>◉</span>
            Real-time rewards
          </div>
        </div>
      </div>

      </div>
    </section>
  );
}
