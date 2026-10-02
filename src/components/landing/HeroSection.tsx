'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center pt-28 sm:pt-32 pb-16 lg:pb-20 overflow-hidden"
    >
      {/* Dedicated Background 1: book_bg.png for Hero Section */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/actual_images/book_bg.png"
          alt="Antique law library bookshelf background"
          fill
          priority
          className="object-cover object-top filter contrast-110"
          sizes="100vw"
        />

        {/* User Specified Overlay: Color #160C0D at 75% */}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(22, 12, 13, 0.75)' }}
        />

        {/* Top Navbar scrim */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#160c0d]/90 to-transparent" />

        {/* Bottom gradient transition using the same dark color as About Justicia section (#0d0705) */}
        <div className="absolute bottom-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/70 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 items-center">
        {/* Left Column: Headlines, Subtext, Buttons */}
        <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 text-left">
          {/* Main Headline - exactly 2 lines */}
          <h1 className="font-cinzel text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] 2xl:text-[4.25rem] font-bold text-[#ded7cb] leading-[1.12] tracking-tight">
            <span className="block sm:whitespace-nowrap">
              BE <span className="text-[#c5944e]">AWARE</span> OF YOUR
            </span>
            <span className="block sm:whitespace-nowrap">
              RIGHTS, MOVE <span className="text-[#c5944e]">NOW</span>.
            </span>
          </h1>

          {/* Subtext description */}
          <p className="text-[#a69c8f] text-sm sm:text-base lg:text-[1.05rem] leading-relaxed max-w-xl font-normal font-sans">
            Understand Philippine laws and jurisprudence with AI-powered legal guidance,
            connect with a real lawyer when you need professional counsel.
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            {/* Chat with our AI (Solid Warm Gold) */}
            <Link
              href="/chat"
              className="inline-flex items-center justify-center bg-[#c5944e] hover:bg-[#d6a25b] text-[#160c0d] font-semibold text-xs sm:text-sm tracking-wider uppercase px-7 py-3.5 rounded transition-all duration-200 text-center shadow-lg shadow-black/40"
            >
              Chat with our AI
            </Link>

            {/* Book a Consultation (Outlined Warm Gold) */}
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center border border-[#c5944e] text-[#c5944e] hover:bg-[#c5944e]/10 bg-transparent font-semibold text-xs sm:text-sm tracking-wider uppercase px-7 py-3.5 rounded transition-all duration-200 text-center"
            >
              Book a Consultation
            </Link>
          </div>
        </div>

        {/* Right Column: Lady Justice Statue - Increased Size with Matching Bottom Gradient */}
        <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end items-center relative mt-4 lg:mt-0">
          <div
            className="relative w-full max-w-[400px] sm:max-w-[500px] lg:max-w-[620px] xl:max-w-[700px] 2xl:max-w-[760px] h-auto flex items-center justify-center"
            style={{
              maskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 54%, rgba(0,0,0,0.85) 64%, rgba(0,0,0,0.3) 74%, rgba(0,0,0,0) 82%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 54%, rgba(0,0,0,0.85) 64%, rgba(0,0,0,0.3) 74%, rgba(0,0,0,0) 82%)',
            }}
          >
            <Image
              src="/actual_images/lady_justice.png"
              alt="Statue of Lady Justice holding scales and sword"
              width={1180}
              height={2092}
              priority
              className="w-full h-auto object-contain filter drop-shadow-[0_25px_50px_rgba(0,0,0,0.8)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
