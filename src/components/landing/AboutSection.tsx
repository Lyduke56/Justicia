'use client';

import React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';

export function AboutSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="about"
      className="relative min-h-screen flex flex-col justify-end pt-40 pb-12 sm:pb-16 lg:pb-20 overflow-hidden"
    >
      {/* Base Layer: book_bg.png - static background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/actual_images/book_bg.png"
          alt="Antique law library bookshelf background"
          fill
          priority={false}
          className="object-cover object-center filter contrast-110"
          sizes="100vw"
        />

        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(20, 11, 12, 0.78)' }}
        />
      </div>

      {/* Foreground Architecture Backdrop Layer - static backdrop */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/actual_images/hall_of_justice.png"
          alt="Neoclassical Hall of Justice facade"
          fill
          priority={false}
          className="object-cover object-center filter contrast-105 brightness-95"
          sizes="100vw"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 8%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,1) 85%, rgba(0,0,0,0.85) 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 8%, rgba(0,0,0,0.95) 20%, rgba(0,0,0,1) 85%, rgba(0,0,0,0.85) 100%)',
          }}
        />

        {/* Soft bottom darkening */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/75 to-transparent pointer-events-none" />
      </div>

      {/* Foreground Content Area - Animated on scroll */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-end">
          {/* Left Column: Heading + Paragraph - appears on scroll */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="w-12 h-[1px] bg-[#c5944e] origin-left"
            />
            <h2 className="font-cinzel text-3xl sm:text-4xl lg:text-5xl font-bold text-[#ded7cb] tracking-wide leading-tight">
              ABOUT <span className="text-[#c5944e]">JUSTICIA</span>
            </h2>

            <p className="text-[#9e9386] text-xs sm:text-sm lg:text-[0.925rem] leading-relaxed font-normal">
              Justicia was founded on the fundamental principle that legal understanding should not be a privilege reserved for the few. By uniting high-level AI reasoning trained on Philippine jurisprudence with a verified network of practicing attorneys, we bridge the gap between complex legal statutes and everyday citizens seeking justice.
            </p>
          </motion.div>

          {/* Right Column: Paragraph - appears on scroll */}
          <motion.div
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <p className="text-[#9e9386] text-xs sm:text-sm lg:text-[0.925rem] leading-relaxed font-normal">
              Whether you are drafting contracts, clarifying business compliance, analyzing land titles, or preparing for judicial proceedings, our platform equips you with immediate contextual answers and trusted lawyer consultations with complete confidentiality.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
