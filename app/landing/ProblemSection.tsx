"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import FlipCard from "@/components/ui/FlipCard";
import BlurText from "@/components/ui/BlurText";

const PROBLEMS = [
  {
    num: "01",
    title: "Creators wait weeks",
    subtitle: "The payment problem",
    body: "Commissions sit in escrow for 30–90 days. Cash flow suffers while platforms hold your money.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    stat1: { value: "67", unit: "days", label: "average payout delay" },
    stat2: { value: "$2.8B", unit: "", label: "held in affiliate escrow globally" },
    stat3: { value: "41%", unit: "", label: "of creators quit due to late pay" },
    accent: "#8b6f5c",
    frontBg: "from-[#fdf9f6] to-[#f5ede6]",
    backBg: "from-[#faf4ef] to-[#f0e6dc]",
    topBar: "from-[#c9b8a8] to-[#e8d8cc]",
    tagColor: "bg-[#8b6f5c14] text-[#8b6f5c] border-[#8b6f5c30]",
    statBg: "bg-[#8b6f5c0d] border-[#8b6f5c25]",
    iconBg: "bg-[#8b6f5c12]",
    numColor: "#8b6f5c",
  },
  {
    num: "02",
    title: "Sellers fly blind",
    subtitle: "The intent problem",
    body: "A click tells you nothing. Did someone read the page, watch the video, or just bounce immediately?",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    stat1: { value: "2.3%", unit: "", label: "industry avg click conversion" },
    stat2: { value: "78%", unit: "", label: "of paid clicks bounce in < 10s" },
    stat3: { value: "$500M+", unit: "", label: "wasted on bot traffic yearly" },
    accent: "#4a7a4a",
    frontBg: "from-[#f5faf5] to-[#e8f2e8]",
    backBg: "from-[#f0f8f0] to-[#e2efe2]",
    topBar: "from-[#a8c9a8] to-[#cce4cc]",
    tagColor: "bg-[#4a7a4a14] text-[#4a7a4a] border-[#4a7a4a30]",
    statBg: "bg-[#4a7a4a0d] border-[#4a7a4a25]",
    iconBg: "bg-[#4a7a4a12]",
    numColor: "#4a7a4a",
  },
  {
    num: "03",
    title: "Attention is free",
    subtitle: "The value problem",
    body: "Eight minutes of genuine attention and a two-second bounce look identical in your dashboard.",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    stat1: { value: "0¢", unit: "", label: "paid for 8 min of real attention" },
    stat2: { value: "4.2×", unit: "", label: "higher purchase intent after 5+ min" },
    stat3: { value: "92%", unit: "", label: "of attention data is never captured" },
    accent: "#6a4a9a",
    frontBg: "from-[#faf8fd] to-[#f0eaf8]",
    backBg: "from-[#f5f0fb] to-[#ece4f5]",
    topBar: "from-[#b8a8d8] to-[#d8cce8]",
    tagColor: "bg-[#6a4a9a14] text-[#6a4a9a] border-[#6a4a9a30]",
    statBg: "bg-[#6a4a9a0d] border-[#6a4a9a25]",
    iconBg: "bg-[#6a4a9a12]",
    numColor: "#6a4a9a",
  },
];

type Problem = typeof PROBLEMS[0];

function FrontFace({ p }: { p: Problem }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br ${p.frontBg} flex flex-col overflow-hidden relative`}>
      {/* Coloured top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${p.topBar} shrink-0`} />

      <div className="flex flex-col p-7 flex-1 relative">
        {/* Watermark number */}
        <span className="absolute -right-2 -bottom-3 text-[96px] font-black leading-none select-none pointer-events-none"
          style={{ color: p.accent, opacity: 0.06 }}>
          {p.num}
        </span>

        {/* Tag */}
        <span className={`self-start text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${p.tagColor} mb-auto`}>
          {p.subtitle}
        </span>

        {/* Icon */}
        <div className="mt-auto mb-5">
          <div className={`w-12 h-12 rounded-2xl ${p.iconBg} flex items-center justify-center mb-5`}
            style={{ border: `1px solid ${p.accent}25` }}>
            <svg className="w-6 h-6" fill="none" stroke={p.accent} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={p.icon} />
            </svg>
          </div>

          <h3 className="text-[22px] font-bold text-[#1a1a1a] leading-snug tracking-tight mb-2">{p.title}</h3>
          <p className="text-[13px] text-[#666] leading-relaxed">{p.body}</p>
        </div>

        {/* Flip hint */}
        <div className="flex items-center gap-1.5 mt-5" style={{ color: p.accent }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">See the stats</span>
        </div>
      </div>
    </div>
  );
}

function BackFace({ p }: { p: Problem }) {
  return (
    <div className={`w-full h-full bg-gradient-to-br ${p.backBg} flex flex-col overflow-hidden relative`}>
      {/* Coloured top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${p.topBar} shrink-0`} />

      {/* Decorative circle */}
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${p.accent}18, transparent)` }} />

      <div className="flex flex-col p-7 flex-1">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: p.accent }}>
            By the numbers
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.tagColor}`}>{p.num}</span>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3 flex-1">
          {[p.stat1, p.stat2, p.stat3].map((s, i) => (
            <div key={i} className={`rounded-xl p-4 ${p.statBg} border`}>
              <div className="flex items-baseline gap-1 mb-0.5">
                <span className="text-[26px] font-black tracking-tight leading-none" style={{ color: p.accent }}>
                  {s.value}
                </span>
                {s.unit && <span className="text-[13px] font-semibold" style={{ color: p.accent }}>{s.unit}</span>}
              </div>
              <p className="text-[11px] text-[#777] leading-snug">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Flip back hint */}
        <div className="flex items-center gap-1.5 mt-4" style={{ color: p.accent }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70">Flip back</span>
        </div>
      </div>
    </div>
  );
}

function ProblemFlipCard({ p, index }: { p: Problem; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 52 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-center"
    >
      <FlipCard
        width={340}
        height={400}
        background="transparent"
        shadowColor="#000"
        shadowOpacity={0.35}
        tiltMax={10}
        glareOpacity={0.12}
        front={<FrontFace p={p} />}
        back={<BackFace p={p} />}
        ariaLabel={`Problem ${p.num}: ${p.title}`}
      />
    </motion.div>
  );
}

export default function ProblemSection() {
  const headRef = useRef(null);
  const inView = useInView(headRef, { once: true, margin: "-60px" });

  return (
    <section className="max-w-7xl mx-auto px-6 py-20 border-t border-[#E8E3DC]">
      <div ref={headRef} className="mb-14">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-widest text-[#8b6f5c] mb-3"
        >
          The problem
        </motion.p>
        <BlurText
          text="Affiliate marketing still pays for the click."
          className="text-[38px] font-bold text-[#1a1a1a] tracking-tight leading-tight"
          animateBy="words"
          direction="bottom"
          delay={80}
          stepDuration={0.3}
        />
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-[14px] text-[#888] mt-4"
        >
          Click the cards to see the numbers.
        </motion.p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PROBLEMS.map((p, i) => <ProblemFlipCard key={p.num} p={p} index={i} />)}
      </div>
    </section>
  );
}
