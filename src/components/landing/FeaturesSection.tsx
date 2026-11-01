'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  cubicBezier,
  type MotionValue,
} from 'motion/react';
import { BookshelfSpotlight } from './LibrarySpotlight';
import {
  ScalesLogo,
  PillarsIcon,
  SparklesIcon,
  CalendarIcon,
  BookOpenIcon,
  BriefcaseIcon,
  ChatBubbleIcon,
  ShieldCheckIcon,
} from './LawIcons';

const revealEase = cubicBezier(0.22, 1, 0.36, 1);

/**
 * Desktop (lg+) timeline, in scroll-progress units (0 → 1 across the pinned track).
 *
 *   0.00 – 0.20   ambient glow warms up
 *   0.06 – 0.30   badge → heading → subtext
 *   0.28 – 0.90   the 8 cards, one after another
 *   0.90 – 1.00   HOLD: everything visible, still pinned, then the section releases
 *
 * Below lg the section is not pinned (8 stacked cards are taller than a phone screen)
 * and each item uses the original reveal-on-enter animation instead.
 *
 * To make the sequence longer or shorter, change PIN_HEIGHT — the timings are relative.
 */
const PIN_HEIGHT = 'lg:h-[340vh]';

const T = {
  glow: [0, 0.2],
  badge: [0.06, 0.16],
  heading: [0.12, 0.24],
  subtext: [0.18, 0.3],
} as const;
const CARD_START = 0.28;
const CARD_STEP = 0.065;
const CARD_SPAN = 0.16;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

type RevealMode = 'scrub' | 'view' | 'static';

