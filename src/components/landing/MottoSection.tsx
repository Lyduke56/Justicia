import React from 'react';

export function MottoSection() {
  return (
    <section className="relative py-24 sm:py-32 lg:py-40 flex items-center justify-center text-center overflow-hidden">
      {/* Subtle radial ambient warmth centered behind the motto */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[32rem] h-[18rem] sm:w-[48rem] sm:h-[24rem] rounded-full bg-[#c59341]/10 filter blur-[90px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6">
        {/* Main Latin Maxim: NEMO EST SUPRA LEGES */}
        <h2 className="font-cinzel text-4xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-bold tracking-[0.06em] leading-[1.05] text-[#ded7cb]">
          NEMO <span className="text-[#c59341]">EST</span>
          <br />
          SUPRA LEGES
        </h2>

        {/* Subtitle translation: No one is above the law. */}
        <p className="mt-5 sm:mt-7 font-cormorant text-2xl sm:text-3xl md:text-4xl lg:text-[2.5rem] font-normal tracking-wide text-[#ded7cb]">
          <span className="text-[#c59341] font-medium">No one</span> is above the law.
        </p>

        {/* Subtle decorative Roman dividing ornament */}
        <div className="mt-8 flex items-center justify-center gap-3 opacity-60">
          <span className="h-[1px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-[#c59341]" />
          <span className="w-1.5 h-1.5 rotate-45 bg-[#c59341]" />
          <span className="h-[1px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-[#c59341]" />
        </div>
      </div>
    </section>
  );
}
