'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  motion,
  animate,
  useInView,
  useMotionValue,
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
const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Desktop (lg+) pinned timeline, in scroll-progress units (0 → 1 across the pinned track).
 *
 *   0.00 – 0.20   ambient glow warms up
 *   0.04 – 0.30   hairline draws → heading word by word → subtext
 *   0.26 – 0.48   the active card rises out of the dark
 *   0.40 – 0.64   the rest of the deck fans out from behind it
 *   0.64 – 1.00   HOLD: everything visible and interactive, still pinned, then the section releases
 *
 * Below lg the section is not pinned and each piece reveals once when scrolled into view.
 * To make the sequence longer or shorter, change PIN_HEIGHT — the timings are relative.
 */
const PIN_HEIGHT = 'lg:h-[250vh]';

const T = {
  glow: [0, 0.2],
  divider: [0.04, 0.12],
  heading: [0.08, 0.24],
  subtext: [0.18, 0.3],
  carousel: [0.26, 0.48],
  fan: [0.4, 0.64],
} as const;

/** Where the navbar's FEATURES link lands inside the pinned track (fully revealed). */
const NAV_LANDING = T.fan[1] + 0.02;

/** Height (px) reserved under the cards for the position bar (32px + margin). */
const CAROUSEL_CHROME = 56;

/** Colour the receding cards darken toward (the page background). */
const TRAIL_TINT = '#0d0705';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const HEADING_WORDS = [
  { word: 'ELEVATING', gold: false },
  { word: 'ACCESS', gold: false },
  { word: 'TO', gold: false },
  { word: 'JUSTICE', gold: true },
];

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
  opts: { y?: number; blur?: number } = {},
) {
  const { y = 24, blur = 8 } = opts;
  const opacity = useTransform(progress, [start, start + (end - start) * 0.45, end], [0, 0.3, 1]);
  const yValue = useTransform(progress, [start, end], [y, 0], { ease: revealEase });
  const blurValue = useTransform(progress, [start, end], [blur, 0], { ease: revealEase });
  const filter = useTransform(blurValue, (v) => (v < 0.1 ? 'none' : `blur(${v}px)`));
  return { opacity, y: yValue, filter };
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
  className?: string;
  children: React.ReactNode;
}

/**
 * scrub  → tied to scroll progress (desktop, pinned)
 * view   → one-shot reveal when scrolled into view (below lg)
 * static → no motion (prefers-reduced-motion)
 */
function Reveal({
  progress,
  start,
  end,
  mode,
  y = 24,
  blur = 8,
  viewDelay = 0,
  className = '',
  children,
}: RevealProps) {
  const reveal = useReveal(progress, start, end, { y, blur });

  if (mode === 'static') {
    return <div className={className}>{children}</div>;
  }

  if (mode === 'scrub') {
    return (
      <motion.div style={reveal} className={`will-change-transform ${className}`}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: `blur(${blur}px)` }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, delay: viewDelay, ease: EASE_OUT_EXPO }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** One word of the section heading. Words arrive one after another, like the Motto. */
function HeadingWord({
  word,
  gold,
  index,
  total,
  progress,
  mode,
}: {
  word: string;
  gold: boolean;
  index: number;
  total: number;
  progress: MotionValue<number>;
  mode: RevealMode;
}) {
  const span = (T.heading[1] - T.heading[0]) / total;
  const start = T.heading[0] + index * span;
  const reveal = useReveal(progress, start, Math.min(start + span * 2, T.heading[1] + 0.04), {
    y: 22,
    blur: 10,
  });
  const cls = `inline-block ${gold ? 'text-[#c5944e]' : ''}`;

  if (mode === 'static') return <span className={cls}>{word}</span>;

  if (mode === 'scrub') {
    return (
      <motion.span style={reveal} className={`${cls} will-change-transform`}>
        {word}
      </motion.span>
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.9, delay: 0.05 + index * 0.09, ease: EASE_OUT_EXPO }}
      className={cls}
    >
      {word}
    </motion.span>
  );
}

// ============================================================================
// Card
// ============================================================================

