"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import BlurText from "@/components/ui/BlurText";

const STEPS = [
  {
    num: "01",
    title: "Discover",
    body: "A shopper opens a shared product link from a creator they trust.",
  },
  {
    num: "02",
    title: "Engage",
    body: "Real interaction — reading, scrolling, watching — creates measurable attention signals.",
  },
  {
    num: "03",
    title: "Verify",
    body: "Behavioral signals separate genuine humans from bots and bounces instantly.",
  },
  {
    num: "04",
    title: "Reward",
    body: "Every 5s of verified attention triggers a micro-reward drawn from the product's escrow.",
  },
  {
    num: "05",
    title: "Settle",
    body: "Rewards land in your wallet on Sui instantly — no wait, no platform cut.",
  },
];

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="group relative bg-white border border-[#E8E3DC] rounded-2xl p-6 overflow-hidden
                 hover:-translate-y-1 hover:shadow-[0_12px_36px_-8px_rgba(139,111,92,0.15)]
                 hover:border-[#c9b8a8] transition-all duration-300"
    >
      {/* Large watermark number */}
      <span
        className="absolute -right-2 -bottom-4 text-[88px] font-black leading-none select-none pointer-events-none transition-opacity duration-300 opacity-[0.04] group-hover:opacity-[0.07]"
        style={{ color: "#8b6f5c" }}
      >
        {step.num}
      </span>

      {/* Step pill */}
      <span className="inline-block text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-[#8b6f5c14] text-[#8b6f5c] border-[#8b6f5c30] mb-4">
        Step {step.num}
      </span>

      <h3 className="text-[17px] font-bold text-[#1a1a1a] mb-2 tracking-tight">{step.title}</h3>
      <p className="text-[13px] text-[#888] leading-relaxed">{step.body}</p>

      {/* Connector arrow — hidden on last card */}
      {index < STEPS.length - 1 && (
        <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10
                        w-7 h-7 rounded-full bg-white border border-[#E8E3DC] items-center justify-center
                        group-hover:border-[#c9b8a8] transition-colors duration-300">
          <svg className="w-3 h-3 text-[#8b6f5c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </motion.div>
  );
}

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

      {/* Desktop: 5-column grid */}
      <div className="hidden md:grid md:grid-cols-5 gap-4">
        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} index={i} />
        ))}
      </div>

      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-3 md:hidden">
        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}
