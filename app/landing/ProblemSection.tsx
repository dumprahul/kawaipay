const PROBLEMS = [
  { num: "01", title: "Creators wait", body: "Commissions can take weeks or months to settle." },
  { num: "02", title: "Sellers can't see intent", body: "A click doesn't tell you whether a real person actually engaged." },
  { num: "03", title: "Attention has no price", body: "A two-second bounce and eight minutes of genuine attention can look the same." },
];

export default function ProblemSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-16 border-t border-[#E8E3DC]">
      <h2 className="text-[36px] font-bold text-[#1a1a1a] tracking-tight mb-12 leading-tight">
        Affiliate marketing still pays for the click.
      </h2>
      <div className="grid md:grid-cols-3 gap-5">
        {PROBLEMS.map((p) => (
          <div key={p.num} className="bg-white border border-[#E8E3DC] rounded-2xl p-7 space-y-4">
            <span className="text-[12px] font-semibold text-[#C4BAB0] tracking-widest">{p.num}</span>
            <p className="text-[15px] font-semibold text-[#1a1a1a]">{p.title}</p>
            <p className="text-[13px] text-[#777] leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
