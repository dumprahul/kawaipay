import Link from "next/link";

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-[var(--ivory)] via-[var(--cream)] to-[var(--sand)]">
      <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col items-center text-center gap-8">

        <p className="text-xs uppercase tracking-widest text-[var(--accent-green)] font-semibold">
          Verified attention economy
        </p>
        <h1 className="text-5xl md:text-6xl font-bold text-[var(--espresso)] leading-tight max-w-2xl">
          Discover products<br />
          <span className="text-[var(--brown)]">worth your attention.</span>
        </h1>
        <p className="text-base text-[var(--muted-brown)] max-w-lg leading-relaxed">
          Shop products you love. Share them with your audience. Get rewarded
          for genuine human attention — settled instantly on Sui.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/shop"
            className="px-7 py-3 rounded-full bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors"
          >
            Explore products
          </Link>
          <Link
            href="/creator"
            className="px-7 py-3 rounded-full border border-[var(--brown)] text-[var(--brown)] text-sm font-medium hover:bg-[var(--ivory)] transition-colors"
          >
            Earn with Kawaii
          </Link>
        </div>

        <div className="flex items-center gap-8 pt-2">
          <div className="flex items-center gap-2 text-xs text-[var(--muted-brown)]">
            <span className="text-[var(--accent-green)]">✓</span>
            Human verified
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-brown)]">
            <span>◇</span>
            Settled on Sui
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted-brown)]">
            <span>◉</span>
            Real-time rewards
          </div>
        </div>

      </div>
    </section>
  );
}
