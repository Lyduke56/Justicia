'use client';

import React, { useRef, useMemo } from 'react';
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

const revealEase = cubicBezier(0.22, 1, 0.36, 1);

/**
 * Pinned timeline, in scroll-progress units (0 → 1 across the pinned track).
 *
 *   0.04 – 0.34   Hall of Justice facade fades in (and keeps drifting afterwards)
 *   0.34 – 0.42   hairline draws
 *   0.36 – 0.58   "ABOUT" → "JUSTICIA"
 *   0.54 – 0.76   paragraph 1, word by word
 *   0.72 – 0.92   paragraph 2, word by word
 *   0.92 – 1.00   HOLD: everything visible, still pinned, then the section releases
 *
 * After the pin releases, an exit phase (parallax + dim) carries the scene into Features.
 * To make the whole sequence longer or shorter, change SECTION_HEIGHT — the timings are relative.
 */
const SECTION_HEIGHT = 'h-[480vh] sm:h-[520vh]';

const T = {
  facade: [0.04, 0.34],
  divider: [0.34, 0.42],
  about: [0.36, 0.52],
  justicia: [0.42, 0.58],
  paragraph1: [0.54, 0.76],
  paragraph2: [0.72, 0.92],
} as const;

/**
 * Two-stage reveal: a slow fade while the element is still blurred and low,
 * then it sharpens, rises into place and reaches full opacity.
 * Blur resolves to 'none' so finished text isn't left on a filtered layer.
 */
function useReveal(
  progress: MotionValue<number>,
  start: number,
  end: number,
  opts: { y?: number; blur?: number } = {},
) {
  const { y = 20, blur = 8 } = opts;
  const opacity = useTransform(progress, [start, start + (end - start) * 0.45, end], [0, 0.3, 1]);
  const yValue = useTransform(progress, [start, end], [y, 0], { ease: revealEase });
  const blurValue = useTransform(progress, [start, end], [blur, 0], { ease: revealEase });
  const filter = useTransform(blurValue, (v) => (v < 0.1 ? 'none' : `blur(${v}px)`));
  return { opacity, y: yValue, filter };
}

function PinnedWordPiece({
  word,
  index,
  total,
  progress,
  start,
  end,
  prefersReducedMotion,
}: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  start: number;
  end: number;
  prefersReducedMotion: boolean | null;
}) {
  const step = (end - start) / total;
  const wordStart = start + index * step;
  const wordEnd = Math.min(wordStart + step * 1.8, end);

  const reveal = useReveal(progress, wordStart, wordEnd, { y: 14, blur: 6 });

  // Subtle golden warmth highlight while the word is being revealed
  const mid = (wordStart + wordEnd) / 2;
  const glow = useTransform(progress, [wordStart, mid, wordEnd], [0, 1, 0]);
  const color = useTransform(glow, [0, 0.25, 1], ['#9e9386', '#c5944e', '#e5b36a']);

  if (prefersReducedMotion) {
    return (
      <span className="inline-block" style={{ color: '#9e9386' }}>
        {word}
      </span>
    );
  }

  return (
    <motion.span style={{ ...reveal, color }} className="inline-block will-change-transform">
      {word}
    </motion.span>
  );
}

function PinnedScrubText({
  text,
  progress,
  start,
  end,
  className,
  prefersReducedMotion,
}: {
  text: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
  className?: string;
  prefersReducedMotion: boolean | null;
}) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  const wordCount = useMemo(() => words.filter((w) => w.trim() !== '').length, [words]);

  let validWordIndex = 0;

  return (
    <p className={className}>
      {words.map((chunk, idx) => {
        if (chunk.trim() === '') {
          return chunk;
        }
        const currentIndex = validWordIndex++;
        return (
          <PinnedWordPiece
            key={idx}
            word={chunk}
            index={currentIndex}
            total={wordCount}
            progress={progress}
            start={start}
            end={end}
            prefersReducedMotion={prefersReducedMotion}
          />
        );
      })}
    </p>
  );
}

