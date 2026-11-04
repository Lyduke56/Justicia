'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { motion, useReducedMotion, type MotionValue } from 'motion/react';

/**
 * Strength of the page-wide warm glow (GlobalCursorSpotlight).
 *   0    = off (the overlay isn't rendered at all)
 *   0.6  = subtle (default)
 *   1    = the original strength
 */
const GLOBAL_GLOW_STRENGTH = 0.6;

// ============================================================================
// Types & Context
// ============================================================================

type SpotlightUpdateCallback = (x: number, y: number, opacity: number) => void;

interface SpotlightContextValue {
  registerLayer: (cb: SpotlightUpdateCallback) => () => void;
  isSupported: boolean;
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

// ============================================================================
// Spotlight Provider
// Tracks the pointer once on the window and drives every spotlight layer from a
// single requestAnimationFrame loop. The loop only runs while something is
// moving (pointer, scroll, fade) and goes fully idle otherwise.
// ============================================================================

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const listenersRef = useRef<Set<SpotlightUpdateCallback>>(new Set());
  const latestRef = useRef({ x: -999, y: -999, opacity: 0 });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Only enable the pointer-following spotlight on fine-pointer devices (mouse / trackpad)
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) return;

    setIsSupported(true);

    const root = document.documentElement;
    const listeners = listenersRef.current;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let targetOpacity = 0;
    let currentOpacity = 0;
    let hasPointer = false;
    let rafId: number | null = null;
    let lastTime = 0;

    const publish = () => {
      latestRef.current = { x: currentX, y: currentY, opacity: currentOpacity };

      // Kept for any other component that reads the global custom properties
      root.style.setProperty('--spotlight-x', `${currentX.toFixed(1)}px`);
      root.style.setProperty('--spotlight-y', `${currentY.toFixed(1)}px`);
      root.style.setProperty('--spotlight-opacity', currentOpacity.toFixed(3));

      listeners.forEach((cb) => cb(currentX, currentY, currentOpacity));
    };

    const tick = (time: number) => {
      // Time-based smoothing so the feel is identical on 60Hz and 144Hz screens
      const dt = Math.min(Math.max((time - lastTime) / 1000, 0), 0.05);
      lastTime = time;

      const posK = prefersReducedMotion ? 1 : 1 - Math.exp(-15 * dt);
      const opK = prefersReducedMotion ? 1 : 1 - Math.exp(-7.5 * dt);

      currentX += (targetX - currentX) * posK;
      currentY += (targetY - currentY) * posK;
      currentOpacity += (targetOpacity - currentOpacity) * opK;

      const settled =
        Math.abs(targetX - currentX) < 0.1 &&
        Math.abs(targetY - currentY) < 0.1 &&
        Math.abs(targetOpacity - currentOpacity) < 0.002;

      if (settled) {
        currentX = targetX;
        currentY = targetY;
        currentOpacity = targetOpacity;
      }

      publish();

      // Stop the loop once everything has settled; wake() restarts it on demand
      rafId = settled ? null : requestAnimationFrame(tick);
    };

    const wake = () => {
      if (rafId !== null) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      targetX = e.clientX;
      targetY = e.clientY;
      targetOpacity = 1;

      // First move: snap to the pointer instead of flying in from off-screen
      if (!hasPointer) {
        currentX = targetX;
        currentY = targetY;
        hasPointer = true;
      }
      wake();
    };

    const handlePointerLeave = () => {
      targetOpacity = 0;
      if (hasPointer) wake();
    };

    // Sections move under a stationary cursor while scrolling, so layers need a refresh
    const handleViewportChange = () => {
      if (hasPointer) wake();
    };

    const handleVisibility = () => {
      if (document.hidden) handlePointerLeave();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', handleViewportChange, { passive: true });
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('blur', handlePointerLeave);
    root.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('blur', handlePointerLeave);
      root.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('visibilitychange', handleVisibility);

      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion]);

  const registerLayer = useCallback((cb: SpotlightUpdateCallback) => {
    listenersRef.current.add(cb);

    // Sync a newly mounted layer straight away, even while the loop is idle
    const { x, y, opacity } = latestRef.current;
    cb(x, y, opacity);

    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const value = useMemo(() => ({ registerLayer, isSupported }), [registerLayer, isSupported]);

  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>;
}

// ============================================================================
// BookshelfSpotlight
// Drop inside any section's background stack. Aligns with the base parallax and
// reveals the antique law library bookshelves in warm golden clarity wherever
// the cursor moves.
// ============================================================================

export interface BookshelfSpotlightProps {
  /**
   * No longer needed: the spotlight now measures its own box, which is correct
   * even inside pinned (sticky) sections. Kept so existing call sites still compile.
   */
  containerRef?: React.RefObject<HTMLElement | null>;
  /** Matching parallax Y from the section so illuminated books stay 100% in sync */
  parallaxY?: MotionValue<string> | MotionValue<number>;
  /** Matching parallax scale from the section */
  parallaxScale?: MotionValue<number>;
  /** Extra CSS classes for the outer wrapper */
  className?: string;
  /** Oversized vertical bounds class to match the base section background (default: -top-[15%] -bottom-[15%]) */
  oversizedClassName?: string;
  /** Radius of the spotlight reveal circle in pixels (default: 340) */
  radius?: number;
}

export function BookshelfSpotlight({
  parallaxY,
  parallaxScale,
  className = '',
  oversizedClassName = '-top-[15%] -bottom-[15%]',
  radius = 340,
}: BookshelfSpotlightProps) {
  const context = useContext(SpotlightContext);
  const layerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const registerLayer = context?.registerLayer;
  const isSupported = context?.isSupported ?? false;

  useEffect(() => {
    if (!registerLayer || !isSupported) return;

    return registerLayer((globalX, globalY, opacity) => {
      const el = layerRef.current;
      if (!el) return;

      // Measure the layer itself. The old code measured the (very tall) section,
      // which put the spotlight in the wrong place whenever the section was pinned.
      const rect = el.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;

      if (!inView) {
        el.style.setProperty('--spotlight-local-opacity', '0');
        return;
      }

      el.style.setProperty('--spotlight-local-x', `${(globalX - rect.left).toFixed(1)}px`);
      el.style.setProperty('--spotlight-local-y', `${(globalY - rect.top).toFixed(1)}px`);
      el.style.setProperty('--spotlight-local-opacity', opacity.toFixed(3));
    });
  }, [registerLayer, isSupported]);

  if (!isSupported) {
    return null;
  }

  const mask = `radial-gradient(${radius}px circle at var(--spotlight-local-x, -999px) var(--spotlight-local-y, -999px), black 18%, rgba(0,0,0,0.7) 46%, rgba(0,0,0,0.2) 68%, transparent 85%)`;

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}
      style={{
        // Opacity is already smoothed by the provider, so no CSS transition on top of it
        opacity: 'calc(var(--spotlight-local-opacity, 0) * 0.5)',
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      {/* Illuminated Bookshelf Image - in sync with base parallax */}
      <motion.div
        style={{
          y: prefersReducedMotion || !parallaxY ? 0 : parallaxY,
          scale: prefersReducedMotion || !parallaxScale ? 1 : parallaxScale,
        }}
        className={`absolute inset-x-0 ${oversizedClassName} will-change-transform`}
      >
        <Image
          src="/actual_images/book_bg.png"
          alt="Illuminated antique law library bookshelf"
          fill
          priority={false}
          className="object-cover object-top filter brightness-140 contrast-125 saturate-115 sepia-[0.16]"
          sizes="100vw"
        />

        {/* Warm Golden Reading Lamp / Archival Lantern Bloom */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(${Math.round(radius * 1.15)}px circle at var(--spotlight-local-x, -999px) var(--spotlight-local-y, -999px), rgba(223, 168, 86, 0.32) 0%, rgba(197, 148, 78, 0.16) 38%, rgba(140, 96, 32, 0.04) 62%, transparent 75%)`,
            mixBlendMode: 'screen',
          }}
        />

        {/* Hot center beam highlight */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(${Math.round(radius * 0.45)}px circle at var(--spotlight-local-x, -999px) var(--spotlight-local-y, -999px), rgba(255, 240, 205, 0.22) 0%, rgba(223, 168, 86, 0.08) 50%, transparent 80%)`,
            mixBlendMode: 'screen',
          }}
        />
      </motion.div>
    </div>
  );
}

