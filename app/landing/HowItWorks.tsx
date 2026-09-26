const STEPS = [
  { title: "Discover", body: "A shopper opens a shared product link.", icon: "M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" },
  { title: "Engage", body: "Genuine interaction creates measurable attention.", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
  { title: "Verify", body: "Behavioral signals evaluate whether the session appears human.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { title: "Reward", body: "Eligible attention generates creator rewards.", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { title: "Settle", body: "Rewards are settled through Sui.", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-16 border-t border-[#E8E3DC]">
      <h2 className="text-[36px] font-bold text-[#1a1a1a] tracking-tight mb-12 leading-tight">
        From clicks to verified attention.
      </h2>
      <div className="grid md:grid-cols-5 gap-4">
        {STEPS.map((step) => (
          <div key={step.title} className="bg-white border border-[#E8E3DC] rounded-2xl p-5 space-y-3">
            <div className="w-9 h-9 rounded-xl bg-[#F5F1EC] border border-[#E8E3DC] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
              </svg>
            </div>
            <p className="text-[13px] font-semibold text-[#1a1a1a]">{step.title}</p>
            <p className="text-[12px] text-[#888] leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
