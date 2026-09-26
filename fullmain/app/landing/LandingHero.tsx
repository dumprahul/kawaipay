import Link from "next/link";

function HeroVisual() {
  return (
    <div className="relative w-full" style={{ maxWidth: 520 }}>
      {/* Big main card */}
      <div className="rounded-3xl overflow-hidden border border-[#E0DAD2] shadow-xl bg-white">
        <div className="relative" style={{ height: 380 }}>
          <img
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80"
            alt="Products"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Bottom product row inside card */}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[#1a1a1a]">Minimal Linen Collection</p>
            <p className="text-[11px] text-[#888] mt-0.5">Creator reward</p>
          </div>
          <span className="text-[15px] font-bold text-[#1a1a1a]">$189</span>
        </div>
      </div>

      {/* Floating top-left — attention verified */}
      <div className="absolute top-4 -left-6 bg-white border border-[#E0DAD2] rounded-2xl px-4 py-3 shadow-md">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1.5">Human Attention</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-[#1a1a1a] tabular-nums">01:42</span>
          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#5a7a5a]">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Verified
          </span>
        </div>
      </div>

      {/* Floating bottom-left — settled on Sui */}
      <div className="absolute bottom-20 -left-6 bg-white border border-[#E0DAD2] rounded-xl px-3 py-2.5 shadow-sm">
        <p className="text-[10px] text-[#999]">Settled on</p>
        <p className="text-[12px] font-semibold text-[#1a1a1a]">Sui Network</p>
      </div>

      {/* Floating bottom-right — reward */}
      <div className="absolute -bottom-4 -right-4 bg-white border border-[#E0DAD2] rounded-2xl px-5 py-4 shadow-lg">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#999] mb-1">Creator Reward</p>
        <p className="text-2xl font-bold text-[#1a1a1a]">+0.024 <span className="text-[#5a7a5a]">SUI</span></p>
      </div>
    </div>
  );
}

export default function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle abstract ribbon shapes — behind everything */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 1400 700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M900 -100 Q1150 100 980 380 Q820 620 1100 780" stroke="#DCCFBF" strokeWidth="140" strokeLinecap="round" fill="none" opacity="0.4"/>
        <path d="M820 -60 Q1080 120 900 360 Q720 580 1020 740" stroke="#E8DDD0" strokeWidth="90" strokeLinecap="round" fill="none" opacity="0.3"/>
        <path d="M50 600 Q-50 380 120 200" stroke="#E0D8CE" strokeWidth="70" strokeLinecap="round" fill="none" opacity="0.2"/>
      </svg>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-16">

        {/* Left text — takes ~50% */}
        <div className="flex-1 space-y-8">
          <h1
            className="font-bold text-[#1a1a1a] leading-[1.0] tracking-[-0.03em]"
            style={{ fontSize: "clamp(52px, 5.5vw, 72px)" }}
          >
            Earn From Every<br />
            Second of Real<br />
            Attention.
          </h1>
          <p className="text-[17px] text-[#555] leading-relaxed max-w-[400px]">
            Kawaii Pay turns genuine product attention into instant creator rewards — verified by behavior and settled on Sui.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-[#1a1a1a] text-white text-[14px] font-semibold shadow-sm hover:bg-[#333] hover:-translate-y-px transition-all"
            >
              Get Started
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#666] hover:text-[#1a1a1a] transition-colors"
            >
              How it works
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
              </svg>
            </a>
          </div>
        </div>

        {/* Right visual */}
        <div className="flex-1 flex justify-end items-center py-10 pr-4">
          <HeroVisual />
        </div>

      </div>
    </section>
  );
}
