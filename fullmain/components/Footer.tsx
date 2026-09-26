import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--sand)] mt-20">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">

        {/* Brand */}
        <div className="space-y-1">
          <p className="font-semibold text-[var(--espresso)] text-[14px]">
            Kawaii<span className="text-[var(--accent-green)]">Pay</span>
          </p>
          <p className="text-[12px] text-[#999]">Verified attention for the creator economy.</p>
        </div>

        {/* Links */}
        <div className="flex items-center gap-7 flex-wrap text-[12px] text-[#999]">
          <Link href="/shop" className="hover:text-[var(--espresso)] transition-colors">Shop</Link>
          <Link href="/search" className="hover:text-[var(--espresso)] transition-colors">Categories</Link>
          <Link href="/search?q=trending" className="hover:text-[var(--espresso)] transition-colors">Trending</Link>
          <span className="text-[#ccc]">|</span>
          <span className="text-[#bbb]">Privacy</span>
          <span className="text-[#bbb]">Terms</span>
        </div>

        {/* Right — powered by */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#bbb]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
          Powered by Sui · Testnet
        </div>
      </div>
    </footer>
  );
}
