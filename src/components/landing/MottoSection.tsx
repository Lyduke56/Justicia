'use client';

import React from 'react';
import Image from 'next/image';
import { motion, useReducedMotion } from 'motion/react';

export function MottoSection() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="motto"
      className="relative min-h-[65vh] sm:min-h-[75vh] flex items-center justify-center text-center overflow-hidden py-24 sm:py-32 lg:py-36"
    >
      {/* Static Background 2: book_bg.png - grounded, no background movement */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/actual_images/book_bg.png"
          alt="Antique law library bookshelf background"
          fill
          priority={false}
          className="object-cover object-center filter contrast-110"
          sizes="100vw"
        />

        {/* Darkening overlay */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(20, 11, 12, 0.78)' }}
        />

        {/* Top gradient transition matching Hero bottom gradient */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0d0705] via-[#0d0705]/65 to-transparent" />

        {/* Bottom gradient transition into Features section */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/75 to-transparent" />
      </div>

      {/* Foreground Content Area - Animated on scroll */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* On-Scroll Appearance: Top Hairline Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="w-20 sm:w-28 h-[1px] bg-[#c5944e]/60 mx-auto mb-8 origin-center"
        />

        {/* On-Scroll Appearance: Main Latin Maxim: NEMO EST SUPRA LEGES */}
        <motion.div
          initial={{ opacity: 0, y: 35 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-cinzel text-5xl sm:text-7xl md:text-8xl lg:text-[7.5rem] xl:text-[8.5rem] 2xl:text-[9.5rem] font-bold tracking-[0.04em] leading-[1.02] text-[#ded7cb]">
            NEMO <span className="text-[#c5944e]">EST</span>
            <br />
            SUPRA LEGES
          </h2>
        </motion.div>

        {/* On-Scroll Appearance: Subtitle translation */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 sm:mt-8 font-cormorant text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] xl:text-[3.25rem] font-normal tracking-wide text-[#ded7cb]"
        >
          <span className="text-[#c5944e]">No one</span> is above the law.
        </motion.p>

        {/* On-Scroll Appearance: Bottom Hairline Divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-20 sm:w-28 h-[1px] bg-[#c5944e]/60 mx-auto mt-8 origin-center"
        />
      </div>
    </section>
  );
}
