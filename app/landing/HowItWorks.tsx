"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import BlurText from "@/components/ui/BlurText";
import Carousel from "@/components/ui/Carousel";
import type { CarouselItem } from "@/components/ui/Carousel";

const STEPS: CarouselItem[] = [
  {
    id: 1,
    title: "Discover",
    description: "A shopper opens a shared product link from a creator they trust.",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="#8b6f5c" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
      </svg>
    ),
  },
  {
    id: 2,
    title: "Engage",
    description: "Real interaction — reading, scrolling, watching — creates measurable attention signals.",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="#8b6f5c" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    id: 3,
    title: "Verify",
    description: "Behavioral signals separate genuine humans from bots and bounces instantly.",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="#8b6f5c" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 4,
    title: "Reward",
    description: "Every 5s of verified attention triggers a micro-reward drawn from the product's escrow.",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="#8b6f5c" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 5,
    title: "Settle",
    description: "Rewards land in your wallet on Sui instantly — no wait, no platform cut.",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="#8b6f5c" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const headRef = useRef(null);
  const inView = useInView(headRef, { once: true, margin: "-60px" });
  const carouselRef = useRef(null);
  const carouselInView = useInView(carouselRef, { once: true, margin: "-40px" });

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

      {/* Carousel — wide container, 3 cards visible */}
      <motion.div
        ref={carouselRef}
        initial={{ opacity: 0, y: 32 }}
        animate={carouselInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="flex justify-center"
      >
        <Carousel
          items={STEPS}
          baseWidth={780}
          cardWidth={220}
          autoplay
          autoplayDelay={2800}
          pauseOnHover
          loop
        />
      </motion.div>
    </section>
  );
}
