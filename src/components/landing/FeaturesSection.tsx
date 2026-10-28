'use client';

import React from 'react';
import { motion } from 'motion/react';
import { ScalesLogo, PillarsIcon, SparklesIcon, CalendarIcon } from './LawIcons';

export function FeaturesSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  };

  const features = [
    {
      num: '01',
      icon: SparklesIcon,
      title: 'AI-Powered Philippine Law Guide',
      latinTag: 'Lex Informatio',
      desc: 'Ask complex legal questions in plain English or Filipino. Receive structured explanations based on codified laws and jurisprudence.',
    },
    {
      num: '02',
      icon: CalendarIcon,
      title: 'Direct Lawyer Consultations',
      latinTag: 'Advocatus Fidelis',
      desc: 'Connect with verified licensed Philippine attorneys for formal legal advice, case assessments, and representation.',
    },
    {
      num: '03',
      icon: PillarsIcon,
      title: 'Supreme Court Precedent Search',
      latinTag: 'Stare Decisis',
      desc: 'Explore en banc and division decisions from the Supreme Court of the Philippines with automated citation cross-referencing.',
    },
    {
      num: '04',
      icon: ScalesLogo,
      title: 'Secure Document Analysis',
      latinTag: 'Instrumentum Iuris',
      desc: 'Upload contracts, affidavits, and demand letters for instant clause breakdown and potential risk identification.',
    },
  ];

  return (
    <section
      id="features"
      className="relative py-24 sm:py-32 px-6 sm:px-8 lg:px-12 bg-[#0d0705] z-10"
    >
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section Header: Appears on scroll */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block px-3 py-1 rounded border border-[#c5944e]/30 bg-[#c5944e]/5 text-[#c5944e] font-cinzel text-[11px] tracking-[0.2em] uppercase"
          >
            Platform Capabilities
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-bold text-[#ded7cb] tracking-wide"
          >
            ELEVATING ACCESS TO <span className="text-[#c5944e]">JUSTICE</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-[#968b7f] text-sm sm:text-base font-sans max-w-xl mx-auto"
          >
            Combining modern artificial intelligence with verified legal authority to protect your constitutional rights.
          </motion.p>
        </div>

        {/* Feature Cards Grid: Staggered entrance on scroll */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feat, index) => {
            const Icon = feat.icon;

            return (
              <motion.div
                key={index}
                variants={cardVariants}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="group relative p-7 sm:p-8 rounded-lg border border-[#261719] border-t-[#c5944e]/30 bg-gradient-to-b from-[#160b0d]/95 to-[#100709]/95 hover:from-[#1b0e10] hover:to-[#13080a] hover:border-[#c5944e]/50 transition-all duration-300 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Top card bar with number and icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-10 h-10 rounded-lg border border-[#3d2427] bg-[#201013] flex items-center justify-center text-[#c5944e] group-hover:border-[#c5944e]/50 transition-colors duration-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs text-[#8c7b6c] tracking-wider">
                      {feat.num}
                    </span>
                  </div>

                  <span className="font-cinzel text-[10px] text-[#c5944e] tracking-[0.2em] uppercase block mb-2 font-medium">
                    {feat.latinTag}
                  </span>

                  <h3 className="font-cinzel text-base sm:text-lg font-bold text-[#ded7cb] mb-3 leading-snug group-hover:text-[#f0cf91] transition-colors">
                    {feat.title}
                  </h3>

                  <p className="text-[#8c8072] text-xs sm:text-sm leading-relaxed font-sans">
                    {feat.desc}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-[#221315] flex items-center justify-between text-xs text-[#c5944e] font-cinzel">
                  <span className="tracking-[0.15em] text-[11px] uppercase">Explore</span>
                  <span className="transform group-hover:translate-x-1.5 transition-transform duration-200">→</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
