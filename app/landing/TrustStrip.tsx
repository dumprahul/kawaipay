export default function TrustStrip() {
  const labels = ["CREATOR ECONOMY", "COMMERCE", "VERIFIED ATTENTION", "SUI", "BUILDERS"];
  return (
    <section className="max-w-7xl mx-auto px-6 py-12 border-t border-[#E8E3DC]">
      <p className="text-[13px] font-semibold text-[#1a1a1a] mb-1">
        Built for creators who value real attention.
      </p>
      <p className="text-[13px] text-[#888] mb-8 max-w-lg leading-relaxed">
        From product discovery to creator rewards, Kawaii Pay connects genuine engagement with transparent, instant settlement.
      </p>
      <div className="flex items-center gap-10 flex-wrap">
        {labels.map((l) => (
          <span key={l} className="text-[11px] font-semibold tracking-[0.12em] text-[#BFB8AF]">{l}</span>
        ))}
      </div>
    </section>
  );
}
