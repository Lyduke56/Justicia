'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import { motion, useReducedMotion, type MotionValue } from 'motion/react';

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
// Tracks pointer position once on the window and drives all spotlights smoothly
// via requestAnimationFrame and CSS custom properties (0 React re-renders).
// ============================================================================

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [isSupported, setIsSupported] = useState(false);
  const listenersRef = useRef<Set<SpotlightUpdateCallback>>(new Set());

  // Physical coordinates & lerping
  const targetX = useRef<number>(-999);
  const targetY = useRef<number>(-999);
  const currentX = useRef<number>(-999);
  const currentY = useRef<number>(-999);
  const targetOpacity = useRef<number>(0);
  const currentOpacity = useRef<number>(0);
  const rafId = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Only enable pointer-following spotlight on fine-pointer devices (mouse / trackpad)
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!isFinePointer) return;

    setIsSupported(true);

    const lerpFactor = prefersReducedMotion ? 1 : 0.22;
    const opacityLerp = prefersReducedMotion ? 1 : 0.12;

    const handlePointerMove = (e: PointerEvent) => {
      targetX.current = e.clientX;
      targetY.current = e.clientY;
      targetOpacity.current = 1;

      // First time initialize position directly to avoid flying in from -999
      if (currentX.current === -999) {
        currentX.current = e.clientX;
        currentY.current = e.clientY;
      }
    };

    const handlePointerLeave = () => {
      targetOpacity.current = 0;
    };

    const handlePointerEnter = (e: PointerEvent) => {
      targetX.current = e.clientX;
      targetY.current = e.clientY;
      targetOpacity.current = 1;
    };

    const handleWindowBlur = () => {
      targetOpacity.current = 0;
    };

    const updateLoop = () => {
      if (currentX.current !== -999) {
        currentX.current += (targetX.current - currentX.current) * lerpFactor;
        currentY.current += (targetY.current - currentY.current) * lerpFactor;
        currentOpacity.current +=
          (targetOpacity.current - currentOpacity.current) * opacityLerp;

        const x = currentX.current;
        const y = currentY.current;
        const op = currentOpacity.current;

        // Set global CSS custom properties on document element
        const root = document.documentElement;
        root.style.setProperty('--spotlight-x', `${x.toFixed(1)}px`);
        root.style.setProperty('--spotlight-y', `${y.toFixed(1)}px`);
        root.style.setProperty('--spotlight-opacity', `${op.toFixed(3)}`);

        // Notify registered section layers
        listenersRef.current.forEach((cb) => cb(x, y, op));
      }

      rafId.current = requestAnimationFrame(updateLoop);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerleave', handlePointerLeave);
    document.addEventListener('pointerenter', handlePointerEnter);
    window.addEventListener('blur', handleWindowBlur);

    rafId.current = requestAnimationFrame(updateLoop);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerleave', handlePointerLeave);
      document.removeEventListener('pointerenter', handlePointerEnter);
      window.removeEventListener('blur', handleWindowBlur);

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [prefersReducedMotion]);

  const registerLayer = (cb: SpotlightUpdateCallback) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  };

  return (
    <SpotlightContext.Provider value={{ registerLayer, isSupported }}>
      {children}
    </SpotlightContext.Provider>
  );
}

// ============================================================================
// BookshelfSpotlight
// Drop inside any section's background stack. Aligns with base parallax and
// reveals the antique law library bookshelves in warm golden clarity wherever
// the cursor moves.
// ============================================================================

export interface BookshelfSpotlightProps {
  /** Optional container ref to calculate section-relative coordinates when scrolling */
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
  containerRef,
  parallaxY,
  parallaxScale,
  className = '',
  oversizedClassName = '-top-[15%] -bottom-[15%]',
  radius = 340,
}: BookshelfSpotlightProps) {
  const context = useContext(SpotlightContext);
  const layerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!context || !layerRef.current) return;

    const unregister = context.registerLayer((globalX, globalY, opacity) => {
      const el = layerRef.current;
      if (!el) return;

      if (!containerRef?.current) {
        // Fallback: use global viewport coordinates directly
        el.style.setProperty('--spotlight-local-x', `${globalX.toFixed(1)}px`);
        el.style.setProperty('--spotlight-local-y', `${globalY.toFixed(1)}px`);
        el.style.setProperty('--spotlight-local-opacity', `${opacity.toFixed(3)}`);
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const inView = rect.bottom > -100 && rect.top < window.innerHeight + 100;

      if (!inView) {
        // Section is off-screen, no need to update
        return;
      }

      const localX = globalX - rect.left;
      const localY = globalY - rect.top;

      el.style.setProperty('--spotlight-local-x', `${localX.toFixed(1)}px`);
      el.style.setProperty('--spotlight-local-y', `${localY.toFixed(1)}px`);
      el.style.setProperty('--spotlight-local-opacity', `${opacity.toFixed(3)}`);
    });

    return unregister;
  }, [context, containerRef]);

  if (!context?.isSupported) {
    return null;
  }

  return (
    <div
      ref={layerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none will-change-transform ${className}`}
      style={{
        opacity: 'var(--spotlight-local-opacity, 0)',
        transition: 'opacity 0.25s ease-out',
        maskImage: `radial-gradient(${radius}px circle at var(--spotlight-local-x, -999px) var(--spotlight-local-y, -999px), black 18%, rgba(0,0,0,0.7) 46%, rgba(0,0,0,0.2) 68%, transparent 85%)`,
        WebkitMaskImage: `radial-gradient(${radius}px circle at var(--spotlight-local-x, -999px) var(--spotlight-local-y, -999px), black 18%, rgba(0,0,0,0.7) 46%, rgba(0,0,0,0.2) 68%, transparent 85%)`,
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
// A fixed overlay rendered at the top level of the landing page.
// Casts a subtle warm golden lantern glow across the UI, cards, and text
// following the cursor, making the whole website feel bathed in ambient warmth.
// ============================================================================

export function GlobalCursorSpotlight() {
  const context = useContext(SpotlightContext);
  if (!context?.isSupported) return null;

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none overflow-hidden select-none transition-opacity duration-300"
      style={{
        opacity: 'var(--spotlight-opacity, 0)',
      }}
    >
      {/* Broad warm ambient halo */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(550px circle at var(--spotlight-x, -999px) var(--spotlight-y, -999px), rgba(197, 148, 78, 0.07) 0%, rgba(197, 148, 78, 0.025) 42%, transparent 70%)',
        }}
      />

      {/* Focused incandescent core */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(190px circle at var(--spotlight-x, -999px) var(--spotlight-y, -999px), rgba(255, 238, 200, 0.10) 0%, rgba(197, 148, 78, 0.04) 50%, transparent 75%)',
        }}
      />

      {/* Optical Fresnel lens dispersion ring */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(280px circle at var(--spotlight-x, -999px) var(--spotlight-y, -999px), transparent 72%, rgba(197, 148, 78, 0.05) 80%, transparent 88%)',
        }}
      />
    </div>
  );
}
