import React from 'react';
import Image from 'next/image';

export function MottoSection() {
  return (
    <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center text-center overflow-hidden py-24 sm:py-32 lg:py-36">
      {/* Dedicated Background 2: book_bg.png for Motto Section */}
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

        {/* Top gradient transition matching Hero bottom gradient (#0d0705) */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0d0705] via-[#0d0705]/65 to-transparent" />

        {/* Bottom gradient transition into Features section (#0d0705) */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/75 to-transparent" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* Main Latin Maxim: NEMO EST SUPRA LEGES */}
        <h2 className="font-cinzel text-5xl sm:text-7xl md:text-8xl lg:text-[7.5rem] xl:text-[8.5rem] 2xl:text-[9.5rem] font-bold tracking-[0.04em] leading-[1.02] text-[#ded7cb]">
          NEMO <span className="text-[#c5944e]">EST</span>
          <br />
          SUPRA LEGES
        </h2>

        {/* Subtitle translation: No one is above the law. */}
        <p className="mt-5 sm:mt-7 font-cormorant text-2xl sm:text-3xl md:text-4xl lg:text-[2.75rem] xl:text-[3.25rem] font-normal tracking-wide text-[#ded7cb]">
          <span className="text-[#c5944e]">No one</span> is above the law.
        </p>
      </div>
    </section>
  );
}
