import Link from "next/link";

export default function LandingFooter() {
  return (
    <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-[#E8E3DC] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
      <div>
        <p className="font-semibold text-[#1a1a1a] text-[14px]">
          Kawaii<span style={{ color: "#5a7a5a" }}>Pay</span>
        </p>
        <p className="text-[12px] text-[#999] mt-1">Verified attention for the creator economy.</p>
      </div>
      <div className="flex items-center gap-7 flex-wrap text-[12px] text-[#999]">
        <Link href="/shop" className="hover:text-[#1a1a1a] transition-colors">Shop</Link>
        <a href="#how-it-works" className="hover:text-[#1a1a1a] transition-colors">How It Works</a>
        <a href="#creators" className="hover:text-[#1a1a1a] transition-colors">For Creators</a>
        <a href="#" className="hover:text-[#1a1a1a] transition-colors">Docs</a>
        <a href="#" className="hover:text-[#1a1a1a] transition-colors">Privacy</a>
        <a href="#" className="hover:text-[#1a1a1a] transition-colors">Terms</a>
      </div>
    </footer>
  );
}
