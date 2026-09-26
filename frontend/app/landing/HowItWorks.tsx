"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import BlurText from "@/components/ui/BlurText";

const STEPS = [
  {
    num: "01",
    title: "Discover",
    body: "A shopper opens a shared product link from a creator they trust.",
    icon: "M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z",
  },
  {
    num: "02",
    title: "Engage",
    body: "Real interaction — reading, scrolling, watching — creates measurable attention signals.",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  },
  {
    num: "03",
    title: "Verify",
    body: "Behavioral signals separate genuine humans from bots and bounces instantly.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    num: "04",
    title: "Reward",
    body: "Every 5s of verified attention triggers a micro-reward drawn from the product's escrow.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    num: "05",
    title: "Settle",
    body: "Rewards land in your wallet on Sui instantly — no wait, no platform cut.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
];

export default function HowItWorks() {
  const headRef = useRef(null);
  const inView = useInView(headRef, { once: true, margin: "-60px" });

  return (
    <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20 border-t border-[#E8E3DC]">
      <div ref={headRef} className="mb-12 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-widest text-[#8b6f5c] mb-3"
        >
          How it works
        </motion.p>
        <div className="flex justify-center">
          <BlurText
            text="From clicks to verified attention."
            className="text-[38px] font-bold text-[#1a1a1a] tracking-tight leading-tight justify-center"
            animateBy="words"
            direction="bottom"
            delay={90}
            stepDuration={0.3}
          />
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} index={i} last={i === STEPS.length - 1} />
        ))}
      </div>
    </section>
  );
}

function StepCard({
  step,
  index,
  last,
}: {
  step: typeof STEPS[0];
  index: number;
  last: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
      className="relative group"
    >
      {/* Connector line — hidden on last */}
      {!last && (
        <div className="hidden md:block absolute top-[38px] left-[calc(50%+22px)] right-[-50%] h-px bg-gradient-to-r from-[#c9b8a8] to-transparent z-0 pointer-events-none" />
      )}

      <div className="relative z-10 bg-white border border-[#E8E3DC] rounded-2xl p-5 h-full
                      hover:-translate-y-1 hover:shadow-[0_8px_28px_-6px_rgba(139,111,92,0.13)]
                      hover:border-[#c9b8a8] transition-all duration-300 overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#c9b8a8] to-[#e8d8cc]" />

        {/* Number + icon row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold text-[#8b6f5c] bg-[#8b6f5c10] border border-[#8b6f5c20] rounded-full px-2.5 py-0.5 tracking-widest">
            {step.num}
          </span>
          <div className="w-8 h-8 rounded-xl bg-[#8b6f5c0c] border border-[#8b6f5c18] flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="none" stroke="#8b6f5c" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
            </svg>
          </div>
        </div>

        <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-2 tracking-tight">{step.title}</h3>
        <p className="text-[12px] text-[#888] leading-relaxed">{step.body}</p>

        {/* Watermark number */}
        <span className="absolute -right-1 -bottom-3 text-[64px] font-black leading-none select-none pointer-events-none"
          style={{ color: "#8b6f5c", opacity: 0.04 }}>
          {step.num}
        </span>
      </div>
    </motion.div>
  );
}
