export default function CreatorSection() {
  return (
    <section id="creators" className="max-w-7xl mx-auto px-6 py-16 border-t border-[#E8E3DC]">
      <div className="flex flex-col md:flex-row items-start gap-14">
        <div className="flex-1 space-y-5">
          <h2 className="text-[36px] font-bold text-[#1a1a1a] tracking-tight leading-tight">
            Your audience is worth<br />more than a click.
          </h2>
          <p className="text-[15px] text-[#555] leading-relaxed max-w-sm">
            Share products you genuinely believe in and earn from verified human attention.
          </p>
        </div>

        <div className="flex-1 bg-white border border-[#E8E3DC] rounded-2xl p-6 space-y-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#999]">Kawaii Pay Link</p>
          <div className="flex items-center gap-3 bg-[#F5F1EC] border border-[#E8E3DC] rounded-xl px-4 py-3">
            <span className="text-[12px] text-[#555] truncate flex-1 font-mono">
              kawaii.pay/p/solace-headphones/ov…
            </span>
            <button className="shrink-0 text-[11px] font-semibold text-[#1a1a1a] border border-[#D8D3CC] rounded-lg px-3 py-1.5 bg-white hover:bg-[#f5f1ec] transition-colors">
              Copy Link
            </button>
          </div>
          <div className="h-px bg-[#EDE8E2]" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#999] mb-1">Verified attention</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5a7a5a]" />
                <span className="text-[12px] font-semibold text-[#5a7a5a]">Active</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-[#999] mb-1">Creator reward</p>
              <p className="text-[14px] font-bold text-[#1a1a1a]">+0.002 SUI <span className="text-[11px] font-normal text-[#999]">/ 5 sec</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
