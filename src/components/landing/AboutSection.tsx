'use client';

import React from 'react';
import Image from 'next/image';

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative min-h-screen flex flex-col justify-end pt-40 pb-12 sm:pb-16 lg:pb-20 overflow-hidden"
    >
      {/* Base Layer: book_bg.png with overlay #160C0D at 75% */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/actual_images/book_bg.png"
          alt="Antique law library bookshelf background"
          fill
          priority={false}
          className="object-cover object-center filter contrast-110"
          sizes="100vw"
        />

        {/* User Specified Overlay: Color #160C0D at 75% */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(22, 12, 13, 0.75)' }}
        />
      </div>

      {/* Foreground Layer: Hall of Justice Architecture blended over the book background */}
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

        {/* Soft bottom darkening to ensure text readability matching reference */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/70 to-transparent pointer-events-none" />
      </div>

      {/* Content Area at the bottom */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-end">
          {/* Left Column: Heading + Paragraph */}
          <div className="space-y-3">
            <h2 className="font-cinzel text-3xl sm:text-4xl lg:text-5xl font-bold text-[#ded7cb] tracking-wide leading-tight">
              ABOUT <span className="text-[#c5944e]">JUSTICIA</span>
            </h2>

            <p className="text-[#a69c8f] text-xs sm:text-sm lg:text-[0.925rem] leading-relaxed font-normal">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
          </div>

          {/* Right Column: Paragraph */}
          <div className="space-y-3">
            <p className="text-[#a69c8f] text-xs sm:text-sm lg:text-[0.925rem] leading-relaxed font-normal">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
