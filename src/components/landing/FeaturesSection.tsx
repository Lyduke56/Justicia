import React from 'react';
import { ScalesLogo, PillarsIcon, SparklesIcon, CalendarIcon } from './LawIcons';

export function FeaturesSection() {
  const features = [
    {
      icon: SparklesIcon,
      title: 'AI-Powered Philippine Law Guide',
      latinTag: 'Lex Informatio',
      desc: 'Ask complex legal questions in plain English or Filipino. Receive structured explanations based on codified laws and jurisprudence.',
    },
    {
      icon: CalendarIcon,
      title: 'Direct Lawyer Consultations',
      latinTag: 'Advocatus Fidelis',
      desc: 'Connect with verified licensed Philippine attorneys for formal legal advice, case assessments, and representation.',
    },
    {
      icon: PillarsIcon,
      title: 'Supreme Court Precedent Search',
      latinTag: 'Stare Decisis',
      desc: 'Explore en banc and division decisions from the Supreme Court of the Philippines with automated citation cross-referencing.',
    },
    {
      icon: ScalesLogo,
      title: 'Secure Document Analysis',
      latinTag: 'Instrumentum Iuris',
      desc: 'Upload contracts, affidavits, and demand letters for instant clause breakdown and potential risk identification.',
    },
  ];

  return (
    <section id="features" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-12 z-10">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-block px-3 py-1 rounded border border-[#c59341]/40 bg-[#c59341]/10 text-[#c59341] font-cinzel text-xs tracking-[0.2em] uppercase">
            Platform Capabilities
          </div>
          <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-bold text-[#ded7cb] tracking-wide">
            ELEVATING ACCESS TO <span className="text-[#c59341]">JUSTICE</span>
          </h2>
          <p className="text-[#a49a8d] text-sm sm:text-base font-sans max-w-xl mx-auto">
            Combining modern artificial intelligence with verified legal authority to protect your constitutional rights.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, index) => {
            const Icon = feat.icon;
            return (
              <div
                key={index}
                className="group relative p-6 sm:p-7 rounded-lg border border-[#3b2a1c]/80 bg-[#120b07]/80 hover:bg-[#1a110a] hover:border-[#c59341]/60 transition-all duration-300 backdrop-blur-sm shadow-xl flex flex-col justify-between"
              >
                {/* Corner accent */}
                <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#c59341]/40 group-hover:border-[#c59341] transition-colors" />

                <div>
                  <div className="w-12 h-12 rounded bg-[#24170d] border border-[#4a3422] flex items-center justify-center text-[#c59341] mb-5 group-hover:scale-110 group-hover:bg-[#c59341]/10 transition-all duration-300">
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="font-cinzel text-[11px] text-[#c59341] tracking-widest uppercase block mb-1">
                    {feat.latinTag}
                  </span>

                  <h3 className="font-cinzel text-base sm:text-lg font-bold text-[#ded7cb] mb-3 group-hover:text-[#ffd285] transition-colors">
                    {feat.title}
                  </h3>

                  <p className="text-[#968b7f] text-xs sm:text-sm leading-relaxed font-sans">
                    {feat.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#291c13] flex items-center justify-between text-xs text-[#c59341] font-cinzel">
                  <span className="tracking-wider">Explore</span>
                  <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
