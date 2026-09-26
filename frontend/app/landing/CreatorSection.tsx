"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SpotlightCard from "@/components/ui/SpotlightCard";
import CountUp from "@/components/ui/CountUp";
import BlurText from "@/components/ui/BlurText";

const STATS = [
  { label: "Avg. session length", value: 4.2, suffix: "min", decimals: 1, sub: "vs 0:08 for click ads" },
  { label: "Creator conversion", value: 18, suffix: "%", decimals: 0, sub: "vs 2.3% industry avg" },
  { label: "Payout latency", value: 3, suffix: "s", decimals: 0, sub: "on Sui mainnet", prefix: "< " },
];

export default function CreatorSection() {
  const headRef = useRef(null);
  const inView = useInView(headRef, { once: true, margin: "-60px" });
  const cardRef = useRef(null);
  const cardInView = useInView(cardRef, { once: true, margin: "-80px" });

  return (
    <section id="creators" className="max-w-7xl mx-auto px-6 py-20 border-t border-[#E8E3DC]">

      <div ref={headRef} className="mb-14">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-xs font-semibold uppercase tracking-widest text-[#8b6f5c] mb-3"
        >
          For creators
        </motion.p>
        <BlurText
          text="Your audience is worth more than a click."
          className="text-[38px] font-bold text-[#1a1a1a] tracking-tight leading-tight"
          animateBy="words"
          direction="bottom"
          delay={80}
          stepDuration={0.3}
        />
      </div>

      <div className="flex flex-col md:flex-row items-start gap-10">

        {/* Stat cards */}
        <div className="flex-1 flex flex-col gap-4">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -36 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.2 + i * 0.13, ease: [0.22, 1, 0.36, 1] }}
            >
              <SpotlightCard
                spotlightColor="rgba(139, 111, 92, 0.2)"
                className="rounded-2xl border border-[#E8E3DC] bg-white px-6 py-5 flex items-center gap-5"
              >
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#999] mb-1">{s.label}</p>
                  <p className="text-[24px] font-bold text-[#1a1a1a] tracking-tight tabular-nums">
                    {s.prefix}
                    <CountUp to={s.value} duration={1.8} />
                    {s.suffix}
                  </p>
                  <p className="text-[11px] text-[#bbb] mt-0.5">{s.sub}</p>
                </div>
                <div className="w-1 h-10 rounded-full bg-gradient-to-b from-[#8b6f5c] to-[#e8e3dc]" />
              </SpotlightCard>
            </motion.div>
          ))}
        </div>

        {/* Live session card */}
        <motion.div
          ref={cardRef}
          initial={{ opacity: 0, y: 32 }}
          animate={cardInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 relative"
        >
          {/* Glow halo */}
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-[#8b6f5c18] to-[#5a7a5a12] blur-2xl pointer-events-none" />

          <SpotlightCard
            spotlightColor="rgba(139, 111, 92, 0.2)"
            className="relative rounded-2xl border border-[#E8E3DC] bg-white p-6"
          >
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#999]">Live Session</p>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5a7a5a]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5a7a5a] opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5a7a5a]" />
                  </span>
                  Active
                </span>
              </div>

              {/* Link pill */}
              <div className="flex items-center gap-3 bg-[#F5F1EC] border border-[#E8E3DC] rounded-xl px-4 py-3">
                <svg className="w-3.5 h-3.5 text-[#8b6f5c] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="text-[11px] text-[#555] truncate flex-1 font-mono">kawaii.pay/p/solace-headphones/ov…</span>
                <button className="shrink-0 text-[10px] font-semibold text-[#1a1a1a] border border-[#D8D3CC] rounded-lg px-2.5 py-1 bg-white hover:bg-[#f5f1ec] transition-colors">
                  Copy
                </button>
              </div>

              <div className="h-px bg-[#EDE8E2]" />

              {/* Earnings */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-[#999] mb-1">Earned this session</p>
                  <p className="text-[30px] font-bold text-[#1a1a1a] tracking-tight">
                    +<CountUp from={0} to={0.0148} duration={2.4} />
                    <span className="text-[14px] font-semibold text-[#8b6f5c] ml-1.5">USDC</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[#999] mb-1">Rate</p>
                  <p className="text-[14px] font-semibold text-[#1a1a1a]">
                    0.002 <span className="text-[11px] font-normal text-[#999]">USDC / 5s</span>
                  </p>
                </div>
              </div>

              {/* Attention bar */}
              <div>
                <div className="flex justify-between text-[10px] text-[#bbb] mb-1.5">
                  <span>Attention verified</span>
                  <span>74%</span>
                </div>
                <div className="h-1.5 bg-[#F0EBE5] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={cardInView ? { width: "74%" } : {}}
                    transition={{ duration: 1.4, delay: 0.5, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[#8b6f5c] to-[#5a7a5a] rounded-full"
                  />
                </div>
              </div>
            </div>
          </SpotlightCard>
        </motion.div>
      </div>
    </section>
  );
}
