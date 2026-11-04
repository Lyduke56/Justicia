'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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
import { DepthCarousel } from './DepthCarousel';
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
 * Desktop (lg+) pinned timeline, in scroll-progress units (0 → 1 across the pinned track).
 *
 *   0.00 – 0.20   ambient glow warms up
 *   0.04 – 0.30   hairline → heading → subtext
 *   0.28 – 0.60   the carousel rises out of the dark and sharpens
 *   0.60 – 1.00   HOLD: everything visible and interactive, still pinned, then the section releases
 *
 * Below lg the section is not pinned and each piece uses a reveal-on-enter animation instead.
 * To make the sequence longer or shorter, change PIN_HEIGHT — the timings are relative.
 */
const PIN_HEIGHT = 'lg:h-[240vh]';

const T = {
  glow: [0, 0.2],
  divider: [0.04, 0.12],
  heading: [0.08, 0.22],
  subtext: [0.16, 0.3],
  carousel: [0.28, 0.6],
} as const;

/**
 * Vertical space (px) reserved inside the carousel box for the carousel's own
 * controls, indicators and 3D perspective. Raise it if the cards touch the controls,
 * lower it if there is too much empty space.
 */
const CAROUSEL_CHROME = 96;

/**
 * Trailing-card look, passed straight to DepthCarousel. The cards right behind the
 * active one stay fairly light and the furthest ones sink into the dark.
 *   TRAIL_FALLOFF: how fast cards fade with distance (lower = trailing cards stay brighter)
 *   TRAIL_BLUR:    blur on trailing cards (lower = sharper)
 *   TRAIL_TINT:    the colour the far cards fade toward
 */
const TRAIL_TINT = '#0d0705';
const TRAIL_FALLOFF = 0.14;
const TRAIL_BLUR = 2;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export interface FeatureItem {
  num: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  latinTag: string;
  desc: string;
  href: string;
}