// ============================================================================
// GlobalCursorSpotlight
// A fixed overlay rendered at the top level of the landing page. Casts a subtle
// warm glow following the cursor. Strength is controlled by GLOBAL_GLOW_STRENGTH.
// ============================================================================

export function GlobalCursorSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context?.isSupported || GLOBAL_GLOW_STRENGTH <= 0) return null;

  const a = (alpha: number) => (alpha * GLOBAL_GLOW_STRENGTH).toFixed(3);

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none overflow-hidden select-none"
      style={{ opacity: 'var(--spotlight-opacity, 0)' }}
    >
      {/* Broad warm ambient halo */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(550px circle at var(--spotlight-x, -999px) var(--spotlight-y, -999px), rgba(197, 148, 78, ${a(0.07)}) 0%, rgba(197, 148, 78, ${a(0.025)}) 42%, transparent 70%)`,
        }}
      />

      {/* Focused incandescent core */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(190px circle at var(--spotlight-x, -999px) var(--spotlight-y, -999px), rgba(255, 238, 200, ${a(0.1)}) 0%, rgba(197, 148, 78, ${a(0.04)}) 50%, transparent 75%)`,
        }}
      />

      {/* Optical Fresnel lens dispersion ring */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(280px circle at var(--spotlight-x, -999px) var(--spotlight-y, -999px), transparent 72%, rgba(197, 148, 78, ${a(0.05)}) 80%, transparent 88%)`,
        }}
      />
    </div>
  );
}