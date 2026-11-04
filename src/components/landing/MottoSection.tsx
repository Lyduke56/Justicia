'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
  cubicBezier,
  type MotionValue,
} from 'motion/react';
import { BookshelfSpotlight } from './LibrarySpotlight';

const revealEase = cubicBezier(0.22, 1, 0.36, 1);

/**
 * Pinned timeline, in scroll-progress units (0 → 1 across the pinned track).
 *
 *   0.00 – 0.10   background settles in (veil already lifted during entry)
 *   0.10 – 0.18   top hairline draws
 *   0.18 – 0.65   NEMO → EST → SUPRA → LEGES, one after another
 *   0.67 – 0.92   "No one is above the law." word by word
 *   0.88 – 0.94   bottom hairline draws
 *   0.94 – 1.00   HOLD: everything is visible, the section stays pinned, then releases
 *
 * After the pin releases, an exit phase dims the library into #0d0705 so no books
 * are visible in the gap between this section and the next.
 *
 * To make the whole sequence longer or shorter, change the section height below
 * (SECTION_HEIGHT) — the timings are relative, so nothing else needs editing.
 */
const SECTION_HEIGHT = 'h-[380vh] sm:h-[410vh]';

const MAXIM_WORDS = [
  { word: 'NEMO', start: 0.18, end: 0.33, isGold: false },
  { word: 'EST', start: 0.28, end: 0.43, isGold: true },
  { word: 'SUPRA', start: 0.4, end: 0.55, isGold: false },
  { word: 'LEGES', start: 0.5, end: 0.65, isGold: false },
];

const SUBTITLE_WORDS = ['No', 'one', 'is', 'above', 'the', 'law.'].map((word, i) => ({
  word,
  start: 0.67 + i * 0.03,
  end: 0.77 + i * 0.03,
  isGold: i < 2,
}));

interface PinnedMottoWordProps {
  word: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  className?: string;
  isGold?: boolean;
  /** CSS drop-shadow value. Kept inside the animated filter so it isn't overridden by the blur. */
  shadow: string;
  prefersReducedMotion: boolean | null;
}

function PinnedMottoWord({
  word,
  progress,
  start,
  end,
  className,
  isGold = false,
  shadow,
  prefersReducedMotion,
}: PinnedMottoWordProps) {
  const span = end - start;

  // Stage 1 (first ~45% of the word's window): a slow fade-in while still heavily blurred and low.
  // Stage 2 (rest): the word sharpens, rises into place and reaches full opacity.
  const opacity = useTransform(progress, [start, start + span * 0.45, end], [0, 0.3, 1]);
  const y = useTransform(progress, [start, end], [28, 0], { ease: revealEase });
  const blur = useTransform(progress, [start, end], [14, 0], { ease: revealEase });
  const filter = useMotionTemplate`blur(${blur}px) drop-shadow(${shadow})`;

  // Warm highlight that peaks mid-reveal and settles back to the base colour
  const mid = (start + end) / 2;
  const glow = useTransform(progress, [start, mid, end], [0, 1, 0]);
  const baseColor = isGold ? '#c5944e' : '#ded7cb';
  const glowColor = isGold ? '#f0c580' : '#f5ede0';
  const color = useTransform(glow, [0, 1], [baseColor, glowColor]);

  if (prefersReducedMotion) {
    return (
      <span
        style={{ filter: `drop-shadow(${shadow})` }}
        className={`${className ?? ''} ${isGold ? 'text-[#c5944e]' : 'text-[#ded7cb]'}`}
      >
        {word}
      </span>
    );
  }

  return (
    <motion.span
      style={{ opacity, y, filter, color }}
      className={`inline-block will-change-transform ${className ?? ''}`}
    >
      {word}
    </motion.span>
  );
}

const MAXIM_CLASS =
  'font-cormorant-unicase text-4xl xs:text-5xl sm:text-7xl md:text-8xl lg:text-[8rem] xl:text-[9rem] 2xl:text-[10rem] font-medium tracking-[0.04em] leading-[1.02]';
