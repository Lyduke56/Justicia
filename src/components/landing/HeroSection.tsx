'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from 'motion/react';
import { BookshelfSpotlight } from './LibrarySpotlight';

/** One easing curve for the whole entrance, so every piece decelerates the same way. */
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Entrance sequence, in seconds after the hero is ready (see `ready` below).
 * Only opacity and transforms are animated, so nothing repaints while it plays.
 *
 *   0.00 – 1.60   the library lights up out of black
 *   0.15 – 1.95   Lady Justice rises into place, her halo warms up behind her
 *   0.35 – 1.65   headline, line by line
 *   0.70 – 1.90   subtext
 *   0.85 – 2.05   call-to-action buttons
 *   0.90 – 2.00   navbar (timed from LandingPageClient: HERO_NAV_DELAY)
 *   1.60 →        scroll cue
 */
const INTRO = {
  veil: { delay: 0, duration: 1.6 },
  statue: { delay: 0.15, duration: 1.8 },
  halo: { delay: 0.45, duration: 2.4 },
  lines: { delay: 0.35, stagger: 0.12, duration: 1.3 },
  subtext: { delay: 0.7, duration: 1.2 },
  ctas: { delay: 0.85, duration: 1.2 },
  cue: { delay: 1.6, duration: 1 },
} as const;

/** Delay (s) for the navbar so it lands with the rest of the sequence. */
export const HERO_NAV_DELAY = 0.9;

/**
 * Longest we wait for the images and fonts before starting anyway (ms after mount).
 * Keeps a slow connection from holding the page on a dark screen.
 */
const READY_TIMEOUT = 1400;

interface HeroSectionProps {
  /** Called once when the entrance starts, so the navbar can join in. */
  onIntroStart?: () => void;
}