const FEATURES: FeatureItem[] = [
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

/**
 * Fuller copy for the wide cards. The short `desc` above is still used on narrow cards
 * and on short screens, where there isn't room for more text. Keyed by FeatureItem.num.
 */
const FEATURE_DETAILS: Record<string, { detail: string; points: string[] }> = {
  '01': {
    detail:
      'Ask complex legal questions in English or Filipino and receive clear, structured guidance grounded in codified statutes. Understand where you stand before you decide on your next step.',
    points: [
      'Ask in English or Filipino',
      'Answers grounded in codified Philippine statutes',
      'Instant guidance whenever you need it',
    ],
  },
  '02': {
    detail:
      'Connect with verified Philippine lawyers for formal legal advisory, dispute counsel, and tailored case assessments. Book time with licensed counsel when your situation needs a professional opinion.',
    points: [
      'Licensed attorneys from an accredited network',
      'Advisory, dispute counsel and case assessments',
      'Schedule consultations on the platform',
    ],
  },
  '03': {
    detail:
      'Access authoritative Supreme Court decisions and landmark jurisprudence with automated doctrine mapping. See how a ruling is applied and follow the reasoning behind the law.',
    points: [
      'Landmark Supreme Court decisions',
      'Automated doctrine mapping',
      'Authoritative jurisprudence in one place',
    ],
  },
  '04': {
    detail:
      'Search the 1987 Constitution, Civil Code, Revised Penal Code, Labor Code, and updated Republic Acts. Read the provisions themselves and find the exact rule that applies to you.',
    points: [
      'The 1987 Constitution and the major codes',
      'Updated Philippine Republic Acts',
      'Find the exact provision you need',
    ],
  },
  '05': {
    detail:
      'Upload contracts, deeds, and affidavits for automated clause risk breakdowns, compliance checks, and summaries. Know what you are about to sign before you sign it.',
    points: [
      'Clause-by-clause risk breakdowns',
      'Automated compliance checks',
      'Clear summaries of long documents',
    ],
  },
  '06': {
    detail:
      'Track active legal matters, statutory deadlines, scheduled hearings, case files, and consultation history in one secure portal, instead of scattered across messages and folders.',
    points: [
      'Statutory deadlines and scheduled hearings',
      'Case files kept in one place',
      'Complete consultation history',
    ],
  },
  '07': {
    detail:
      'Exchange end-to-end encrypted messages, legal queries, and evidentiary records directly with your retained counsel in a private channel built for sensitive matters.',
    points: [
      'End-to-end encrypted messages',
      'Share legal queries and evidentiary records',
      'A direct line to your retained counsel',
    ],
  },
  '08': {
    detail:
      'Verify statutory business requirements, employment standards, and consumer rights for proactive legal protection. Spot gaps early, before a problem becomes a dispute.',
    points: [
      'Statutory business requirements',
      'Employment standards',
      'Consumer rights',
    ],
  },
};

// ============================================================================
// Helpers
// ============================================================================

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

/** Measures an element (rounded to 8px steps so tiny changes don't re-render the carousel). */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const step = (n: number) => Math.round(n / 8) * 8;
    const observer = new ResizeObserver(([entry]) => {
      const next = {
        width: step(entry.contentRect.width),
        height: step(entry.contentRect.height),
      };
      setSize((prev) =>
        prev && prev.width === next.width && prev.height === next.height ? prev : next,
      );
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

/**
 * Two-stage reveal: a slow fade while blurred and low, then it sharpens, rises
 * into place and reaches full opacity. Blur resolves to 'none' so finished
 * content isn't left on a filtered layer.
 */
function useReveal(
  progress: MotionValue<number>,
  start: number,
  end: number,
  opts: { y?: number; blur?: number; scaleFrom?: number } = {},
) {
  const { y = 24, blur = 8, scaleFrom = 1 } = opts;
  const opacity = useTransform(progress, [start, start + (end - start) * 0.45, end], [0, 0.3, 1]);
  const yValue = useTransform(progress, [start, end], [y, 0], { ease: revealEase });
  const scale = useTransform(progress, [start, end], [scaleFrom, 1], { ease: revealEase });
  const blurValue = useTransform(progress, [start, end], [blur, 0], { ease: revealEase });
  const filter = useTransform(blurValue, (v) => (v < 0.1 ? 'none' : `blur(${v}px)`));
  return { opacity, y: yValue, scale, filter };
}

type RevealMode = 'scrub' | 'view' | 'static';

interface RevealProps {
  progress: MotionValue<number>;
  start: number;
  end: number;
  mode: RevealMode;
  y?: number;
  blur?: number;
  viewDelay?: number;
  children: React.ReactNode;
}

/**
 * scrub  → tied to scroll progress (desktop, pinned)
 * view   → one-shot reveal when scrolled into view (below lg)
 * static → no motion (prefers-reduced-motion)
 */
function Reveal({ progress, start, end, mode, y = 24, blur = 8, viewDelay = 0, children }: RevealProps) {
  const reveal = useReveal(progress, start, end, { y, blur });

  if (mode === 'static') {
    return <div>{children}</div>;
  }

  if (mode === 'scrub') {
    return (
      <motion.div style={reveal} className="will-change-transform">
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, delay: viewDelay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// Section
// ============================================================================

export function FeaturesSection() {
  const router = useRouter();
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useIsDesktop();
  const [boxRef, box] = useElementSize<HTMLDivElement>();

  const mode: RevealMode = prefersReducedMotion ? 'static' : isDesktop ? 'scrub' : 'view';
  const pinned = !prefersReducedMotion; // the pin itself is CSS (lg: only), see classes below

  // Pinned track (only meaningful at lg+)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Entry track: runs while the section slides up from below, right after About's exit
  const { scrollYProgress: entryProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start start'],
  });

  // Heavy, overdamped spring: deliberate and smooth
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 45, damping: 30, restDelta: 0.0005 });
  const smoothEntry = useSpring(entryProgress, { stiffness: 60, damping: 28, restDelta: 0.0005 });

  // Entry veil: solid #0d0705 (About's exit colour) while sliding up, lifting only at the end,
  // so the library appears once the section has nearly settled and never shows in the gap
  const veilOpacity = useTransform(smoothEntry, [0.7, 1], [1, 0]);

  // Ambient glow: warms up, then drifts slowly
  const glowOpacity = useTransform(smoothProgress, [T.glow[0], T.glow[1]], [0, 1]);
  const glowY = useTransform(smoothProgress, [0, 1], [-30, 30]);

  // Carousel reveal: rises out of the dark. Pointer events stay off until it is mostly visible,
  // so an invisible card can't be clicked mid-reveal.
  const carouselReveal = useReveal(smoothProgress, T.carousel[0], T.carousel[1], {
    y: 60,
    blur: 12,
    scaleFrom: 0.94,
  });
  const carouselPointer = useTransform(smoothProgress, (v) =>
    v < T.carousel[0] + 0.12 ? ('none' as const) : ('auto' as const),
  );

  // Carousel sizing, derived from the space that is actually available.
  // Wide screens get landscape cards that use the horizontal space; narrow screens get portrait cards.
  const landscape = !!box && box.width >= 720;
  const cardH = box ? clamp(box.height - CAROUSEL_CHROME, 320, landscape ? 520 : 460) : 0;
  const cardW = box
    ? landscape
      ? clamp(Math.round(box.width * 0.52), 420, Math.round(cardH * 2.1))
      : clamp(Math.round(cardH * 0.77), 232, Math.min(340, Math.round(box.width * 0.78)))
    : 0;
  const wide = cardW >= 420; // two-panel layout
  const roomy = cardW >= 640; // extra-wide: bigger type and a watermark icon
  const compact = cardH < 390;
  const visibleCards = box && box.width < 640 ? 3 : 4;

  const handleCardClick = (item: FeatureItem) => {
    if (item.href) router.push(item.href);
  };

  const carousel =
    box && cardW > 0 ? (
      <DepthCarousel<FeatureItem>
        items={FEATURES}
        cardWidth={cardW}
        cardHeight={cardH}
        radius={20}
        tint={TRAIL_TINT}
        depth={landscape ? 190 : Math.round(210 * (cardW / 330))}
        spread={Math.round(cardW * (landscape ? 0.2 : 0.28))}
        tilt={20}
        tiltDirection="right"
        perspective={1400}
        visibleCards={visibleCards}
        falloff={TRAIL_FALLOFF}
        blur={TRAIL_BLUR}
        duration={680}
        ease="power3.out"
        autoplay={false}
        loop={true}
        showControls={true}
        showIndicators={true}
        onItemClick={handleCardClick}
        renderItem={(feat, index, isActive) => {
          const Icon = feat.icon;
          const extra = FEATURE_DETAILS[feat.num];
          // Highlights only show when the card is tall enough to hold them without clipping
          const showPoints = cardH >= 440;

          // Shared surface: lighter than the page so trailing cards stay readable against the books
          const surface =
            'group relative h-full w-full select-none overflow-hidden rounded-[inherit] bg-gradient-to-br from-[#2d1a1e] via-[#1e1115] to-[#130a0d] transition-shadow duration-500';
          const outline = isActive
            ? 'shadow-[inset_0_0_0_1px_rgba(197,148,78,0.55)]'
            : 'shadow-[inset_0_0_0_1px_rgba(197,148,78,0.3)]';
          const frame = isActive ? 'border-[#c5944e]/45' : 'border-[#c5944e]/20';

          const warmth = (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(197,148,78,0.16),transparent_65%)] transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-50'
                }`}
            />
          );

          // ---- Wide card: spine plate on the left, text on the right ----
          if (wide) {
            return (
              <div className={`${surface} ${outline}`}>
                {warmth}

                <div
                  className={`absolute inset-2.5 flex overflow-hidden rounded-[10px] border transition-colors duration-500 ${frame}`}
                >
                  {/* Spine plate: gilt volume number and icon between tooled bands */}
                  <div
                    className={`relative flex ${roomy ? 'w-[24%]' : 'w-[28%]'
                      } shrink-0 flex-col items-center justify-center gap-4 border-r border-[#c5944e]/20 bg-[#c5944e]/[0.05]`}
                  >
                    <span aria-hidden="true" className="absolute inset-x-3 top-3 h-px bg-[#c5944e]/30" />
                    <span aria-hidden="true" className="absolute inset-x-3 top-[18px] h-px bg-[#c5944e]/15" />
                    <span aria-hidden="true" className="absolute inset-x-3 bottom-3 h-px bg-[#c5944e]/30" />
                    <span aria-hidden="true" className="absolute inset-x-3 bottom-[18px] h-px bg-[#c5944e]/15" />

                    <span
                      className={`font-cinzel bg-gradient-to-b from-[#ebc07a] to-[#a8742f] bg-clip-text font-medium leading-none text-transparent ${compact ? 'text-[40px]' : roomy ? 'text-[68px]' : 'text-[56px]'
                        }`}
                    >
                      {ROMAN[index]}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px w-10 bg-gradient-to-r from-transparent via-[#c5944e]/60 to-transparent"
                    />
                    <Icon
                      className={`text-[#c5944e]/85 ${compact ? 'h-5 w-5' : roomy ? 'h-7 w-7' : 'h-6 w-6'
                        }`}
                    />
                  </div>

                  {/* Text panel */}
                  <div
                    className={`relative flex min-w-0 flex-1 flex-col overflow-hidden text-left ${compact ? 'px-6 py-5' : roomy ? 'px-14 py-9' : 'px-8 py-7'
                      }`}
                  >
                    {roomy && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-10 -right-8 h-72 w-72 text-[#c5944e]/[0.06]"
                      >
                        <Icon className="h-full w-full" />
                      </span>
                    )}

                    <div className="relative flex flex-1 flex-col justify-center">
                      <span className="font-cinzel mb-2 text-[10.5px] font-medium uppercase tracking-[0.2em] text-[#c5944e]">
                        {feat.latinTag}
                      </span>

                      <h3
                        className={`font-lora font-medium leading-snug text-[#ded7cb] transition-colors group-hover:text-white ${compact ? 'text-[20px]' : roomy ? 'text-[32px]' : 'text-[25px]'
                          }`}
                      >
                        {feat.title}
                      </h3>

                      <div aria-hidden="true" className="my-3 h-px w-12 bg-[#c5944e]/50" />

                      <p
                        className={`font-inter font-light leading-relaxed text-[#a39789] transition-colors group-hover:text-[#b8aba0] ${compact
                          ? 'line-clamp-3 text-[13px]'
                          : roomy
                            ? 'line-clamp-4 max-w-[62ch] text-[16px]'
                            : showPoints
                              ? 'line-clamp-3 text-[14px]'
                              : 'line-clamp-4 text-[14px]'
                          }`}
                      >
                        {compact ? feat.desc : (extra?.detail ?? feat.desc)}
                      </p>

                      {showPoints && extra && (
                        <ul className="mt-4 space-y-1.5 border-t border-[#c5944e]/15 pt-4">
                          {extra.points.slice(0, roomy ? 3 : 2).map((point) => (
                            <li
                              key={point}
                              className={`font-inter flex items-start gap-3 font-light text-[#b8aba0] ${roomy ? 'text-[14px]' : 'text-[12.5px]'
                                }`}
                            >
                              <span
                                aria-hidden="true"
                                className="mt-[0.6em] h-1 w-1 shrink-0 rotate-45 bg-[#c5944e]"
                              />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-3">
                      <span
                        className={`font-cinzel text-[10.5px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${isActive ? 'text-[#f0cf91]' : 'text-[#c5944e]/70 group-hover:text-[#f0cf91]'
                          }`}
                      >
                        Open
                      </span>
                      <span
                        aria-hidden="true"
                        className={`h-px bg-[#c5944e]/60 transition-all duration-500 ${isActive ? 'w-16' : 'w-6'
                          }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // ---- Narrow card: stacked and centred (phones, small windows) ----
          return (
            <div className={`${surface} ${outline}`}>
              {warmth}

              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-2.5 rounded-[10px] border transition-colors duration-500 ${frame}`}
              />

              <div
                className={`relative flex h-full flex-col items-center text-center ${compact ? 'px-5 py-6' : 'px-6 py-8'
                  }`}
              >
                <span
                  className={`font-cinzel bg-gradient-to-b from-[#ebc07a] to-[#a8742f] bg-clip-text font-medium leading-none text-transparent ${compact ? 'text-[34px]' : 'text-[46px]'
                    }`}
                >
                  {ROMAN[index]}
                </span>

                <div
                  aria-hidden="true"
                  className={`flex w-full items-center gap-3 text-[#c5944e]/80 ${compact ? 'my-3' : 'my-4'
                    }`}
                >
                  <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#c5944e]/45" />
                  <Icon className="h-4 w-4" />
                  <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#c5944e]/45" />
                </div>

                <span className="font-cinzel mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[#c5944e]">
                  {feat.latinTag}
                </span>

                <h3
                  className={`font-lora font-medium leading-snug text-[#ded7cb] transition-colors group-hover:text-white ${compact ? 'text-[17px]' : 'text-[20px]'
                    }`}
                >
                  {feat.title}
                </h3>

                <p
                  className={`font-inter mt-3 text-[12.5px] font-light leading-relaxed text-[#a39789] transition-colors group-hover:text-[#b8aba0] ${compact ? 'line-clamp-3' : 'line-clamp-4'
                    }`}
                >
                  {feat.desc}
                </p>

                <span
                  className={`font-cinzel mt-auto border-b pt-3 text-[10.5px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 ${isActive
                    ? 'border-[#c5944e]/60 text-[#f0cf91]'
                    : 'border-transparent text-[#c5944e]/70 group-hover:text-[#f0cf91]'
                    }`}
                >
                  Open
                </span>
              </div>
            </div>
          );
        }}
      />
    ) : null;

  return (
    <section
      ref={containerRef}
      id="features"
      className={`relative bg-[#0d0705] ${pinned ? PIN_HEIGHT : ''}`}
    >
      {/* Frame: pinned to the viewport on lg+ while the sequence plays; normal flow below lg.
          It always fills the screen: pt-24 clears the fixed navbar. */}
      <div
        className={`${pinned ? 'lg:sticky lg:top-0 ' : ''}relative z-10 flex min-h-[100svh] flex-col items-center overflow-hidden bg-[#0d0705] px-4 pb-6 pt-24 sm:px-6 sm:pb-8 lg:h-screen lg:px-8`}
      >
        {/* Bookshelf background stack with spotlight reveal */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <Image
            src="/actual_images/book_bg.png"
            alt="Antique law library bookshelf background"
            fill
            priority={false}
            className="object-cover object-top filter contrast-110 opacity-70"
            sizes="100vw"
          />
          {/* Darkening overlay matching Hero, Motto & About depth */}
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(20, 11, 12, 0.92)' }} />
          <BookshelfSpotlight oversizedClassName="inset-0" />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#0d0705] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#0d0705] to-transparent" />

          {/* Entry veil: lifts at the end of the entry, revealing the library out of darkness */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0 : veilOpacity }}
            className="absolute inset-0 bg-[#0d0705]"
          />
        </div>

        {/* Ambient warmth behind the carousel */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[480px] w-[780px] -translate-x-1/2 -translate-y-1/2">
          <motion.div
            style={{
              opacity: mode === 'scrub' ? glowOpacity : 1,
              y: mode === 'scrub' ? glowY : 0,
            }}
            className="h-full w-full rounded-full bg-[#c5944e]/[0.04] blur-[140px]"
          />
        </div>

        {/* Header */}
        <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
          <Reveal progress={smoothProgress} start={T.divider[0]} end={T.divider[1]} mode={mode} y={0} blur={0}>
            <div className="mb-4 h-px w-14 bg-[#c5944e]/60" />
          </Reveal>

          <Reveal progress={smoothProgress} start={T.heading[0]} end={T.heading[1]} mode={mode} viewDelay={0.06}>
            <h2 className="font-lora text-2xl font-medium leading-tight tracking-wide text-[#ded7cb] sm:text-3xl lg:text-[2.35rem] xl:text-[2.6rem]">
              ELEVATING ACCESS TO <span className="text-[#c5944e]">JUSTICE</span>
            </h2>
          </Reveal>

          <Reveal progress={smoothProgress} start={T.subtext[0]} end={T.subtext[1]} mode={mode} viewDelay={0.12}>
            <p className="font-inter mx-auto mt-2 max-w-lg text-xs font-light leading-relaxed text-[#968b7f] sm:text-sm">
              Combining modern artificial intelligence with verified legal authority to protect your
              constitutional rights.
            </p>
          </Reveal>
        </div>

        {/* Carousel box: takes all the remaining height and a wider max width, so the cards use
            the horizontal space. The carousel only renders once the box has been measured. */}
        <div
          ref={boxRef}
          className="relative z-10 min-h-[420px] w-full max-w-[1800px] flex-1 lg:min-h-[416px]"
        >
          {mode === 'scrub' ? (
            <motion.div
              style={{ ...carouselReveal, pointerEvents: carouselPointer }}
              className="absolute inset-0 will-change-transform"
            >
              {carousel}
            </motion.div>
          ) : mode === 'view' ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              {carousel}
            </motion.div>
          ) : (
            <div className="absolute inset-0">{carousel}</div>
          )}
        </div>
      </div>
    </section>
  );
}