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
    spotlight: "rgba(139, 111, 92, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
  },
  {
    num: "02",
    title: "Sellers can't see intent",
    body: "A click tells you nothing. Did someone actually read the page, watch the video, or care at all?",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    spotlight: "rgba(90, 122, 90, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
  },
  {
    num: "03",
    title: "Attention has no price",
    body: "A two-second bounce and eight minutes of genuine reading look identical in your analytics dashboard.",
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    spotlight: "rgba(90, 90, 139, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
  },
];

function ProblemCard({ p, index }: { p: typeof PROBLEMS[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 48 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay: index * 0.14, ease: [0.22, 1, 0.36, 1] }}
    >
      <SpotlightCard
        spotlightColor={p.spotlight}
        className="h-full rounded-2xl border border-[#E8E3DC] bg-white p-7 flex flex-col gap-5"
      >
        <div className="flex items-start justify-between">
          <div className="w-11 h-11 rounded-xl bg-[#F5F1EC] border border-[#E8E3DC] flex items-center justify-center">
            <svg className="w-5 h-5 text-[#8b6f5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={p.icon} />
            </svg>
          </div>
          <span className="text-[11px] font-semibold text-[#C4BAB0] tracking-widest tabular-nums">{p.num}</span>
        </div>

        <div className="space-y-2 flex-1">
          <p className="text-[15px] font-bold text-[#1a1a1a] leading-snug">{p.title}</p>
          <p className="text-[13px] text-[#777] leading-relaxed">{p.body}</p>
        </div>

        {/* Subtle bottom rule */}
        <div className="h-px bg-gradient-to-r from-[#E8E3DC] via-[#c9b8a8] to-transparent" />
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
