"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SpotlightCard from "@/components/ui/SpotlightCard";
import BlurText from "@/components/ui/BlurText";

const STEPS = [
  {
    num: 1,
    title: "Discover",
    body: "A shopper opens a shared product link from a creator they trust.",
    icon: "M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z",
    spotlight: "rgba(139, 111, 92, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    accent: "#8b6f5c",
    iconBg: "bg-[#f0ece7]",
    topGradient: "from-[#c9b8a8] to-[#e8e3dc]",
  },
  {
    num: 2,
    title: "Engage",
    body: "Real interaction — reading, scrolling, watching — creates measurable attention signals.",
    icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    spotlight: "rgba(90, 122, 90, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    accent: "#5a7a5a",
    iconBg: "bg-[#eaf2ea]",
    topGradient: "from-[#b8c9b8] to-[#dce8dc]",
  },
  {
    num: 3,
    title: "Verify",
    body: "Behavioral signals separate genuine humans from bots and bounces instantly.",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    spotlight: "rgba(90, 90, 150, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    accent: "#6a5a9a",
    iconBg: "bg-[#efecf7]",
    topGradient: "from-[#c0b8d8] to-[#e0dce8]",
  },
  {
    num: 4,
    title: "Reward",
    body: "Every 5s of verified attention triggers a micro-reward drawn from the product's escrow.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    spotlight: "rgba(139, 111, 92, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    accent: "#8b6f5c",
    iconBg: "bg-[#f0ece7]",
    topGradient: "from-[#c9b8a8] to-[#e8e3dc]",
  },
  {
    num: 5,
    title: "Settle",
    body: "Rewards land in your wallet on Sui instantly — no wait, no platform cut.",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    spotlight: "rgba(90, 122, 90, 0.3)" as `rgba(${number}, ${number}, ${number}, ${number})`,
    accent: "#5a7a5a",
    iconBg: "bg-[#eaf2ea]",
    topGradient: "from-[#b8c9b8] to-[#dce8dc]",
  },
];

function StepCard({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const isLeft = index % 2 === 0;

  return (
    <div ref={ref} className="relative grid grid-cols-[1fr_60px_1fr] items-start">

      {/* Left side — only rendered for even steps */}
      <div className={`pr-5 pb-10 flex ${isLeft ? "justify-end" : ""}`}>
        {isLeft && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[280px]"
          >
            <StepCardInner step={step} />
          </motion.div>
        )}
      </div>

      {/* Centre spine */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={inView ? { scale: 1 } : {}}
          transition={{ duration: 0.35, type: "spring", stiffness: 300, delay: 0.05 }}
          className="w-11 h-11 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[13px] font-bold text-white z-10 shrink-0"
          style={{ background: step.accent }}
        >
          {step.num}
        </motion.div>

        {index < STEPS.length - 1 && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ duration: 0.55, delay: 0.3, ease: "easeOut" }}
            style={{ originY: 0 }}
            className="w-px flex-1 min-h-[56px] mt-1"
          >
            <div className="w-full h-full bg-gradient-to-b from-[#1a1a1a22] to-transparent" />
          </motion.div>
        )}
      </div>

      {/* Right side — only rendered for odd steps */}
      <div className={`pl-5 pb-10 flex`}>
        {!isLeft && (
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[280px]"
          >
            <StepCardInner step={step} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StepCardInner({ step }: { step: typeof STEPS[0] }) {
  return (
    <SpotlightCard
      spotlightColor={step.spotlight}
      className="group rounded-2xl bg-white border border-[#E8E3DC] overflow-hidden
                 hover:-translate-y-1 hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.10)] transition-all duration-300"
    >
      {/* Coloured top bar */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${step.topGradient}`} />
      <div className="p-5 flex gap-3 items-start">
        <div className={`w-9 h-9 rounded-xl ${step.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
          <svg className="w-4 h-4" fill="none" stroke={step.accent} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
          </svg>
        </div>
        <div>
          <p className="text-[14px] font-bold text-[#1a1a1a] mb-1">{step.title}</p>
          <p className="text-[12px] text-[#888] leading-relaxed">{step.body}</p>
        </div>
      </div>
    </SpotlightCard>
  );
}

export default function HowItWorks() {
  const headRef = useRef(null);
  const inView = useInView(headRef, { once: true, margin: "-60px" });

  return (
    <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20 border-t border-[#E8E3DC]">
      <div ref={headRef} className="mb-16 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-widest text-[#5a7a5a] mb-3"
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

      {/* Desktop zigzag timeline — centred */}
      <div className="hidden md:block max-w-3xl mx-auto">
        {STEPS.map((step, i) => (
          <StepCard key={step.title} step={step} index={i} />
        ))}
      </div>

      {/* Mobile — vertical stack */}
      <div className="flex flex-col gap-4 md:hidden">
        {STEPS.map((step, i) => (
          <MobileStep key={step.title} step={step} index={i} />
        ))}
      </div>
    </section>
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
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <SpotlightCard
        spotlightColor={step.spotlight}
        className="rounded-2xl bg-white border border-[#E8E3DC] overflow-hidden"
      >
        <div className={`h-0.5 w-full bg-gradient-to-r ${step.topGradient}`} />
        <div className="p-4 flex gap-3 items-start">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold text-white shrink-0"
            style={{ background: step.accent }}>
            {step.num}
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#1a1a1a] mb-0.5">{step.title}</p>
            <p className="text-[12px] text-[#888] leading-relaxed">{step.body}</p>
          </div>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}
