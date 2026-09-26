"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type Transition } from "framer-motion";

export interface CarouselItem {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const DRAG_BUFFER = 0;
const VELOCITY_THRESHOLD = 500;
const GAP = 16;
const SPRING_OPTIONS: Transition = { type: "spring", stiffness: 300, damping: 30 };

function CarouselCard({
  item,
  index,
  itemWidth,
  round,
  trackItemOffset,
  x,
  transition,
}: {
  item: CarouselItem;
  index: number;
  itemWidth: number;
  round: boolean;
  trackItemOffset: number;
  x: ReturnType<typeof useMotionValue<number>>;
  transition: Transition;
}) {
  const range = [
    -(index + 1) * trackItemOffset,
    -index * trackItemOffset,
    -(index - 1) * trackItemOffset,
  ];
  const rotateY = useTransform(x, range, [90, 0, -90], { clamp: false });

  return (
    <motion.div
      className={`relative shrink-0 flex flex-col overflow-hidden cursor-grab active:cursor-grabbing ${
        round
          ? "items-center justify-center text-center"
          : "items-start justify-between bg-white border border-[#E8E3DC] rounded-[16px]"
      }`}
      style={{
        width: itemWidth,
        height: round ? itemWidth : 220,
        rotateY,
        ...(round && { borderRadius: "50%" }),
      }}
      transition={transition}
    >
      {!round && (
        <>
          {/* Top accent bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-[#c9b8a8] to-[#e8d8cc] shrink-0" />
          <div className="p-5 flex flex-col flex-1">
            {/* Step icon */}
            <div className="w-9 h-9 rounded-xl bg-[#8b6f5c12] border border-[#8b6f5c25] flex items-center justify-center mb-4 shrink-0">
              {item.icon}
            </div>
            {/* Step number watermark */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8b6f5c] mb-2">
                  Step {String(item.id).padStart(2, "0")}
                </p>
                <h3 className="text-[17px] font-bold text-[#1a1a1a] mb-2 tracking-tight">{item.title}</h3>
                <p className="text-[13px] text-[#888] leading-relaxed">{item.description}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function Carousel({
  items,
  baseWidth = 300,
  autoplay = false,
  autoplayDelay = 3000,
  pauseOnHover = false,
  loop = false,
  round = false,
  cardWidth = 0,
}: {
  items: CarouselItem[];
  baseWidth?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  pauseOnHover?: boolean;
  loop?: boolean;
  round?: boolean;
  cardWidth?: number;
}) {
  const containerPadding = 16;
  // If cardWidth is provided, use it; otherwise fill the container
  const itemWidth = cardWidth > 0 ? cardWidth : baseWidth - containerPadding * 2;
  const trackItemOffset = itemWidth + GAP;

  const itemsForRender = useMemo(() => {
    if (!loop) return items;
    if (items.length === 0) return [];
    return [items[items.length - 1], ...items, items[0]];
  }, [items, loop]);

  const [position, setPosition] = useState(loop ? 1 : 0);
  const x = useMotionValue(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pauseOnHover || !containerRef.current) return;
    const el = containerRef.current;
    const enter = () => setIsHovered(true);
    const leave = () => setIsHovered(false);
    el.addEventListener("mouseenter", enter);
    el.addEventListener("mouseleave", leave);
    return () => { el.removeEventListener("mouseenter", enter); el.removeEventListener("mouseleave", leave); };
  }, [pauseOnHover]);

  useEffect(() => {
    if (!autoplay || itemsForRender.length <= 1) return;
    if (pauseOnHover && isHovered) return;
    const timer = setInterval(() => {
      setPosition((prev) => Math.min(prev + 1, itemsForRender.length - 1));
    }, autoplayDelay);
    return () => clearInterval(timer);
  }, [autoplay, autoplayDelay, isHovered, pauseOnHover, itemsForRender.length]);

  useEffect(() => {
    const start = loop ? 1 : 0;
    setPosition(start);
    x.set(-start * trackItemOffset);
  }, [items.length, loop, trackItemOffset, x]);

  const effectiveTransition = isJumping ? { duration: 0 } : SPRING_OPTIONS;

  const handleAnimationComplete = () => {
    if (!loop || itemsForRender.length <= 1) { setIsAnimating(false); return; }
    const lastClone = itemsForRender.length - 1;
    if (position === lastClone) {
      setIsJumping(true);
      setPosition(1); x.set(-1 * trackItemOffset);
      requestAnimationFrame(() => { setIsJumping(false); setIsAnimating(false); });
      return;
    }
    if (position === 0) {
      setIsJumping(true);
      const t = items.length; setPosition(t); x.set(-t * trackItemOffset);
      requestAnimationFrame(() => { setIsJumping(false); setIsAnimating(false); });
      return;
    }
    setIsAnimating(false);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const { offset, velocity } = info;
    const dir =
      offset.x < -DRAG_BUFFER || velocity.x < -VELOCITY_THRESHOLD ? 1
      : offset.x > DRAG_BUFFER || velocity.x > VELOCITY_THRESHOLD ? -1
      : 0;
    if (dir === 0) return;
    setPosition((prev) => Math.max(0, Math.min(prev + dir, itemsForRender.length - 1)));
  };

  const dragProps = loop ? {} : {
    dragConstraints: { left: -trackItemOffset * Math.max(itemsForRender.length - 1, 0), right: 0 },
  };

  const activeIndex = items.length === 0 ? 0
    : loop ? (position - 1 + items.length) % items.length
    : Math.min(position, items.length - 1);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden p-4 ${round ? "rounded-full border border-[#E8E3DC]" : "rounded-[24px]"}`}
      style={{ width: `${baseWidth}px`, ...(round && { height: `${baseWidth}px` }) }}
    >
      <motion.div
        className="flex"
        drag={isAnimating ? false : "x"}
        {...dragProps}
        style={{
          width: itemWidth,
          gap: `${GAP}px`,
          perspective: 1000,
          perspectiveOrigin: `${position * trackItemOffset + itemWidth / 2}px 50%`,
          x,
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: -(position * trackItemOffset) }}
        transition={effectiveTransition}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={handleAnimationComplete}
      >
        {itemsForRender.map((item, index) => (
          <CarouselCard
            key={`${item.id}-${index}`}
            item={item}
            index={index}
            itemWidth={itemWidth}
            round={round}
            trackItemOffset={trackItemOffset}
            x={x}
            transition={effectiveTransition}
          />
        ))}
      </motion.div>

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-2">
        {items.map((_, index) => (
          <motion.button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            className={`h-1.5 rounded-full border-0 p-0 appearance-none cursor-pointer transition-colors duration-150 ${
              activeIndex === index ? "bg-[#8b6f5c]" : "bg-[#8b6f5c30]"
            }`}
            animate={{ width: activeIndex === index ? 20 : 6 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPosition(loop ? index + 1 : index)}
          />
        ))}
      </div>
    </div>
  );
}
