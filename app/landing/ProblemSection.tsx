"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SpotlightCard from "@/components/ui/SpotlightCard";
import BlurText from "@/components/ui/BlurText";

const PROBLEMS = [
  {
    num: "01",
    title: "Creators wait weeks",
    body: "Commissions sit in escrow for 30–90 days. Cash flow suffers while platforms hold funds.",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    spotlight: "rgba(139, 111, 92, 0.35)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    topGradient: "from-[#c9b8a8] to-[#e8e3dc]",
    iconBg: "bg-[#f0ece7]",
    iconColor: "text-[#8b6f5c]",
  },
  {
    num: "02",
    title: "Sellers can't see intent",
    body: "A click tells you nothing. Did someone actually read the page, watch the video, or care at all?",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    spotlight: "rgba(90, 122, 90, 0.35)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    topGradient: "from-[#b8c9b8] to-[#dce8dc]",
    iconBg: "bg-[#eaf2ea]",
    iconColor: "text-[#5a7a5a]",
  },
  {
    num: "03",
    title: "Attention has no price",
    body: "A two-second bounce and eight minutes of genuine reading look identical in your analytics.",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    spotlight: "rgba(100, 90, 139, 0.35)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    topGradient: "from-[#c0b8d8] to-[#e0dce8]",
    iconBg: "bg-[#efecf7]",
    iconColor: "text-[#6a5a9a]",
  },
];

function ProblemCard({ p, index }: { p: typeof PROBLEMS[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 52 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <SpotlightCard
        spotlightColor={p.spotlight}
        className="group h-full rounded-2xl bg-white border border-[#E8E3DC] overflow-hidden flex flex-col
                   hover:-translate-y-1 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.10)] transition-all duration-300"
      >
        {/* Coloured top bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${p.topGradient}`} />

        <div className="p-7 flex flex-col gap-6 flex-1 relative overflow-hidden">
          {/* Watermark number */}
          <span className="absolute -right-3 -bottom-4 text-[96px] font-black text-[#1a1a1a] opacity-[0.035] select-none leading-none pointer-events-none">
            {p.num}
          </span>

          {/* Icon + number row */}
          <div className="flex items-center justify-between">
            <div className={`w-11 h-11 rounded-xl ${p.iconBg} flex items-center justify-center`}>
              <svg className={`w-5 h-5 ${p.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={p.icon} />
              </svg>
            </div>
            <span className={`text-[11px] font-bold tracking-widest tabular-nums ${p.iconColor} opacity-50`}>{p.num}</span>
          </div>

          {/* Text */}
          <div className="space-y-2 flex-1 relative z-10">
            <p className="text-[16px] font-bold text-[#1a1a1a] leading-snug">{p.title}</p>
            <p className="text-[13px] text-[#888] leading-relaxed">{p.body}</p>
          </div>

          {/* Arrow hint on hover */}
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 relative z-10">
            <span className={`text-[11px] font-semibold ${p.iconColor}`}>See how we solve this</span>
            <svg className={`w-3 h-3 ${p.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </div>
      </SpotlightCard>
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
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {PROBLEMS.map((p, i) => <ProblemCard key={p.num} p={p} index={i} />)}
      </div>
    </section>
  );
}
