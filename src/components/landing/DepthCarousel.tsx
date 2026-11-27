'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import gsap from 'gsap';
import type { MotionValue } from 'motion/react';

export type DefaultCarouselItem = string | { image: string; alt?: string };
type TiltDirection = 'left' | 'right';

/**
 * stack    → the active card in front, the rest trail off to one side (tiltDirection)
 * centered → the active card in the middle, neighbours recede symmetrically on both sides
 */
export type CarouselArrangement = 'stack' | 'centered';

export interface DepthCarouselProps<T = DefaultCarouselItem> {
  items: T[];
  renderItem?: (item: T, index: number, isActive: boolean) => React.ReactNode;
  onItemClick?: (item: T, index: number) => void;
  arrangement?: CarouselArrangement;
  cardWidth?: number;
  cardHeight?: number;
  radius?: number;
  tint?: string;
  depth?: number;
  spread?: number;
  tilt?: number;
  tiltDirection?: TiltDirection;
  perspective?: number;
  /** Cards shown on each side of the active one (centered) or behind it (stack). */
  visibleCards?: number;
  /** How quickly cards darken with distance (0 = never, 0.5 = fast). */
  falloff?: number;
  blur?: number;
  duration?: number;
  ease?: string;
  autoplay?: boolean;
  autoplayDelay?: number;
  loop?: boolean;
  showControls?: boolean;
  showIndicators?: boolean;
  /**
   * Optional 0 → 1 value that folds the deck: at 0 every card sits behind the active one,
   * at 1 the deck is fully fanned out. Lets a parent tie the fan-out to scroll or an
   * entrance animation without re-rendering the carousel.
   */
  reveal?: MotionValue<number>;
  onChange?: (index: number, item: T) => void;
  ariaLabel?: string;
  className?: string;
}

interface CarouselConfig {
  count: number;
  arrangement: CarouselArrangement;
  depth: number;
  spread: number;
  tilt: number;
  tiltDirection: TiltDirection;
  perspective: number;
  visibleCards: number;
  falloff: number;
  blur: number;
  duration: number;
  ease: string;
  loop: boolean;
  cardWidth: number;
  autoplayDelay: number;
  reveal?: MotionValue<number>;
}

