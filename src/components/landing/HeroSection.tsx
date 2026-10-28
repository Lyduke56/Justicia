'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react';

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Scroll scrub tracking across the hero section for foreground elements only
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.001,
  });

  // Foreground text scrub on scroll
  const textY = useTransform(smoothProgress, [0, 0.85], [0, -50]);
  const textOpacity = useTransform(smoothProgress, [0, 0.7], [1, 0]);

  // Foreground Lady Justice statue scrub on scroll
  const statueY = useTransform(smoothProgress, [0, 0.85], [0, -40]);
  const statueOpacity = useTransform(smoothProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={containerRef}
      id="home"
      className="relative min-h-[92vh] lg:min-h-screen flex items-center pt-28 sm:pt-32 pb-14 lg:pb-16 overflow-hidden"
    >
      {/* Static, grounded background - no background animation */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/actual_images/book_bg.png"
          alt="Antique law library bookshelf background"
          fill
          priority
          className="object-cover object-top filter contrast-110"
          sizes="100vw"
        />

        {/* Darkening overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(20, 11, 12, 0.90)' }}
        />

        {/* Top Navbar scrim */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#140b0d]/90 to-transparent" />

        {/* Bottom gradient transition into next section */}
        <div className="absolute bottom-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/70 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
        {/* Left Column: Headlines, Subtext, Buttons - Vertically center-aligned with the statue's visual torso */}
        <motion.div
          style={{
            y: prefersReducedMotion ? 0 : textY,
            opacity: textOpacity,
          }}
          className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 text-left lg:-translate-y-10 xl:-translate-y-14 2xl:-translate-y-16"
        >
          {/* Main Headline - animated foreground */}
          <motion.h1
            initial={{ opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-cinzel text-3xl sm:text-4xl md:text-5xl lg:text-[3rem] xl:text-[3.5rem] 2xl:text-[4.15rem] font-bold text-[#ded7cb] leading-[1.14] tracking-tight"
          >
            <span className="block sm:whitespace-nowrap">
              BE <span className="text-[#c5944e]">AWARE</span> OF YOUR
            </span>
            <span className="block sm:whitespace-nowrap">
              RIGHTS, MOVE <span className="text-[#c5944e]">NOW</span>.
            </span>
          </motion.h1>

          {/* Subtext description - animated foreground */}
          <motion.p
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#a69c8f] text-sm sm:text-base lg:text-[1.05rem] leading-relaxed max-w-xl font-normal font-sans"
          >
            Understand Philippine laws and jurisprudence with AI-powered legal guidance,
            connect with a real lawyer when you need professional counsel.
          </motion.p>

          {/* CTA Action Buttons - animated foreground */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2"
          >
            {/* Chat with our AI (Solid Warm Gold) */}
            <Link
              href="/chat"
              className="inline-flex items-center justify-center bg-[#c5944e] hover:bg-[#d6a25b] active:scale-[0.98] text-[#160c0d] font-semibold text-xs sm:text-sm tracking-[0.14em] uppercase px-7 py-3.5 rounded transition-all duration-200 text-center shadow-lg shadow-black/35"
            >
              Chat with our AI
            </Link>

            {/* Book a Consultation (Outlined Warm Gold) */}
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center border border-[#c5944e]/60 hover:border-[#c5944e] hover:bg-[#c5944e]/10 active:scale-[0.98] text-[#c5944e] bg-transparent font-semibold text-xs sm:text-sm tracking-[0.14em] uppercase px-7 py-3.5 rounded transition-all duration-200 text-center"
            >
              Book a Consultation
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Column: Lady Justice Statue - animated foreground element */}
        <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end items-center relative mt-4 lg:mt-0">
          <motion.div
            style={{
              y: prefersReducedMotion ? 0 : statueY,
              opacity: statueOpacity,
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 54%, rgba(0,0,0,0.85) 64%, rgba(0,0,0,0.3) 74%, rgba(0,0,0,0) 82%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 54%, rgba(0,0,0,0.85) 64%, rgba(0,0,0,0.3) 74%, rgba(0,0,0,0) 82%)',
            }}
            initial={{ opacity: 0, y: 50, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1.1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[400px] sm:max-w-[500px] lg:max-w-[620px] xl:max-w-[700px] 2xl:max-w-[760px] h-auto flex items-center justify-center"
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
        </div>
      </div>
    </section>
  );
}
