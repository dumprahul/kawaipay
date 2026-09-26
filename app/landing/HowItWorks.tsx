"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const STEPS = [
  {
    title: "Discover",
    body: "A shopper opens a shared product link from a creator they trust.",
    icon: "M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z",
    accent: "#8b6f5c",
    bg: "from-[#c9b8a8] to-[#e8e3dc]",
  },
  {
    title: "Engage",
    body: "Real interaction — reading, watching, scrolling — creates measurable attention signals.",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    accent: "#6b8c6b",
    bg: "from-[#b8c9b8] to-[#dce8dc]",
  },
  {
    title: "Verify",
    body: "Behavioral signals separate genuine human sessions from bots and bounces.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    accent: "#5a7a8a",
    bg: "from-[#b8c4cc] to-[#dce3e8]",
  },
  {
    title: "Reward",
    body: "Every 5 seconds of verified attention triggers a micro-reward drawn from escrow.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    accent: "#8b7a5c",
    bg: "from-[#c9c0a8] to-[#e8e0dc]",
  },
  {
    title: "Settle",
    body: "Rewards are settled instantly on Sui — no wait, no intermediary, no platform cut.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    accent: "#7a5c8b",
    bg: "from-[#c0b0cc] to-[#e0dce8]",
  },
];

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const isEven = index % 2 === 0;

  return (
    <div ref={ref} className="relative grid grid-cols-[1fr_48px_1fr] items-start gap-0">
      {/* Left slot */}
      <div className={`pr-6 pb-10 ${isEven ? "flex justify-end" : ""}`}>
        {isEven && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-xs bg-white rounded-2xl p-5 border border-[#E8E3DC] shadow-sm"
          >
            <CardContent step={step} />
          </motion.div>
        )}
      </div>

      {/* Centre dot + line */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.4, delay: 0.05, type: "spring", stiffness: 300 }}
          className={`w-10 h-10 rounded-full bg-gradient-to-br ${step.bg} flex items-center justify-center border-2 border-white shadow-md z-10 shrink-0`}
        >
          <svg className="w-4 h-4" fill="none" stroke={step.accent} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={step.icon} />
          </svg>
        </motion.div>
        {index < STEPS.length - 1 && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            style={{ originY: 0 }}
            className="w-px flex-1 min-h-[60px] bg-gradient-to-b from-[#D8D3CC] to-transparent"
          />
        )}
      </div>

      {/* Right slot */}
      <div className={`pl-6 pb-10 ${!isEven ? "" : ""}`}>
        {!isEven && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-xs bg-white rounded-2xl p-5 border border-[#E8E3DC] shadow-sm"
          >
            <CardContent step={step} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CardContent({ step }: { step: typeof STEPS[0] }) {
  return (
    <div className="space-y-2">
      <p className="text-[14px] font-bold text-[#1a1a1a]">{step.title}</p>
      <p className="text-[12px] text-[#777] leading-relaxed">{step.body}</p>
    </div>
  );
}

function MobileStep({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex gap-4 bg-white border border-[#E8E3DC] rounded-2xl p-4"
    >
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${step.bg} flex items-center justify-center shrink-0`}>
        <svg className="w-4 h-4" fill="none" stroke={step.accent} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={step.icon} />
        </svg>
      </div>
      <div>
        <p className="text-[13px] font-bold text-[#1a1a1a]">{step.title}</p>
        <p className="text-[12px] text-[#777] leading-relaxed mt-0.5">{step.body}</p>
      </div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const headRef = useRef(null);
  const headInView = useInView(headRef, { once: true, margin: "-60px" });

  return (
    <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20 border-t border-[#E8E3DC]">
      <motion.div
        ref={headRef}
        initial={{ opacity: 0, y: 24 }}
        animate={headInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-16"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-[#5a7a5a] mb-3">How it works</p>
        <h2 className="text-[38px] font-bold text-[#1a1a1a] tracking-tight leading-tight max-w-xl">
          From clicks to<br />
          <span className="text-[#5a7a5a]">verified attention.</span>
        </h2>
      </motion.div>

      {/* Timeline — hidden on mobile, visible md+ */}
      <div className="hidden md:block max-w-2xl mx-auto">
        {STEPS.map((step, i) => (
          <StepCard key={step.title} step={step} index={i} />
        ))}
      </div>

      {/* Mobile: simple vertical stack */}
      <div className="flex flex-col gap-4 md:hidden">
        {STEPS.map((step, i) => (
          <MobileStep key={step.title} step={step} index={i} />
        ))}
      </div>
    </section>
  );
}