interface RevealItemProps {
  progress: MotionValue<number>;
  start: number;
  end: number;
  mode: RevealMode;
  y?: number;
  blur?: number;
  scaleFrom?: number;
  viewDelay?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * scrub  → tied to scroll progress (desktop, pinned): slow fade → sharpen + rise
 * view   → original one-shot reveal when scrolled into view (below lg)
 * static → no motion (prefers-reduced-motion)
 */
function RevealItem({
  progress,
  start,
  end,
  mode,
  y = 30,
  blur = 8,
  scaleFrom = 1,
  viewDelay = 0,
  className,
  children,
}: RevealItemProps) {
  const opacity = useTransform(progress, [start, start + (end - start) * 0.45, end], [0, 0.3, 1]);
  const yValue = useTransform(progress, [start, end], [y, 0], { ease: revealEase });
  const scale = useTransform(progress, [start, end], [scaleFrom, 1], { ease: revealEase });
  const blurValue = useTransform(progress, [start, end], [blur, 0], { ease: revealEase });
  const filter = useTransform(blurValue, (v) => (v < 0.1 ? 'none' : `blur(${v}px)`));

  if (mode === 'static') {
    return <div className={className}>{children}</div>;
  }

  if (mode === 'scrub') {
    return (
      <motion.div
        key="scrub"
        style={{ opacity, y: yValue, scale, filter }}
        className={`${className ?? ''} will-change-transform`}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      key="view"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: viewDelay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FeaturesSection() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useIsDesktop();

  const mode: RevealMode = prefersReducedMotion ? 'static' : isDesktop ? 'scrub' : 'view';
  const pinned = !prefersReducedMotion; // the pin itself is CSS (lg: only), see classes below

  // Pinned track (only meaningful at lg+)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Heavy, overdamped spring: deliberate and smooth, so fast scrolling can't skip cards
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 45,
    damping: 30,
    restDelta: 0.0005,
  });

  // Ambient glow: warms up, then drifts slowly (farthest layer)
  const glowOpacity = useTransform(smoothProgress, [T.glow[0], T.glow[1]], [0, 1]);
  const glowY = useTransform(smoothProgress, [0, 1], [-30, 30]);

  const features = [
    {
      num: '01',
      icon: SparklesIcon,
      title: 'AI Philippine Law Guide',
      latinTag: 'Lex Informatio',
      desc: 'Ask complex legal questions in English or Filipino. Receive clear, structured guidance grounded in codified statutes.',
      href: '/chat',
    },
    {
      num: '02',
      icon: CalendarIcon,
      title: 'Attorney Consultations',
      latinTag: 'Advocatus Fidelis',
      desc: 'Connect with verified Philippine lawyers for formal legal advisory, dispute counsel, and tailored case assessments.',
      href: '/consultations',
    },
    {
      num: '03',
      icon: PillarsIcon,
      title: 'Supreme Court Precedents',
      latinTag: 'Stare Decisis',
      desc: 'Access authoritative Supreme Court decisions and landmark jurisprudence with automated doctrine mapping.',
      href: '/client/legal-research/jurisprudence',
    },
    {
      num: '04',
      icon: BookOpenIcon,
      title: 'Codified Statutes Library',
      latinTag: 'Corpus Juris',
      desc: 'Search the 1987 Constitution, Civil Code, Revised Penal Code, Labor Code, and updated Philippine Republic Acts.',
      href: '/client/legal-research/laws',
    },
    {
      num: '05',
      icon: ScalesLogo,
      title: 'Smart Document Analysis',
      latinTag: 'Instrumentum Iuris',
      desc: 'Upload contracts, deeds, and affidavits for automated clause risk breakdowns, compliance checks, and summaries.',
      href: '/client/documents',
    },
    {
      num: '06',
      icon: BriefcaseIcon,
      title: 'Case Management Hub',
      latinTag: 'Actio Legalis',
      desc: 'Track active legal matters, statutory deadlines, scheduled hearings, case files, and consultation history in one secure portal.',
      href: '/client/cases',
    },
    {
      num: '07',
      icon: ChatBubbleIcon,
      title: 'Confidential Client Messaging',
      latinTag: 'Secretum Iuris',
      desc: 'Exchange end-to-end encrypted messages, legal queries, and evidentiary records directly with your retained counsel.',
      href: '/client/messages',
    },
    {
      num: '08',
      icon: ShieldCheckIcon,
      title: 'Compliance & Rights Audit',
      latinTag: 'Iuris Regula',
      desc: 'Verify statutory business requirements, employment standards, and consumer rights to ensure proactive legal protection.',
      href: '/client/legal-research',
    },
  ];

  return (
    <section
      ref={containerRef}
      id="features"
      className={`relative bg-[#0d0705] ${pinned ? PIN_HEIGHT : ''}`}
    >
      {/* Frame: pinned to the viewport on lg+ while the sequence plays; normal flow below lg */}
      <div
        className={`${pinned ? 'lg:sticky lg:top-0 ' : ''
          }relative min-h-screen lg:h-screen lg:max-h-screen flex flex-col justify-center py-16 sm:py-20 lg:py-6 px-6 sm:px-8 lg:px-12 bg-[#0d0705] overflow-hidden z-10`}
      >
        {/* Bookshelf Background Stack with Spotlight Reveal */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Image
            src="/actual_images/book_bg.png"
            alt="Antique law library bookshelf background"
            fill
            priority={false}
            className="object-cover object-top filter contrast-110 opacity-70"
            sizes="100vw"
          />
          {/* Darkening overlay matching Hero & Motto depth */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(20, 11, 12, 0.92)' }}
          />
          {/* Bookshelf Spotlight Reveal */}
          <BookshelfSpotlight
            containerRef={containerRef}
            oversizedClassName="inset-0"
          />
        </div>

        {/* Subtle ambient lighting — outer div positions, inner div carries the parallax */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[450px] pointer-events-none">
          <motion.div
            style={{
              opacity: mode === 'scrub' ? glowOpacity : 1,
              y: mode === 'scrub' ? glowY : 0,
            }}
            className="w-full h-full bg-[#c5944e]/[0.035] blur-[140px] rounded-full"
          />
        </div>
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0d0705] to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0d0705] to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          {/* Section Header - balanced for single screen view */}
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-7 lg:mb-6 space-y-2">
            <RevealItem
              progress={smoothProgress}
              start={T.badge[0]}
              end={T.badge[1]}
              mode={mode}
              y={15}
              blur={6}
            >
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full border border-[#c5944e]/30 bg-[#c5944e]/[0.06] text-[#c5944e] font-cinzel text-[10px] sm:text-[10.5px] tracking-[0.2em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c5944e] animate-pulse" />
                Platform Capabilities
              </div>
            </RevealItem>

            <RevealItem
              progress={smoothProgress}
              start={T.heading[0]}
              end={T.heading[1]}
              mode={mode}
              viewDelay={0.08}
            >
              <h2 className="font-lora text-2xl sm:text-3xl lg:text-[2.25rem] xl:text-[2.5rem] font-medium text-[#ded7cb] tracking-wide leading-tight">
                ELEVATING ACCESS TO <span className="text-[#c5944e]">JUSTICE</span>
              </h2>
            </RevealItem>

            <RevealItem
              progress={smoothProgress}
              start={T.subtext[0]}
              end={T.subtext[1]}
              mode={mode}
              viewDelay={0.14}
            >
              <p className="text-[#968b7f] text-xs sm:text-sm font-inter font-light max-w-lg mx-auto leading-relaxed">
                Combining modern artificial intelligence with verified legal authority to protect your constitutional rights.
              </p>
            </RevealItem>
          </div>

          {/* Feature Cards Grid: 8 interactive capabilities */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-3.5 xl:gap-4.5">
            {features.map((feat, index) => {
              const Icon = feat.icon;
              const start = CARD_START + index * CARD_STEP;

              return (
                <RevealItem
                  key={feat.num}
                  progress={smoothProgress}
                  start={start}
                  end={start + CARD_SPAN}
                  mode={mode}
                  y={34}
                  blur={10}
                  scaleFrom={0.97}
                  viewDelay={(index % 2) * 0.06}
                  className="h-full"
                >
                  <Link
                    href={feat.href}
                    className="group relative h-full p-4 sm:p-4.5 lg:p-4 xl:p-4.5 rounded-xl border border-[#301c1e]/60 hover:border-[#c5944e]/60 bg-gradient-to-b from-[#180e10]/90 via-[#13090b]/90 to-[#0e0608]/95 hover:from-[#201215] hover:to-[#14080b] transition-all duration-300 shadow-lg hover:shadow-[0_16px_32px_-12px_rgba(0,0,0,0.85),0_0_20px_-5px_rgba(197,148,78,0.12)] hover:-translate-y-1 flex flex-col justify-between overflow-hidden block"
                  >
                    {/* Subtle top hairline accent */}
                    <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#c5944e]/30 to-transparent group-hover:via-[#c5944e] transition-all duration-300" />

                    <div>
                      {/* Top card bar with icon and number */}
                      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                        <div className="w-8 h-8 rounded-lg border border-[#3e2723]/60 bg-[#1e1012] group-hover:border-[#c5944e]/60 group-hover:bg-[#281518] flex items-center justify-center text-[#c5944e] group-hover:text-[#f0cf91] group-hover:scale-105 transition-all duration-300 shadow-inner">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-cinzel text-[11px] text-[#8c7b6c] group-hover:text-[#c5944e] tracking-widest font-semibold transition-colors">
                          {feat.num}
                        </span>
                      </div>

                      <span className="font-cinzel text-[9.5px] text-[#c5944e] tracking-[0.18em] uppercase block mb-1 font-medium">
                        {feat.latinTag}
                      </span>

                      <h3 className="font-lora text-[14.5px] lg:text-[14.5px] xl:text-[15.5px] font-medium text-[#ded7cb] mb-1 leading-snug group-hover:text-white transition-colors">
                        {feat.title}
                      </h3>

                      <p className="text-[#968b7f] text-[11.5px] sm:text-xs xl:text-[12px] font-inter font-light leading-relaxed group-hover:text-[#b8aba0] transition-colors line-clamp-2">
                        {feat.desc}
                      </p>
                    </div>

                    {/* Card bottom action bar */}
                    <div className="mt-3 pt-2 border-t border-[#251517] group-hover:border-[#c5944e]/30 flex items-center justify-between text-xs text-[#c5944e] font-cinzel transition-colors">
                      <span className="tracking-[0.16em] text-[10px] uppercase font-medium group-hover:text-[#f0cf91]">
                        Explore
                      </span>
                      <span className="transform group-hover:translate-x-1.5 transition-transform duration-200 text-xs">
                        →
                      </span>
                    </div>
                  </Link>
                </RevealItem>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}