export function AboutSection() {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Pinned track: locks in place when the section top reaches the top of the viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  // Entry track: runs while the section slides up from below (right after the Motto section)
  const { scrollYProgress: entryProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start start'],
  });

  // Exit track: runs while the section scrolls away after unpinning (into Features)
  const { scrollYProgress: exitProgress } = useScroll({
    target: containerRef,
    offset: ['end end', 'end start'],
  });

  // Heavy, overdamped spring so fast scrolling can't skip words
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 40, damping: 30, restDelta: 0.0005 });
  const smoothEntry = useSpring(entryProgress, { stiffness: 60, damping: 28, restDelta: 0.0005 });
  const smoothExit = useSpring(exitProgress, { stiffness: 60, damping: 28, restDelta: 0.0005 });

  // ENTRY — starts as solid #0d0705 (Motto's final colour) and lifts, so the library emerges from the dark
  const veilOpacity = useTransform(smoothEntry, [0.1, 1], [1, 0]);

  // PINNED — background: slow push-in + upward drift (farthest layer)
  const bgScale = useTransform(smoothProgress, [0, 1], [1.02, 1.08]);
  const bgY = useTransform(smoothProgress, [0, 1], ['0%', '-4%']);

  // PINNED — facade fades in gradually, then keeps drifting (middle layer)
  const facadeOpacity = useTransform(smoothProgress, [T.facade[0], T.facade[1]], [0, 1]);
  const facadeScale = useTransform(smoothProgress, [0, T.facade[1], 1], [1.1, 1, 1.05]);
  const facadeY = useTransform(smoothProgress, [0, T.facade[1], 1], [40, 0, -16]);

  // PINNED — hairline + heading + paragraphs (nearest layer)
  const dividerScaleX = useTransform(smoothProgress, [T.divider[0], T.divider[1]], [0, 1]);
  const dividerOpacity = useTransform(smoothProgress, [T.divider[0], T.divider[1]], [0, 1]);
  const aboutReveal = useReveal(smoothProgress, T.about[0], T.about[1], { y: 20, blur: 8 });
  const justiciaReveal = useReveal(smoothProgress, T.justicia[0], T.justicia[1], { y: 20, blur: 8 });

  // EXIT — text leaves fastest, the facade lags behind, everything sinks into #0d0705 (Features' background)
  const exitContentY = useTransform(smoothExit, [0, 1], [0, -140]);
  const exitContentOpacity = useTransform(smoothExit, [0, 0.55], [1, 0]);
  const exitBlur = useTransform(smoothExit, [0.05, 0.55], [0, 8]);
  const exitFilter = useTransform(exitBlur, (v) => (v < 0.1 ? 'none' : `blur(${v}px)`));
  const exitFacadeY = useTransform(smoothExit, [0, 1], [0, 50]);
  const exitDim = useTransform(smoothExit, [0.1, 0.9], [0, 1]);

  return (
    <section
      ref={containerRef}
      id="about"
      className={`relative ${prefersReducedMotion ? '' : SECTION_HEIGHT}`}
    >
      {/* Sticky viewport frame: locks in place while the full sequence plays */}
      <div
        className={`${prefersReducedMotion ? 'relative' : 'sticky top-0'
          } h-screen flex flex-col justify-end pb-12 sm:pb-16 lg:pb-20 overflow-hidden`}
      >
        {/* Base Layer: book_bg.png - matching HeroSection & MottoSection depth */}
        <div className="absolute inset-0 z-0 pointer-events-none">
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

          {/* Darkening overlay - exact same rgba(20, 11, 12, 0.90) as Hero & Motto */}
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

          {/* Top gradient transition matching Motto bottom gradient */}
          <div className="absolute top-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-b from-[#0d0705] via-[#0d0705]/70 to-transparent" />

          {/* Bottom gradient transition into Features section */}
          <div className="absolute bottom-0 left-0 right-0 h-44 sm:h-56 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/70 to-transparent" />

          {/* Entry veil: lifts as the section arrives, revealing the library out of darkness */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0 : veilOpacity }}
            className="absolute inset-0 bg-[#0d0705]"
          />
        </div>

        {/* Architecture backdrop - outer wrapper carries the exit lag, inner carries the pinned motion */}
        <motion.div
          style={{ y: prefersReducedMotion ? 0 : exitFacadeY }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
          <motion.div
            style={{
              opacity: prefersReducedMotion ? 1 : facadeOpacity,
              scale: prefersReducedMotion ? 1 : facadeScale,
              y: prefersReducedMotion ? 0 : facadeY,
            }}
            className="absolute inset-0 will-change-transform"
          >
            <Image
              src="/actual_images/hall_of_justice.png"
              alt="Neoclassical Hall of Justice facade"
              fill
              priority={false}
              className="object-cover object-center filter contrast-105 brightness-110"
              sizes="100vw"
              style={{
                maskImage:
                  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 5%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 90%, rgba(0,0,0,0.85) 100%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 5%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 90%, rgba(0,0,0,0.85) 100%)',
              }}
            />

            {/* Localized bottom gradient overlay - protects text legibility while exposing the facade above */}
            <div className="absolute bottom-0 left-0 right-0 h-96 sm:h-[28rem] lg:h-[34rem] bg-gradient-to-t from-[#0d0705] via-[#0d0705]/85 to-transparent pointer-events-none" />
          </motion.div>
        </motion.div>

        {/* Exit dim: sinks the scene into Features' background colour as the section leaves */}
        <motion.div
          style={{ opacity: prefersReducedMotion ? 0 : exitDim }}
          className="absolute inset-0 z-[5] bg-[#0d0705] pointer-events-none"
        />

        {/* Foreground Content Area - revealed word by word while pinned, then lifts away on exit */}
        <motion.div
          style={{
            y: prefersReducedMotion ? 0 : exitContentY,
            opacity: prefersReducedMotion ? 1 : exitContentOpacity,
            filter: prefersReducedMotion ? 'none' : exitFilter,
          }}
          className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full will-change-transform"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-end">
            {/* Left Column: Heading + First Paragraph */}
            <div className="space-y-4">
              <motion.div
                style={{
                  scaleX: prefersReducedMotion ? 1 : dividerScaleX,
                  opacity: prefersReducedMotion ? 1 : dividerOpacity,
                }}
                className="w-12 h-[1px] bg-[#c5944e] origin-left will-change-transform"
              />

              <h2 className="font-lora text-3xl sm:text-4xl lg:text-5xl font-medium text-[#ded7cb] tracking-wide leading-tight">
                <motion.span
                  style={prefersReducedMotion ? undefined : aboutReveal}
                  className="inline-block mr-3 will-change-transform"
                >
                  ABOUT
                </motion.span>
                <motion.span
                  style={prefersReducedMotion ? undefined : justiciaReveal}
                  className="inline-block text-[#c5944e] will-change-transform"
                >
                  JUSTICIA
                </motion.span>
              </h2>

              <PinnedScrubText
                text="Justicia was founded on the fundamental principle that legal understanding should never be a privilege reserved for the few. By uniting high-level AI reasoning trained on codified Philippine statutes and Supreme Court jurisprudence with an accredited network of licensed attorneys,"
                progress={smoothProgress}
                start={T.paragraph1[0]}
                end={T.paragraph1[1]}
                className="text-xs sm:text-sm lg:text-[0.925rem] leading-relaxed font-normal text-justify [text-justify:inter-word]"
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>

            {/* Right Column: Second Paragraph (continuation) */}
            <div className="space-y-4">
              <PinnedScrubText
                text="we bridge the critical divide between complex legal doctrine and everyday citizens. Whether interpreting statutory rights, analyzing contracts, or preparing for judicial proceedings, our platform delivers instant guidance and verified counsel whenever legal clarity is required."
                progress={smoothProgress}
                start={T.paragraph2[0]}
                end={T.paragraph2[1]}
                className="text-xs sm:text-sm lg:text-[0.925rem] leading-relaxed font-normal text-justify [text-justify:inter-word]"
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}