const MAXIM_SHADOW = '0 4px 30px rgba(0,0,0,0.8)';

const SUBTITLE_CLASS =
  'font-cormorant-unicase text-xl sm:text-2xl md:text-4xl lg:text-[2.75rem] xl:text-[3.25rem] font-normal tracking-wide';
const SUBTITLE_SHADOW = '0 2px 20px rgba(0,0,0,0.8)';

export function MottoSection() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Pinned track: the sticky frame holds the screen until every word has been revealed
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Entry track: runs while the section slides up from below, i.e. right after the hero's exit.
  // This is what carries the hand-off from the hero's darkness into the library.
  const { scrollYProgress: entryProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start start'],
  });

  // Exit track: runs while the section scrolls away after unpinning (into About).
  const { scrollYProgress: exitProgress } = useScroll({
    target: containerRef,
    offset: ['end end', 'end start'],
  });

  // Heavy, overdamped spring: deliberate and smooth, so fast scrolling can't skip words
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 40,
    damping: 30,
    restDelta: 0.0005,
  });
  const smoothEntry = useSpring(entryProgress, {
    stiffness: 60,
    damping: 28,
    restDelta: 0.0005,
  });
  const smoothExit = useSpring(exitProgress, {
    stiffness: 60,
    damping: 28,
    restDelta: 0.0005,
  });

  // Veil: starts as solid #0d0705 (the hero's final colour) and lifts during entry,
  // so the library bookshelf emerges out of the dark before the pin even begins
  const veilOpacity = useTransform(smoothEntry, [0.1, 1], [1, 0]);

  // Exit dim: sinks the library into #0d0705 as the section leaves,
  // so no books are visible in the gap between Motto and About
  const exitDim = useTransform(smoothExit, [0, 0.6], [0, 1]);

  // Background: slow settle while pinned (subtle push-in + upward drift)
  const bgScale = useTransform(smoothProgress, [0, 1], [1.02, 1.1]);
  const bgY = useTransform(smoothProgress, [0, 1], ['0%', '-5%']);

  // Warm spotlight behind the maxim, fades up as the words arrive
  const spotlightOpacity = useTransform(smoothProgress, [0.12, 0.5, 0.95], [0, 1, 0.7]);

  // Slow cinematic dolly on the whole text block
  const contentScale = useTransform(smoothProgress, [0, 1], [0.97, 1.03]);

  // Hairline dividers
  const topDividerScaleX = useTransform(smoothProgress, [0.1, 0.18], [0, 1]);
  const topDividerOpacity = useTransform(smoothProgress, [0.1, 0.18], [0, 1]);
  const bottomDividerScaleX = useTransform(smoothProgress, [0.88, 0.94], [0, 1]);
  const bottomDividerOpacity = useTransform(smoothProgress, [0.88, 0.94], [0, 1]);

  return (
    <section
      ref={containerRef}
      id="motto"
      className={`relative ${prefersReducedMotion ? 'min-h-screen' : SECTION_HEIGHT}`}
    >
      {/* Sticky viewport frame: locks in place until the full sequence has played */}
      <div
        className={`${prefersReducedMotion ? 'relative min-h-screen py-24' : 'sticky top-0 h-screen'
          } flex flex-col justify-center items-center text-center px-4 sm:px-6 overflow-hidden`}
      >
        {/* Background stack */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {/* Parallax layer: oversized so it never exposes an edge while it moves */}
          <motion.div
            style={{
              y: prefersReducedMotion ? 0 : bgY,
              scale: prefersReducedMotion ? 1 : bgScale,
            }}
            className="absolute inset-x-0 -top-[10%] -bottom-[10%] will-change-transform"
          >
            <Image
              src="/actual_images/book_bg.png"
              alt="Antique law library bookshelf background"
              fill
              priority={false}
              className="object-cover object-top filter contrast-110"
              sizes="100vw"
            />
          </motion.div>

          {/* Darkening overlay - same rgba(20, 11, 12, 0.90) as HeroSection */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(20, 11, 12, 0.90)' }}
          />

          {/* Bookshelf Spotlight Reveal */}
          <BookshelfSpotlight
            containerRef={containerRef}
            parallaxY={bgY}
            parallaxScale={bgScale}
            oversizedClassName="-top-[10%] -bottom-[10%]"
          />

          {/* Top gradient transition matching Hero bottom gradient */}
          <div className="absolute top-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-b from-[#0d0705] via-[#0d0705]/75 to-transparent" />

          {/* Bottom gradient transition into spacer & About section */}
          <div className="absolute bottom-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/70 to-transparent" />

          {/* Warm spotlight behind the maxim */}
          <motion.div
            style={{
              opacity: prefersReducedMotion ? 0.6 : spotlightOpacity,
              background:
                'radial-gradient(ellipse 60% 45% at 50% 50%, rgba(197,148,78,0.14), transparent 70%)',
            }}
            className="absolute inset-0"
          />

          {/* Entry veil: lifts as the section arrives, revealing the library out of darkness */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0 : veilOpacity }}
            className="absolute inset-0 bg-[#0d0705]"
          />
        </div>

        {/* Exit dim: covers the books completely as the section leaves */}
        <motion.div
          style={{ opacity: prefersReducedMotion ? 0 : exitDim }}
          className="absolute inset-0 z-[5] bg-[#0d0705] pointer-events-none"
        />

        {/* Foreground content: revealed sequentially during the pinned scroll */}
        <motion.div
          style={{ scale: prefersReducedMotion ? 1 : contentScale }}
          className="relative z-10 max-w-7xl 2xl:max-w-[1440px] mx-auto px-4 sm:px-6 w-full will-change-transform"
        >
          {/* Top Hairline Divider */}
          <motion.div
            style={{
              scaleX: prefersReducedMotion ? 1 : topDividerScaleX,
              opacity: prefersReducedMotion ? 1 : topDividerOpacity,
            }}
            className="w-24 sm:w-36 lg:w-44 h-[1px] bg-[#c5944e]/60 mx-auto mb-8 sm:mb-12 origin-center will-change-transform"
          />

          {/* Latin maxim: Line 1 "NEMO EST", Line 2 "SUPRA LEGES" */}
          <div className="space-y-1 sm:space-y-2 lg:space-y-3">
            {[MAXIM_WORDS.slice(0, 2), MAXIM_WORDS.slice(2)].map((line, lineIdx) => (
              <div
                key={lineIdx}
                className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-10 whitespace-nowrap"
              >
                {line.map((item) => (
                  <PinnedMottoWord
                    key={item.word}
                    word={item.word}
                    progress={smoothProgress}
                    start={item.start}
                    end={item.end}
                    isGold={item.isGold}
                    shadow={MAXIM_SHADOW}
                    className={MAXIM_CLASS}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Subtitle translation: "No one is above the law." */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 md:gap-x-5 gap-y-1 my-6 sm:my-8 lg:my-10">
            {SUBTITLE_WORDS.map((item) => (
              <PinnedMottoWord
                key={item.word}
                word={item.word}
                progress={smoothProgress}
                start={item.start}
                end={item.end}
                isGold={item.isGold}
                shadow={SUBTITLE_SHADOW}
                className={SUBTITLE_CLASS}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </div>

          {/* Bottom Hairline Divider */}
          <motion.div
            style={{
              scaleX: prefersReducedMotion ? 1 : bottomDividerScaleX,
              opacity: prefersReducedMotion ? 1 : bottomDividerOpacity,
            }}
            className="w-24 sm:w-36 lg:w-44 h-[1px] bg-[#c5944e]/60 mx-auto mt-8 sm:mt-12 origin-center will-change-transform"
          />
        </motion.div>
      </div>
    </section>
  );
}