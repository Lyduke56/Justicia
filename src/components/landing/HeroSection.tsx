'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
} from 'motion/react';
import { BookshelfSpotlight } from './LibrarySpotlight';

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Progress runs 0 → 1 while the whole hero scrolls out of the viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Softer spring = more glide, so the layers feel weighted rather than glued to the scrollbar
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 26,
    restDelta: 0.0005,
  });

  /**
   * Parallax depth (slowest → fastest):
   *   background  <  statue  <  headline/CTAs
   * Each layer also fades on its own schedule so the exit unfolds in stages
   * instead of everything disappearing at once.
   */

  // Layer 1 — background: slow descent + gentle push-in matching Motto section depth
  const bgY = useTransform(smoothProgress, [0, 1], ['0%', '8%']);
  const bgScale = useTransform(smoothProgress, [0, 1], [1.02, 1.1]);

  // Layer 2 — statue: medium drift, holds briefly, then dissolves
  const statueY = useTransform(smoothProgress, [0, 0.85], [0, -90]);
  const statueScale = useTransform(smoothProgress, [0, 0.85], [1, 1.05]);
  const statueOpacity = useTransform(smoothProgress, [0.12, 0.62], [1, 0]);

  // Layer 3 — copy: moves fastest, defocuses as it fades (reads as "closest to the viewer")
  const textY = useTransform(smoothProgress, [0, 0.6], [0, -160]);
  const textScale = useTransform(smoothProgress, [0, 0.6], [1, 0.96]);
  const textOpacity = useTransform(smoothProgress, [0.05, 0.42], [1, 0]);
  const textBlur = useTransform(smoothProgress, [0.08, 0.42], [0, 10]);
  const textFilter = useMotionTemplate`blur(${textBlur}px)`;

  // Descent into darkness: matches the Motto section's opening colour (#0d0705)
  const dimOpacity = useTransform(smoothProgress, [0.3, 0.9], [0, 0.85]);

  return (
    <section
      ref={containerRef}
      id="home"
      className="relative min-h-[140vh] lg:min-h-[155vh] flex items-center pt-28 sm:pt-32 pb-48 sm:pb-64 lg:pb-80 overflow-hidden"
    >
      {/* Background stack */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Pinned frame: locks to viewport height (100vh) so the bookshelf background stays zoomed out matching MottoSection */}
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Parallax layer: oversized so it never reveals an edge while it travels */}
          <motion.div
            style={{
              y: prefersReducedMotion ? 0 : bgY,
              scale: prefersReducedMotion ? 1 : bgScale,
            }}
            className="absolute inset-x-0 -top-[10%] -bottom-[10%] will-change-transform"
          >
            <Image
              src="/actual_images/book_bg.png"
              alt="Antique law library bookshelf background"
              fill
              priority
              className="object-cover object-top filter contrast-110"
              sizes="100vw"
            />
          </motion.div>

          {/* Darkening overlay */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(20, 11, 12, 0.90)' }}
          />

          {/* Bookshelf Spotlight Reveal */}
          <BookshelfSpotlight
            containerRef={containerRef}
            parallaxY={bgY}
            parallaxScale={bgScale}
            oversizedClassName="-top-[10%] -bottom-[10%]"
          />

          {/* Top Navbar scrim */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#140b0d]/90 to-transparent" />

          {/* Bottom gradient transition into next section */}
          <div className="absolute bottom-0 left-0 right-0 h-72 sm:h-96 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/85 to-transparent" />

          {/* Scroll-driven dim: the hero sinks into the Motto section's opening colour */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0 : dimOpacity }}
            className="absolute inset-0 bg-[#0d0705]"
          />
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
        {/* Left Column: Headlines, Subtext, Buttons */}
        <motion.div
          style={{
            y: prefersReducedMotion ? 0 : textY,
            scale: prefersReducedMotion ? 1 : textScale,
            opacity: textOpacity,
            filter: prefersReducedMotion ? 'none' : textFilter,
          }}
          className="relative z-20 lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 text-left lg:-translate-y-35 xl:-translate-y-40 2xl:-translate-y-71 will-change-transform"
        >
          {/* Main Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-lora text-3xl sm:text-4xl md:text-5xl lg:text-[3rem] xl:text-[3.5rem] 2xl:text-[4.15rem] font-medium text-[#ded7cb] leading-[1.14] tracking-tight"
          >
            <span className="block sm:whitespace-nowrap">
              BE <span className="text-[#c5944e]">AWARE</span> OF YOUR
            </span>
            <span className="block sm:whitespace-nowrap">
              RIGHTS, MOVE <span className="text-[#c5944e]">NOW</span>.
            </span>
          </motion.h1>

          {/* Subtext description */}
          <motion.p
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#a69c8f] text-sm sm:text-base lg:text-[1rem] xl:text-[1.1rem] 2xl:text-[1.23rem] leading-relaxed max-w-xl xl:max-w-none xl:w-[800px] 2xl:w-[860px] text-balance font-inter font-light"
          >
            Understand Philippine laws and jurisprudence with AI-powered legal
            guidance, connect with a real lawyer when you need professional counsel.
          </motion.p>

          {/* CTA Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2"
          >
            {/* Chat with our AI (Solid Warm Gold) */}
            <Link
              href="/chat"
              className="inline-flex items-center justify-center bg-[#D39758] hover:bg-[#d6a25b] active:scale-[0.98] text-[#160c0d] font-lora font-medium text-[0.9rem] sm:text-sm tracking-[0.14em] px-7 py-3.5 rounded transition-all duration-200 text-center shadow-lg shadow-black/35"
            >
              Chat with our AI
            </Link>

            {/* Book a Consultation (Outlined Warm Gold) */}
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center border border-[#D39758]/60 hover:border-[#c5944e] hover:bg-[#c5944e]/10 active:scale-[0.98] text-[#c5944e] bg-transparent font-lora font-medium text-xs sm:text-sm tracking-[0.14em] px-7 py-3.5 rounded transition-all duration-200 text-center"
            >
              Book a Consultation
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Column: Lady Justice Statue - midground parallax element */}
        <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end items-center relative mt-4 lg:mt-0 lg:-translate-y-12 xl:-translate-y-19 lg:-translate-x-6">
          <motion.div
            style={{
              y: prefersReducedMotion ? 0 : statueY,
              scale: prefersReducedMotion ? 1 : statueScale,
              opacity: statueOpacity,
            }}
            className="relative w-full max-w-[480px] sm:max-w-[560px] lg:max-w-none lg:w-[580px] xl:w-[680px] 2xl:w-[780px] lg:-mr-12 xl:-mr-20 2xl:-mr-32 h-auto flex items-center justify-center pointer-events-none will-change-transform"
          >
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1.1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                maskImage:
                  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.85) 68%, rgba(0,0,0,0.25) 80%, rgba(0,0,0,0) 90%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.85) 68%, rgba(0,0,0,0.25) 80%, rgba(0,0,0,0) 90%)',
              }}
              className="w-full h-auto flex items-center justify-center"
            >
              <Image
                src="/actual_images/lady_justice.png"
                alt="Statue of Lady Justice holding scales and sword"
                width={1180}
                height={2092}
                priority
                className="w-full h-auto object-contain filter drop-shadow-[0_20px_45px_rgba(0,0,0,0.85)]"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}