export function HeroSection({ onIntroStart }: HeroSectionProps) {
  const containerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  /**
   * The entrance waits until the background, the statue and the web fonts are ready.
   * Otherwise an image can pop in halfway through its fade, or the headline can jump
   * when its font swaps in mid-animation.
   */
  const [ready, setReady] = useState(false);
  const pendingRef = useRef({ bg: true, statue: true, fonts: true });

  const markReady = useCallback((key: 'bg' | 'statue' | 'fonts') => {
    pendingRef.current[key] = false;
    const { bg, statue, fonts } = pendingRef.current;
    if (!bg && !statue && !fonts) setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) markReady('fonts');
    });
    const timer = setTimeout(() => setReady(true), READY_TIMEOUT);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [markReady]);

  useEffect(() => {
    if (ready) onIntroStart?.();
  }, [ready, onIntroStart]);

  /** Props for one piece of the entrance: hidden until `ready`, then eased into place. */
  const enter = (step: { delay: number; duration: number }, y = 0) => ({
    initial: { opacity: 0, y },
    animate: ready ? { opacity: 1, y: 0 } : { opacity: 0, y },
    transition: { duration: step.duration, delay: step.delay, ease: EASE },
  });

  // Progress runs 0 → 1 while the whole hero scrolls out of the viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Softer spring = more glide, so the layers feel weighted rather than glued to the scrollbar
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 26,
    restDelta: 0.0005,
  });

  /**
   * Parallax depth (slowest → fastest):
   *   background  <  statue  <  headline/CTAs
   * Each layer also fades on its own schedule so the exit unfolds in stages
   * instead of everything disappearing at once.
   */

  // Layer 1 — background: slow descent + gentle push-in matching Motto section depth
  const bgY = useTransform(smoothProgress, [0, 1], ['0%', '8%']);
  const bgScale = useTransform(smoothProgress, [0, 1], [1.02, 1.1]);

  // Layer 2 — statue: medium drift, holds briefly, then dissolves
  const statueY = useTransform(smoothProgress, [0, 0.85], [0, -90]);
  const statueScale = useTransform(smoothProgress, [0, 0.85], [1, 1.05]);
  const statueOpacity = useTransform(smoothProgress, [0.12, 0.62], [1, 0]);

  // Layer 3 — copy: moves fastest, defocuses as it fades (reads as "closest to the viewer").
  // The blur resolves to 'none' at rest so the copy isn't kept on a filtered layer.
  const textY = useTransform(smoothProgress, [0, 0.6], [0, -160]);
  const textScale = useTransform(smoothProgress, [0, 0.6], [1, 0.96]);
  const textOpacity = useTransform(smoothProgress, [0.05, 0.42], [1, 0]);
  const textBlur = useTransform(smoothProgress, [0.08, 0.42], [0, 10]);
  const textFilter = useTransform(textBlur, (v) => (v < 0.1 ? 'none' : `blur(${v.toFixed(2)}px)`));

  // Descent into darkness: matches the Motto section's opening colour (#0d0705)
  const dimOpacity = useTransform(smoothProgress, [0.3, 0.9], [0, 0.85]);

  // Scroll cue disappears as soon as the visitor starts scrolling
  const cueOpacity = useTransform(scrollYProgress, [0, 0.06], [1, 0]);

  return (
    <section
      ref={containerRef}
      id="home"
      className="relative min-h-[140vh] lg:min-h-[155vh] flex items-center pt-28 sm:pt-32 pb-48 sm:pb-64 lg:pb-80 overflow-hidden"
    >
      {/* Background stack */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Pinned frame: locks to viewport height (100vh) so the bookshelf background stays zoomed out matching MottoSection */}
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* Parallax layer: oversized so it never reveals an edge while it travels */}
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
              priority
              onLoad={() => markReady('bg')}
              onError={() => markReady('bg')}
              className="object-cover object-top filter contrast-110"
              sizes="100vw"
            />
          </motion.div>

          {/* Darkening overlay */}
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

          {/* Top Navbar scrim */}
          <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#140b0d]/90 to-transparent" />

          {/* Bottom gradient transition into next section */}
          <div className="absolute bottom-0 left-0 right-0 h-72 sm:h-96 bg-gradient-to-t from-[#0d0705] via-[#0d0705]/85 to-transparent" />

          {/* Scroll-driven dim: the hero sinks into the Motto section's opening colour */}
          <motion.div
            style={{ opacity: prefersReducedMotion ? 0 : dimOpacity }}
            className="absolute inset-0 bg-[#0d0705]"
          />

          {/* Intro veil: the library lights up out of black once everything is ready */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: ready ? 0 : 1 }}
            transition={{ duration: INTRO.veil.duration, delay: INTRO.veil.delay, ease: [0.45, 0, 0.25, 1] }}
            className="absolute inset-0 bg-[#0d0705]"
          />

          {/* Scroll cue */}
          <motion.div
            style={{ opacity: cueOpacity }}
            className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 sm:block"
          >
            <motion.div {...enter(INTRO.cue, 8)} className="flex flex-col items-center gap-3">
              <span className="font-cinzel text-[10px] tracking-[0.38em] text-[#968b7f]">SCROLL</span>
              <span className="relative h-12 w-px overflow-hidden bg-[#c5944e]/15">
                {!prefersReducedMotion && ready && (
                  <motion.span
                    className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-[#e2b36d] to-transparent"
                    initial={{ y: '-100%' }}
                    animate={{ y: '200%' }}
                    transition={{
                      duration: 2.2,
                      delay: INTRO.cue.delay + 0.4,
                      repeat: Infinity,
                      repeatDelay: 0.4,
                      ease: [0.65, 0, 0.35, 1],
                    }}
                  />
                )}
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
        {/* Left Column: Headlines, Subtext, Buttons */}
        <motion.div
          style={{
            y: prefersReducedMotion ? 0 : textY,
            scale: prefersReducedMotion ? 1 : textScale,
            opacity: textOpacity,
            filter: prefersReducedMotion ? 'none' : textFilter,
          }}
          className="relative z-20 lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 text-left lg:-translate-y-35 xl:-translate-y-40 2xl:-translate-y-71 will-change-transform"
        >
          {/* Main Headline: line by line */}
          <h1 className="font-lora text-3xl sm:text-4xl md:text-5xl lg:text-[3rem] xl:text-[3.5rem] 2xl:text-[4.15rem] font-medium text-[#ded7cb] leading-[1.14] tracking-tight">
            <motion.span
              {...enter({ delay: INTRO.lines.delay, duration: INTRO.lines.duration }, 28)}
              className="block sm:whitespace-nowrap"
            >
              BE <span className="text-[#c5944e]">AWARE</span> OF YOUR
            </motion.span>
            <motion.span
              {...enter(
                { delay: INTRO.lines.delay + INTRO.lines.stagger, duration: INTRO.lines.duration },
                28,
              )}
              className="block sm:whitespace-nowrap"
            >
              RIGHTS, MOVE <span className="text-[#c5944e]">NOW</span>.
            </motion.span>
          </h1>

          {/* Subtext description */}
          <motion.p
            {...enter(INTRO.subtext, 18)}
            className="text-[#a69c8f] text-sm sm:text-base lg:text-[1rem] xl:text-[1.1rem] 2xl:text-[1.23rem] leading-relaxed max-w-xl xl:max-w-none xl:w-[800px] 2xl:w-[860px] text-balance font-inter font-light"
          >
            Understand Philippine laws and jurisprudence with AI-powered legal
            guidance, connect with a real lawyer when you need professional counsel.
          </motion.p>

          {/* CTA Action Buttons */}
          <motion.div
            {...enter(INTRO.ctas, 18)}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2"
          >
            {/* Chat with our AI (Solid Warm Gold), with a light sheen on hover */}
            <Link
              href="/chat"
              className="group relative inline-flex items-center justify-center overflow-hidden bg-[#D39758] hover:bg-[#d6a25b] hover:shadow-[0_10px_30px_-8px_rgba(211,151,88,0.55)] active:scale-[0.98] text-[#160c0d] font-lora font-medium text-[0.9rem] sm:text-sm tracking-[0.14em] px-7 py-3.5 rounded transition-all duration-300 text-center shadow-lg shadow-black/35"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[140%] skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[380%]"
              />
              <span className="relative">Chat with our AI</span>
            </Link>

            {/* Book a Consultation (Outlined Warm Gold) */}
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center border border-[#D39758]/60 hover:border-[#c5944e] hover:bg-[#c5944e]/10 active:scale-[0.98] text-[#c5944e] bg-transparent font-lora font-medium text-xs sm:text-sm tracking-[0.14em] px-7 py-3.5 rounded transition-all duration-200 text-center"
            >
              Book a Consultation
            </Link>
          </motion.div>
        </motion.div>

        {/* Right Column: Lady Justice Statue - midground parallax element */}
        <div className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end items-center relative mt-4 lg:mt-0 lg:-translate-y-12 xl:-translate-y-19 lg:-translate-x-6">
          <motion.div
            style={{
              y: prefersReducedMotion ? 0 : statueY,
              scale: prefersReducedMotion ? 1 : statueScale,
              opacity: statueOpacity,
            }}
            className="relative w-full max-w-[480px] sm:max-w-[560px] lg:max-w-none lg:w-[580px] xl:w-[680px] 2xl:w-[780px] lg:-mr-12 xl:-mr-20 2xl:-mr-32 h-auto flex items-center justify-center pointer-events-none will-change-transform"
          >
            {/* Warm halo behind the statue */}
            <motion.div
              aria-hidden="true"
              {...enter(INTRO.halo)}
              className="pointer-events-none absolute left-1/2 top-[36%] -z-10 aspect-square w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(197,148,78,0.15),rgba(197,148,78,0.045)_55%,transparent_78%)]"
            />

            <motion.div
              {...enter(INTRO.statue, 40)}
              style={{
                maskImage:
                  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.85) 68%, rgba(0,0,0,0.25) 80%, rgba(0,0,0,0) 90%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 56%, rgba(0,0,0,0.85) 68%, rgba(0,0,0,0.25) 80%, rgba(0,0,0,0) 90%)',
              }}
              className="w-full h-auto flex items-center justify-center will-change-transform"
            >
              <Image
                src="/actual_images/lady_justice.svg"
                alt="Statue of Lady Justice holding scales and sword"
                width={627}
                height={1116}
                priority
                onLoad={() => markReady('statue')}
                onError={() => markReady('statue')}
                className="w-full h-auto object-contain filter drop-shadow-[0_20px_45px_rgba(0,0,0,0.85)]"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