const SEAL_MAXIM = 'NEMO EST SUPRA LEGES · JUSTICIA · NEMO EST SUPRA LEGES · JUSTICIA · ';
const SEAL_TEXT_RADIUS = 76;

/**
 * The Justicia seal: gilt rings with the maxim running between them, and the feature's
 * icon and numeral in the centre. SVG, so it stays crisp at any size. The ring of text
 * turns very slowly on the front card.
 */
function Seal({
  size,
  icon: Icon,
  numeral,
  turning,
}: {
  size: number;
  icon: FeatureItem['icon'];
  numeral: string;
  turning: boolean;
}) {
  const pathId = `seal-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const circumference = 2 * Math.PI * SEAL_TEXT_RADIUS;
  const r = SEAL_TEXT_RADIUS;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Rings */}
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="100" cy="100" r="97" fill="none" stroke="#c5944e" strokeOpacity="0.55" strokeWidth="0.8" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="#c5944e" strokeOpacity="0.2" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="66" fill="none" stroke="#c5944e" strokeOpacity="0.5" strokeWidth="0.8" />
        <circle
          cx="100"
          cy="100"
          r="60"
          fill="none"
          stroke="#c5944e"
          strokeOpacity="0.28"
          strokeWidth="2.4"
          strokeDasharray="0.6 3.4"
        />
      </svg>

      {/* Maxim ring (turns on its own layer, so it costs nothing to animate) */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full motion-safe:animate-[spin_140s_linear_infinite] ${
          turning ? '' : '[animation-play-state:paused]'
        }`}
      >
        <defs>
          <path
            id={pathId}
            d={`M 100,100 m -${r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`}
          />
        </defs>
        <text className="font-cinzel" fontSize="8.4" fill="#c5944e" fillOpacity="0.85">
          <textPath href={`#${pathId}`} textLength={circumference - 4} lengthAdjust="spacing">
            {SEAL_MAXIM}
          </textPath>
        </text>
      </svg>

      {/* Centre: icon over numeral */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-[#d9a95f]">
        <Icon className="h-[16%] w-[16%]" />
        <span
          className="font-cormorant-unicase mt-[5%] leading-none text-[#e2b36d]"
          style={{ fontSize: Math.round(size * 0.11) }}
        >
          {numeral}
        </span>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  feat: FeatureItem;
  index: number;
  isActive: boolean;
  cardW: number;
  cardH: number;
}

/**
 * A plate in the page's own materials: warm near-black, one gold hairline, lamp light
 * from above. Only the front card shows its contents; the cards behind it stay as quiet
 * plates, so the side cards never show clipped text.
 *
 * Every state change animates opacity or transform only, which the browser can do
 * without repainting the card, so sliding stays smooth.
 */
function FeatureCard({ feat, index, isActive, cardW, cardH }: FeatureCardProps) {
  const extra = FEATURE_DETAILS[feat.num];
  const wide = cardW >= 520;
  const roomy = cardW >= 760;
  const compact = cardH < 360;
  const pointCount = !wide || cardH < 380 ? 0 : cardH >= 440 && roomy ? 3 : 2;

  /** Front card: content rises in, staggered. Leaving: it fades out quickly. */
  const reveal = (delay: string) =>
    `transition-[opacity,translate] ease-[cubic-bezier(0.22,1,0.36,1)] ${
      isActive ? `translate-y-0 opacity-100 duration-700 ${delay}` : 'translate-y-3 opacity-0 duration-300 delay-0'
    } motion-reduce:translate-y-0`;

  const sealReveal = `transition-[opacity,scale] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    isActive ? 'scale-100 opacity-100 duration-1000' : 'scale-95 opacity-0 duration-300'
  } motion-reduce:scale-100`;

  const surface =
    'group relative h-full w-full select-none overflow-hidden rounded-[inherit] bg-[#130c0a]';

  const layers = (
    <>
      {/* Lamp light from above */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(110%_90%_at_25%_0%,rgba(197,148,78,0.11),transparent_60%)]"
      />
      {/* Weight at the bottom edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.35),transparent_45%)]"
      />
      {/* Hairline border with a faint lit top edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-[#c5944e]/[0.22] shadow-[inset_0_1px_0_rgba(240,207,145,0.07)]"
      />
      {/* Gilt line along the top: draws outward when the card comes to the front */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-12 top-0 h-px origin-center bg-gradient-to-r from-transparent via-[#f0cf91] to-transparent transition-[scale,opacity] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isActive ? 'scale-x-100 opacity-100 duration-1000' : 'scale-x-0 opacity-0 duration-300'
        }`}
      />
    </>
  );

  const explore = (
    <span className="inline-flex items-center gap-3">
      <span className="font-cinzel text-[10.5px] font-medium uppercase tracking-[0.24em] text-[#e2b36d]">
        Explore
      </span>
      <span
        aria-hidden="true"
        className="relative block h-px w-10 bg-[#c5944e]/60 transition-transform duration-500 ease-out group-hover:translate-x-1.5"
      >
        <span className="absolute -right-px -top-[3px] h-[7px] w-[7px] rotate-45 border-r border-t border-[#c5944e]/90" />
      </span>
    </span>
  );

  // ---- Wide card: seal on the left, text on the right ----
  if (wide) {
    const sealSize = Math.round(Math.min(cardW * 0.36 - 48, cardH * 0.62, 280));
    const pad = compact ? 'py-7 pl-8 pr-9' : roomy ? 'py-10 pl-11 pr-12' : 'py-8 pl-9 pr-10';

    return (
      <div className={surface}>
        {layers}

        <div className="relative flex h-full">
          {/* Seal column */}
          <div className="relative flex w-[36%] shrink-0 items-center justify-center">
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-[radial-gradient(closest-side,rgba(197,148,78,0.1),transparent)] ${sealReveal}`}
            />
            <div className={sealReveal}>
              <Seal size={sealSize} icon={feat.icon} numeral={ROMAN[index]} turning={isActive} />
            </div>
          </div>

          <span
            aria-hidden="true"
            className="my-10 w-px shrink-0 bg-gradient-to-b from-transparent via-[#c5944e]/[0.22] to-transparent"
          />

          {/* Text column */}
          <div className={`flex min-w-0 flex-1 flex-col justify-center text-left ${pad}`}>
            <div className={`flex items-center gap-3 ${reveal('delay-100')}`}>
              <span aria-hidden="true" className="h-px w-8 bg-[#c5944e]/60" />
              <span className="font-cinzel text-[10.5px] font-medium uppercase tracking-[0.26em] text-[#c5944e]">
                {feat.latinTag}
              </span>
            </div>

            <h3
              className={`font-lora mt-3 font-medium leading-snug text-[#ece3d3] ${reveal('delay-150')} ${
                compact ? 'text-[21px]' : roomy ? 'text-[29px]' : 'text-[25px]'
              }`}
            >
              {feat.title}
            </h3>

            <p
              className={`font-inter mt-3 line-clamp-3 font-light leading-relaxed text-[#a69c8f] ${reveal('delay-200')} ${
                compact ? 'text-[13.5px]' : roomy ? 'max-w-[56ch] text-[15.5px]' : 'text-[14.5px]'
              }`}
            >
              {extra?.detail ?? feat.desc}
            </p>

            {pointCount > 0 && extra && (
              <ul className={`mt-5 space-y-2 ${reveal('delay-300')}`}>
                {extra.points.slice(0, pointCount).map((point) => (
                  <li
                    key={point}
                    className={`font-inter flex items-start gap-3 font-light text-[#bdb1a4] ${
                      roomy ? 'text-[13.5px]' : 'text-[13px]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[0.55em] h-[5px] w-[5px] shrink-0 rotate-45 border border-[#c5944e]/80"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className={`${compact ? 'mt-6' : 'mt-7'} ${reveal('delay-300')}`}>{explore}</div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Narrow card: seal on top, centred text (phones, small windows) ----
  return (
    <div className={surface}>
      {layers}

      <div
        className={`relative flex h-full flex-col items-center text-center ${
          compact ? 'px-5 pb-5 pt-6' : 'px-6 pb-6 pt-8'
        }`}
      >
        <div className={sealReveal}>
          <Seal size={compact ? 92 : 112} icon={feat.icon} numeral={ROMAN[index]} turning={isActive} />
        </div>

        <div className={`mt-5 flex items-center gap-3 ${reveal('delay-100')}`}>
          <span aria-hidden="true" className="h-px w-5 bg-[#c5944e]/50" />
          <span className="font-cinzel text-[10px] font-medium uppercase tracking-[0.24em] text-[#c5944e]">
            {feat.latinTag}
          </span>
          <span aria-hidden="true" className="h-px w-5 bg-[#c5944e]/50" />
        </div>

        <h3
          className={`font-lora mt-2 font-medium leading-snug text-[#ece3d3] ${reveal('delay-150')} ${
            compact ? 'text-[18px]' : 'text-[20px]'
          }`}
        >
          {feat.title}
        </h3>

        <p
          className={`font-inter mt-3 text-[13px] font-light leading-relaxed text-[#a69c8f] ${reveal('delay-200')} ${
            compact ? 'line-clamp-2' : 'line-clamp-3'
          }`}
        >
          {feat.desc}
        </p>

        <div className={`mt-auto pt-4 ${reveal('delay-300')}`}>{explore}</div>
      </div>
    </div>
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

  // Hairline above the heading draws outward
  const dividerScale = useTransform(smoothProgress, [T.divider[0], T.divider[1]], [0, 1], {
    ease: revealEase,
  });

  // Carousel reveal: the front card rises out of the dark (opacity + position only; a blur
  // here would make the browser repaint the whole deck on every scroll frame).
  // Pointer events stay off until it is mostly visible, so an invisible card can't be clicked.
  const carouselReveal = useReveal(smoothProgress, T.carousel[0], T.carousel[1], { y: 60, blur: 0 });
  const carouselPointer = useTransform(smoothProgress, (v) =>
    v < T.carousel[0] + 0.12 ? ('none' as const) : ('auto' as const),
  );

  // Fan-out: the rest of the deck slides out from behind the front card.
  // Scrubbed on desktop; played once on entry below lg.
  const fanScrub = useTransform(smoothProgress, [T.fan[0], T.fan[1]], [0, 1], { ease: revealEase });
  const fanView = useMotionValue(0);
  const boxInView = useInView(boxRef, { once: true, amount: 0.35 });

  useEffect(() => {
    if (mode !== 'view' || !boxInView) return;
    const controls = animate(fanView, 1, { duration: 1.4, delay: 0.35, ease: EASE_OUT_EXPO });
    return () => controls.stop();
  }, [mode, boxInView, fanView]);

  const fan = mode === 'scrub' ? fanScrub : mode === 'view' ? fanView : undefined;

  // Carousel sizing, derived from the space that is actually available.
  // Wide screens get landscape cards; narrow screens get portrait cards.
  const landscape = !!box && box.width >= 760;
  const cardH = box ? clamp(box.height - CAROUSEL_CHROME, 320, landscape ? 460 : 440) : 0;
  const cardW = box
    ? landscape
      ? clamp(Math.round(box.width * 0.5), 560, Math.min(880, Math.round(cardH * 1.95)))
      : clamp(Math.round(cardH * 0.76), 250, Math.min(330, Math.round(box.width * 0.84)))
    : 0;

  const handleCardClick = (item: FeatureItem) => {
    if (item.href) router.push(item.href);
  };

  const carousel =
    box && cardW > 0 ? (
      <DepthCarousel<FeatureItem>
        items={FEATURES}
        arrangement="centered"
        ariaLabel="Justicia features"
        cardWidth={cardW}
        cardHeight={cardH}
        radius={12}
        tint={TRAIL_TINT}
        depth={landscape ? 140 : 120}
        spread={Math.round(cardW * (landscape ? 0.2 : 0.24))}
        tilt={10}
        perspective={1600}
        visibleCards={1}
        falloff={0.5}
        blur={0}
        duration={900}
        ease="power4.out"
        autoplay={false}
        loop={true}
        showControls={true}
        showIndicators={true}
        reveal={fan}
        onItemClick={handleCardClick}
        renderItem={(feat, index, isActive) => (
          <FeatureCard feat={feat} index={index} isActive={isActive} cardW={cardW} cardH={cardH} />
        )}
      />
    ) : null;

  return (
    <section
      ref={containerRef}
      id="features"
      data-nav-landing={NAV_LANDING}
      className={`relative bg-[#0d0705] ${pinned ? PIN_HEIGHT : ''}`}
    >
      {/* Frame: pinned to the viewport on lg+ while the sequence plays; normal flow below lg.
          Equal space above and below, and the heading + deck are centred as one group, so
          the composition sits in the middle of the screen. The top space also clears the navbar. */}
      <div
        className={`${pinned ? 'lg:sticky lg:top-0 ' : ''}relative z-10 flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#0d0705] px-4 py-20 sm:px-6 sm:py-24 lg:h-screen lg:px-8 lg:py-[clamp(4.5rem,10vh,6rem)]`}
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

          {/* Floor shadow under the deck so the cards sit in the room rather than on top of it */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-[radial-gradient(60%_55%_at_50%_70%,rgba(0,0,0,0.5),transparent_70%)]" />

          {/* Entry veil: lifts at the end of the entry, revealing the library out of darkness */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0 : veilOpacity }}
            className="absolute inset-0 bg-[#0d0705]"
          />
        </div>

        {/* Ambient warmth behind the deck */}
        <div className="pointer-events-none absolute left-1/2 top-[58%] z-0 h-[520px] w-[900px] -translate-x-1/2 -translate-y-1/2">
          <motion.div
            style={{
              opacity: mode === 'scrub' ? glowOpacity : 1,
              y: mode === 'scrub' ? glowY : 0,
            }}
            className="h-full w-full rounded-full bg-[#c5944e]/[0.05] blur-[140px]"
          />
        </div>

        {/* Header */}
        <div className="relative z-10 flex w-full max-w-3xl shrink-0 flex-col items-center text-center">
          {mode === 'scrub' ? (
            <motion.div style={{ scaleX: dividerScale }} className="mb-5 h-px w-16 origin-center bg-[#c5944e]/60" />
          ) : mode === 'view' ? (
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: EASE_OUT_EXPO }}
              className="mb-5 h-px w-16 origin-center bg-[#c5944e]/60"
            />
          ) : (
            <div className="mb-5 h-px w-16 bg-[#c5944e]/60" />
          )}

          <h2 className="font-lora flex flex-wrap justify-center gap-x-[0.3em] text-2xl font-medium leading-tight tracking-wide text-[#ded7cb] sm:text-3xl lg:text-[2.35rem] xl:text-[2.6rem]">
            {HEADING_WORDS.map((w, i) => (
              <HeadingWord
                key={w.word}
                word={w.word}
                gold={w.gold}
                index={i}
                total={HEADING_WORDS.length}
                progress={smoothProgress}
                mode={mode}
              />
            ))}
          </h2>

          <Reveal progress={smoothProgress} start={T.subtext[0]} end={T.subtext[1]} mode={mode} viewDelay={0.35}>
            <p className="font-inter mx-auto mt-3 max-w-3xl text-xs font-light leading-relaxed text-[#968b7f] sm:text-sm">
              Combining modern artificial intelligence with verified legal authority to protect your
              constitutional rights.
            </p>
          </Reveal>
        </div>

        {/* Carousel box: grows into the remaining height (capped, so tall screens keep the
            group centred instead of stretching the deck). Renders once it has been measured. */}
        <div
          ref={boxRef}
          className="relative z-10 mt-6 min-h-[400px] w-full max-w-[1800px] flex-1 lg:mt-8 lg:max-h-[600px] lg:min-h-0"
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
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 1, delay: 0.1, ease: EASE_OUT_EXPO }}
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