interface DragState {
  x: number;
  startPos: number;
  lastX: number;
  lastT: number;
  v: number;
  moved: boolean;
  id: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

function setIfChanged(
  el: HTMLElement,
  prop: 'filter' | 'zIndex' | 'visibility' | 'pointerEvents',
  value: string,
) {
  if (el.style[prop] !== value) el.style[prop] = value;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Large hairline chevron beside the deck. Hidden until the pointer is over the carousel
 * (or the button has keyboard focus). Not shown on touch screens, where swiping is the control.
 * Its distance from the centre comes from the --side-offset variable set by the carousel,
 * so it sits just outside the cards whatever their size.
 */
function SideChevron({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const prev = direction === 'prev';
  return (
    <button
      type="button"
      aria-label={prev ? 'Previous slide' : 'Next slide'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ left: `calc(50% ${prev ? '-' : '+'} var(--side-offset, 45%))` }}
      className={`group/side pointer-events-auto absolute top-1/2 grid h-44 w-28 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-[#c5944e] opacity-0 transition-opacity duration-500 ease-out group-hover/carousel:opacity-100 focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#c5944e]/50 [@media(hover:none)]:hidden ${
        prev ? '-translate-x-full' : ''
      }`}
    >
      {/* Settles outward as it appears */}
      <span
        className={`block transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/carousel:translate-x-0 ${
          prev ? 'translate-x-3' : '-translate-x-3'
        }`}
      >
        <svg
          viewBox="0 0 64 128"
          aria-hidden="true"
          className={`block h-32 w-16 opacity-30 transition-[opacity,translate,scale,color,filter] duration-500 ease-out group-hover/side:text-[#e2b36d] group-hover/side:opacity-70 group-hover/side:drop-shadow-[0_0_8px_rgba(226,179,109,0.35)] group-focus-visible/side:opacity-70 group-active/side:scale-95 ${
            prev ? 'group-hover/side:-translate-x-1.5' : 'group-hover/side:translate-x-1.5'
          }`}
        >
          <path
            d={prev ? 'M56 8 L8 64 L56 120' : 'M8 8 L56 64 L8 120'}
            fill="none"
            stroke="currentColor"
            strokeWidth="4.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}

/** Gap (px) between the outermost visible card and the side chevrons. */
const SIDE_GAP = 72;

export function DepthCarousel<T = DefaultCarouselItem>({
  items = [],
  renderItem,
  onItemClick,
  arrangement = 'stack',
  cardWidth = 320,
  cardHeight = 420,
  radius = 20,
  tint = '#0d0705',
  depth = 200,
  spread = 90,
  tilt = 20,
  tiltDirection = 'right',
  perspective = 1400,
  visibleCards = 4,
  falloff = 0.22,
  blur = 0,
  duration = 700,
  ease = 'power3.out',
  autoplay = false,
  autoplayDelay = 3500,
  loop = true,
  showControls = true,
  showIndicators = true,
  reveal,
  onChange,
  ariaLabel = 'Carousel',
  className = '',
}: DepthCarouselProps<T>) {
  const count = items.length;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const sideRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const overlayRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const posRef = useRef(0);
  const focusRef = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const scaleRef = useRef(1);
  const cfgRef = useRef<CarouselConfig>({} as CarouselConfig);
  const onChangeRef = useRef(onChange);
  const onItemClickRef = useRef(onItemClick);

  const dragRef = useRef<DragState | null>(null);
  // Set when a drag ends so the click that follows the pointerup doesn't open a card
  const suppressClickRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reducedRef = useRef(false);

  const [active, setActive] = useState(0);

  onChangeRef.current = onChange;
  onItemClickRef.current = onItemClick;

  cfgRef.current = {
    count,
    arrangement,
    depth,
    spread,
    tilt,
    tiltDirection,
    perspective,
    visibleCards,
    falloff,
    blur,
    duration,
    ease,
    loop,
    cardWidth,
    autoplayDelay,
    reveal,
  };

  const layout = useCallback((pos: number) => {
    const cfg = cfgRef.current;
    const n = cfg.count;
    if (!n) return;
    const sc = scaleRef.current;
    const r = cfg.reveal ? clamp(cfg.reveal.get(), 0, 1) : 1;
    const centered = cfg.arrangement === 'centered';
    const dir = cfg.tiltDirection === 'left' ? -1 : 1;

    for (let i = 0; i < n; i++) {
      const el = cardRefs.current[i];
      if (!el) continue;

      let d = i - pos;
      if (cfg.loop && n > 1) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
      }
      const ad = Math.abs(d);

      let tx: number;
      let tz: number;
      let ry: number;
      let opacity: number;
      let dim: number;
      let zi: number;

      if (centered) {
        const side = Math.sign(d);
        // Spacing tightens slightly with distance so the outer cards tuck in behind
        const reach = ad <= 1 ? ad : 1 + (ad - 1) * 0.72;
        tx = side * cfg.spread * reach * r;
        tz = -cfg.depth * ad;
        // Positive rotateY sends the right edge away, so each side turns its outer edge back
        ry = side * cfg.tilt * Math.min(ad, 1) * r;
        opacity = ad <= cfg.visibleCards ? 1 : Math.max(0, 1 - (ad - cfg.visibleCards) / 0.6);
        dim = clamp(ad * cfg.falloff, 0, 0.88);
        // Quarter steps: the order only changes a few times per slide instead of every frame
        zi = 100 - Math.round(ad * 4);
      } else {
        const back = Math.max(0, d);
        tx = dir * cfg.spread * d * r;
        tz = -cfg.depth * d;
        ry = dir * cfg.tilt * clamp(d, 0, 1) * r;
        opacity = d < 0 ? Math.max(0, 1 + d) : 1;
        if (ad > cfg.visibleCards + 0.5) opacity = 0;
        dim = clamp(back * cfg.falloff * 1.25, 0, 0.86);
        zi = 100 - Math.round(d * 4);
      }

      // While folded, every card but the active one hides behind it
      opacity *= 1 - Math.min(ad, 1) * (1 - r);

      const blurPx = cfg.blur > 0 ? Math.min(cfg.blur, (ad / Math.max(1, cfg.visibleCards)) * cfg.blur) : 0;

      // Each card carries its own perspective (vanishing point = stage centre), so cards are
      // stacked by z-index and never intersect each other mid-transition.
      el.style.transform = `translate(-50%, -50%) scale(${sc}) perspective(${cfg.perspective}px) translate3d(${tx.toFixed(
        2,
      )}px, 0, ${tz.toFixed(2)}px) rotateY(${ry.toFixed(3)}deg)`;
      el.style.opacity = opacity.toFixed(3);
      // Only touch the properties below when they actually change: rewriting them every
      // frame forces style and stacking work that makes the slide stutter.
      setIfChanged(el, 'filter', blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : 'none');
      setIfChanged(el, 'zIndex', String(zi));
      setIfChanged(el, 'visibility', opacity < 0.002 ? 'hidden' : 'visible');
      setIfChanged(el, 'pointerEvents', opacity > 0.05 ? 'auto' : 'none');

      const ov = overlayRefs.current[i];
      if (ov) ov.style.opacity = dim.toFixed(3);
    }

    const controls = controlsRef.current;
    if (controls) {
      controls.style.opacity = r.toFixed(3);
      controls.style.pointerEvents = r > 0.6 ? 'auto' : 'none';
    }

    const side = sideRef.current;
    if (side) {
      side.style.opacity = r.toFixed(3);
      setIfChanged(side, 'visibility', r > 0.3 ? 'visible' : 'hidden');
    }
  }, []);

  /** Places the side chevrons just outside the outermost visible card. */
  const placeSideControls = useCallback(() => {
    const root = rootRef.current;
    const side = sideRef.current;
    if (!root || !side) return;
    const cfg = cfgRef.current;
    const w = cfg.cardWidth;
    let edge = w / 2;
    if (cfg.arrangement === 'centered' && cfg.visibleCards >= 1) {
      // Projected outer edge of the first side card (it is pushed back and turned away)
      const t = (cfg.tilt * Math.PI) / 180;
      const projected =
        ((cfg.spread + (Math.cos(t) * w) / 2) * cfg.perspective) /
        (cfg.perspective + cfg.depth + (Math.sin(t) * w) / 2);
      edge = Math.max(edge, projected);
    } else if (cfg.arrangement === 'stack') {
      edge = w / 2 + Math.abs(cfg.spread);
    }
    const button = side.firstElementChild as HTMLElement | null;
    const buttonWidth = button?.offsetWidth ?? 80;
    const maxOffset = Math.max(0, root.clientWidth / 2 - buttonWidth - 4);
    const offset = Math.min(edge * scaleRef.current + SIDE_GAP, maxOffset);
    root.style.setProperty('--side-offset', `${offset.toFixed(1)}px`);
  }, []);

  const notify = useCallback(
    (idx: number) => {
      setActive(idx);
      onChangeRef.current?.(idx, items[idx]);
    },
    [items],
  );

  const tweenTo = useCallback(
    (target: number, animate: boolean) => {
      tweenRef.current?.kill();
      const cfg = cfgRef.current;
      const proxy = { p: posRef.current };
      const dur = animate && !reducedRef.current ? cfg.duration / 1000 : 0;
      tweenRef.current = gsap.to(proxy, {
        p: target,
        duration: dur,
        ease: cfg.ease,
        onUpdate: () => {
          posRef.current = proxy.p;
          layout(proxy.p);
        },
        onComplete: () => {
          const n = cfg.count;
          if (n > 0) posRef.current = ((posRef.current % n) + n) % n;
          layout(posRef.current);
        },
      });
    },
    [layout],
  );

  const setFocus = useCallback(
    (rawIndex: number, animate = true) => {
      const cfg = cfgRef.current;
      const n = cfg.count;
      if (!n) return;
      const idx = cfg.loop ? ((rawIndex % n) + n) % n : clamp(rawIndex, 0, n - 1);
      let delta = idx - posRef.current;
      if (cfg.loop && n > 1) {
        delta = ((delta % n) + n) % n;
        if (delta > n / 2) delta -= n;
      }
      tweenTo(posRef.current + delta, animate);
      if (idx !== focusRef.current) {
        focusRef.current = idx;
        notify(idx);
      }
    },
    [tweenTo, notify],
  );

  const navigateBy = useCallback((step: number) => setFocus(focusRef.current + step, true), [setFocus]);

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Responsive scaling: shrink the deck only when the active card itself wouldn't fit.
  // In the centered arrangement the side cards are allowed to bleed past the edges.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      const cfg = cfgRef.current;
      const needed =
        cfg.arrangement === 'centered' ? cfg.cardWidth + 24 : cfg.cardWidth + Math.abs(cfg.spread) * 2 + 120;
      scaleRef.current = clamp(w / needed, 0.42, 1);
      layout(posRef.current);
      placeSideControls();
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, [layout, placeSideControls]);

  // Re-lay the deck whenever the external fold/fan value changes
  useEffect(() => {
    if (!reveal) return;
    layout(posRef.current);
    return reveal.on('change', () => layout(posRef.current));
  }, [reveal, layout]);

  // Drag and swipe (mouse, pen and touch). The mouse wheel is intentionally not used:
  // it belongs to the page scroll. `touch-pan-y` on the root keeps vertical swipes scrolling.
  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const cfg = cfgRef.current;
    suppressClickRef.current = false;
    if (cfg.count < 2 || e.button !== 0) return;
    tweenRef.current?.kill();
    dragRef.current = {
      x: e.clientX,
      startPos: posRef.current,
      lastX: e.clientX,
      lastT: performance.now(),
      v: 0,
      moved: false,
      id: e.pointerId,
    };
  }, []);

