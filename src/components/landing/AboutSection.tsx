'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CourthouseSvg } from './CourthouseSvg';

interface AboutSectionProps {
  isSvgMode?: boolean;
}

export function AboutSection({ isSvgMode = false }: AboutSectionProps) {
  const [contentMode, setContentMode] = useState<'mockup' | 'mission'>('mockup');

  return (
    <section
      id="about"
      className="relative min-h-[90vh] lg:min-h-screen flex flex-col justify-end pt-32 pb-16 sm:pb-24 overflow-hidden"
    >
      {/* Background: Neoclassical Courthouse Architecture */}
      <div className="absolute inset-0 z-0">
        {isSvgMode ? (
          <div className="w-full h-full opacity-85">
            <CourthouseSvg className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-full relative">
            <Image
              src="/images/courthouse-bg.jpg"
              alt="Neoclassical Courthouse facade with grand columns and dome"
              fill
              className="object-cover object-center filter contrast-110 brightness-90"
              sizes="100vw"
              priority={false}
            />
          </div>
        )}

        {/* Cinematic Vignette & Bottom Text Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#090503] via-[#090503]/80 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#090503] via-transparent to-transparent opacity-80 pointer-events-none" />
        <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#090503]/30 to-[#090503] pointer-events-none" />
      </div>

      {/* Content Area at the bottom */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 w-full">
        {/* Subtle toggle for exact mockup lorem ipsum vs live mission copy */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setContentMode(prev => (prev === 'mockup' ? 'mission' : 'mockup'))}
            className="text-[10px] sm:text-xs font-sans text-[#a49a8d]/70 hover:text-[#c59341] border border-[#3b2b1e]/50 hover:border-[#c59341]/60 px-2.5 py-1 rounded bg-black/40 backdrop-blur-sm transition-all"
            title="Toggle between exact design mockup Latin text and Philippine legal tech description"
          >
            Copy: <span className="text-[#c59341] font-medium">{contentMode === 'mockup' ? 'Mockup (Lorem)' : 'Jurisprudence'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-end">
          {/* Left Column: Heading + Paragraph */}
          <div className="space-y-4">
            <h2 className="font-cinzel text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-[#ded7cb] tracking-wide leading-tight">
              ABOUT <span className="text-[#c59341]">JUSTICIA</span>
            </h2>

            <p className="text-[#a49a8d] text-sm sm:text-[0.95rem] leading-relaxed font-normal">
              {contentMode === 'mockup'
                ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
                : 'Justicia was built to bridge the gap in legal access across the Philippines. Grounded in the 1987 Philippine Constitution, Supreme Court jurisprudence, and codified statutes, our platform empowers citizens with immediate, reliable legal understanding and connects them with verified member lawyers of the Integrated Bar of the Philippines.'}
            </p>
          </div>

          {/* Right Column: Paragraph */}
          <div className="space-y-4">
            <p className="text-[#a49a8d] text-sm sm:text-[0.95rem] leading-relaxed font-normal">
              {contentMode === 'mockup'
                ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.'
                : 'Whether dealing with labor disputes under the Labor Code, tenancy and agrarian contracts, family law matters, or criminal procedure, Justicia gives you clear legal insight when it matters most — upholding the enduring truth that no one is above the law.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
