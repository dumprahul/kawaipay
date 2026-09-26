import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--espresso)] text-[var(--sand)] mt-20">
      <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1 space-y-3">
          <p className="font-semibold text-[var(--cream)] text-lg">
            Kawaii<span className="text-[var(--accent-green-light)]">Pay</span>
          </p>
          <p className="text-xs leading-relaxed text-[var(--beige)]">
            Discover products. Share what you love. Get rewarded for genuine attention.
          </p>
        </div>

        {/* Shop */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[var(--cream)]">Shop</p>
          <div className="space-y-2 text-sm">
            <Link href="/search" className="block hover:text-[var(--cream)] transition-colors">Categories</Link>
            <Link href="/search?q=trending" className="block hover:text-[var(--cream)] transition-colors">Trending</Link>
            <Link href="/search?q=new" className="block hover:text-[var(--cream)] transition-colors">New arrivals</Link>
          </div>
        </div>

        {/* Creators */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[var(--cream)]">Creators</p>
          <div className="space-y-2 text-sm">
            <Link href="/creator" className="block hover:text-[var(--cream)] transition-colors">How it works</Link>
            <Link href="/creator/links" className="block hover:text-[var(--cream)] transition-colors">Create affiliate link</Link>
            <Link href="/creator/earnings" className="block hover:text-[var(--cream)] transition-colors">Creator earnings</Link>
          </div>
        </div>

        {/* Trust */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[var(--cream)]">Trust</p>
          <div className="space-y-2 text-sm">
            <p className="text-[var(--beige)]">Verified attention</p>
            <p className="text-[var(--beige)]">Sui settlement</p>
            <p className="text-[var(--beige)]">Public verification</p>
          </div>
        </div>

        {/* Company */}
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-widest font-semibold text-[var(--cream)]">Company</p>
          <div className="space-y-2 text-sm">
            <p className="text-[var(--beige)]">About</p>
            <p className="text-[var(--beige)]">Contact</p>
            <p className="text-[var(--beige)]">Terms</p>
            <p className="text-[var(--beige)]">Privacy</p>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--brown)]/40 px-6 py-4 max-w-7xl mx-auto flex items-center justify-between text-xs text-[var(--beige)]">
        <p>© 2026 KawaiiPay. Powered by Sui.</p>
        <p className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
          Testnet
        </p>
      </div>
    </footer>
  );
}