  const stepPixels = () => {
    const cfg = cfgRef.current;
    return Math.max(cfg.cardWidth * 0.5 * scaleRef.current, 40);
  };

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        try {
          rootRef.current?.setPointerCapture(drag.id);
        } catch {
          // pointer already released
        }
      }
      if (!drag.moved) return;
      const now = performance.now();
      const dt = Math.max(now - drag.lastT, 1);
      drag.v = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX;
      drag.lastT = now;
      posRef.current = drag.startPos - dx / stepPixels();
      layout(posRef.current);
    },
    [layout],
  );

  const onPointerEnd = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (!drag.moved) {
      // A press that didn't move: put the deck back exactly where it was
      setFocus(focusRef.current, true);
      return;
    }
    suppressClickRef.current = true;
    const projected = posRef.current - (drag.v * 180) / stepPixels();
    // A flick moves at most two cards
    const target = clamp(Math.round(projected), Math.round(drag.startPos) - 2, Math.round(drag.startPos) + 2);
    setFocus(target, true);
  }, [setFocus]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return; // let the control buttons handle their own keys
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateBy(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateBy(1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const idx = focusRef.current;
        onItemClickRef.current?.(items[idx], idx);
      }
    },
    [navigateBy, items],
  );

  const onCardClick = useCallback(
    (index: number) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (focusRef.current === index) {
        // Active card clicked: trigger custom action / navigation
        onItemClickRef.current?.(items[index], index);
      } else {
        // Background card clicked: bring it to the front
        setFocus(index, true);
      }
    },
    [setFocus, items],
  );

  // Autoplay support
  useEffect(() => {
    if (!autoplay || count < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = rootRef.current;
    let hovered = false;
    let focused = false;
    const onEnter = () => (hovered = true);
    const onLeave = () => (hovered = false);
    const onFocusIn = () => (focused = true);
    const onFocusOut = () => (focused = false);
    autoTimerRef.current = setInterval(
      () => {
        if (!hovered && !focused) navigateBy(1);
      },
      Math.max(cfgRef.current.autoplayDelay, 600),
    );
    root?.addEventListener('mouseenter', onEnter);
    root?.addEventListener('mouseleave', onLeave);
    root?.addEventListener('focusin', onFocusIn);
    root?.addEventListener('focusout', onFocusOut);
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
      root?.removeEventListener('mouseenter', onEnter);
      root?.removeEventListener('mouseleave', onLeave);
      root?.removeEventListener('focusin', onFocusIn);
      root?.removeEventListener('focusout', onFocusOut);
    };
  }, [autoplay, autoplayDelay, count, navigateBy]);

  useEffect(() => {
    layout(posRef.current);
    placeSideControls();
  }, [
    layout,
    placeSideControls,
    arrangement,
    depth,
    spread,
    tilt,
    tiltDirection,
    perspective,
    visibleCards,
    falloff,
    blur,
    cardWidth,
    cardHeight,
    radius,
    count,
  ]);

  useEffect(
    () => () => {
      tweenRef.current?.kill();
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    },
    [],
  );

  const hasIndicators = showIndicators && count > 1;
  const hasSideControls = showControls && count > 1;

  return (
    <div
      ref={rootRef}
      className={`group/carousel relative flex h-full min-h-[360px] w-full cursor-grab touch-pan-y select-none flex-col outline-none active:cursor-grabbing focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-[#c5944e]/50 focus-visible:[outline-offset:4px] ${className}`.trim()}
      role="group"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Stage: cards are centred in whatever height is left above the controls */}
      <div className="relative min-h-0 flex-1" ref={stageRef}>
        {items.map((item, i) => {
          const isActive = active === i;
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 cursor-pointer overflow-hidden shadow-[0_40px_80px_-36px_rgba(0,0,0,0.95)] [transform:translate(-50%,-50%)] [transform-origin:center] [will-change:transform,opacity]"
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={{
                width: cardWidth,
                height: cardHeight,
                borderRadius: radius,
              }}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={!isActive}
              onClick={() => onCardClick(i)}
            >
              {renderItem ? (
                renderItem(item, i, isActive)
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="block h-full w-full select-none object-cover [pointer-events:none] [-webkit-user-drag:none]"
                  src={typeof item === 'string' ? item : (item as { image: string }).image}
                  alt={typeof item === 'string' ? '' : (item as { alt?: string }).alt || ''}
                  draggable={false}
                />
              )}

              {/* Depth falloff: darkens cards as they recede */}
              <span
                className="pointer-events-none absolute inset-0 z-10 opacity-0 [will-change:opacity]"
                ref={(el) => {
                  overlayRefs.current[i] = el;
                }}
                style={{ background: tint }}
              />
            </div>
          );
        })}

        {/* Side chevrons: previous / next */}
        {hasSideControls && (
          <div ref={sideRef} className="pointer-events-none absolute inset-0 z-[3000]">
            <SideChevron direction="prev" onClick={() => navigateBy(-1)} />
            <SideChevron direction="next" onClick={() => navigateBy(1)} />
          </div>
        )}
      </div>

      {/* Position bar: counter + progress segments */}
      {hasIndicators && (
        <div
          ref={controlsRef}
          className="relative z-[3000] mt-4 flex shrink-0 cursor-default items-center justify-center sm:mt-5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <span
              aria-hidden="true"
              className="font-cinzel w-6 text-right text-[12px] tabular-nums tracking-[0.12em] text-[#e2b36d]"
            >
              {pad2(active + 1)}
            </span>
            <div className="flex items-center" role="tablist" aria-label="Slides">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={active === i}
                  aria-label={`Go to slide ${i + 1}`}
                  className="group/seg grid h-8 cursor-pointer place-items-center px-[3px] focus-visible:outline-1 focus-visible:outline-[#c5944e]/60"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocus(i, true);
                  }}
                >
                  <span
                    className={`block h-px transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      active === i
                        ? 'w-8 bg-[#e2b36d] shadow-[0_0_8px_rgba(226,179,109,0.7)] sm:w-11'
                        : 'w-3 bg-[#ded7cb]/25 group-hover/seg:bg-[#ded7cb]/60 sm:w-4'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span
              aria-hidden="true"
              className="font-cinzel w-6 text-[12px] tabular-nums tracking-[0.12em] text-[#ded7cb]/40"
            >
              {pad2(count)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default DepthCarousel;
