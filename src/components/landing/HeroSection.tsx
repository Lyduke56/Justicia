'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LadyJusticeSvg } from './LadyJusticeSvg';
import { SparklesIcon, CalendarIcon } from './LawIcons';

interface HeroSectionProps {
  isSvgMode?: boolean;
}

export function HeroSection({ isSvgMode = false }: HeroSectionProps) {
  return (
    <section
      id="home"
      className="relative min-h-[90vh] sm:min-h-screen flex items-center pt-24 sm:pt-28 pb-12 lg:pb-16 overflow-hidden"
    >
      {/* Container aligned with standard browser viewports */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-4 items-center">
        {/* Left Column: Headlines, Subtext, CTA Buttons */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-8 text-left max-w-2xl">
          {/* Main Headline */}
          <h1 className="font-cinzel text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-[4rem] font-bold text-[#e6ded2] leading-[1.12] tracking-tight">
            BE <span className="text-[#c59341]">AWARE</span> OF YOUR<br />
            RIGHTS, MOVE <span className="text-[#c59341]">NOW</span>.
          </h1>

          {/* Subtext description */}
          <p className="text-[#a49a8d] text-sm sm:text-base lg:text-[1.05rem] leading-relaxed max-w-xl font-normal font-sans">
            Understand Philippine laws and jurisprudence with AI-powered legal guidance,
            connect with a real lawyer when you need professional counsel.
          </p>

          {/* CTA Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
            {/* Primary CTA: Chat with our AI */}
            <Link
              href="/chat"
              className="inline-flex items-center justify-center gap-2 bg-[#c59341] hover:bg-[#d6a54f] text-[#140c06] font-semibold text-xs sm:text-sm tracking-wider uppercase px-7 py-3.5 rounded shadow-lg shadow-black/50 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <SparklesIcon className="w-4 h-4 text-[#140c06]" />
              <span>Chat with our AI</span>
            </Link>

            {/* Secondary CTA: Book a Consultation */}
            <Link
              href="/consultations/book"
              className="inline-flex items-center justify-center gap-2 border border-[#c59341] hover:border-[#dfa856] text-[#c59341] hover:text-[#ffd285] bg-black/40 hover:bg-[#c59341]/10 font-semibold text-xs sm:text-sm tracking-wider uppercase px-7 py-3.5 rounded backdrop-blur-sm transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <CalendarIcon className="w-4 h-4 text-[#c59341]" />
              <span>Book a Consultation</span>
            </Link>
          </div>

          {/* Subtle Trust Indicators / Jurisprudence tags */}
          <div className="pt-4 flex flex-wrap items-center gap-3 text-xs text-[#8c8072] font-cinzel">
            <span className="text-[#c59341] font-semibold">● Philippine Legal Jurisprudence</span>
            <span>|</span>
            <span>Supreme Court Rulings</span>
            <span>|</span>
            <span>Integrated Bar Verified</span>
          </div>
        </div>

        {/* Right Column: Lady Justice Statue */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end items-center relative mt-6 lg:mt-0">
          {/* Subtle warm halo glow behind the statue */}
          <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-[#c59341]/15 filter blur-3xl -z-10 pointer-events-none" />

          {isSvgMode ? (
            /* Pure SVG Mode */
            <div className="w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[460px] transform hover:scale-[1.02] transition-transform duration-500 drop-shadow-[0_20px_40px_rgba(0,0,0,0.8)]">
              <LadyJusticeSvg className="w-full h-auto" />
            </div>
          ) : (
            /* Photographic Statue Asset (Blended with Screen / Soft Light) */
            <div className="relative w-full max-w-[340px] sm:max-w-[420px] lg:max-w-[460px] aspect-[3/4] flex items-center justify-center">
              <div
                className="w-full h-full relative"
                style={{
                  maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
                }}
              >
                <Image
                  src="/images/lady-justice.jpg"
                  alt="Classical Statue of Lady Justice holding the scales and sword"
                  width={500}
                  height={667}
                  priority
                  className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.9)] mix-blend-screen transform hover:scale-[1.01] transition-transform duration-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
