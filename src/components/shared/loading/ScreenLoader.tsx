'use client';

/**
 * The loading screen of the app: a looping illustration (one of the three GIFs in public/assets,
 * picked at random and never the same twice in a row) with "Loading..." under it.
 *
 * Only for whole-screen loads and screen / tab switches. Content loading inside a screen (a tab's
 * data, a list, a chart, a picker) uses PanelLoader, the plain spinner, instead.
 *
 * Variants
 *  - fullscreen: covers the whole window (e.g. while sign-in hands over to a portal).
 *  - overlay:    covers its positioned parent (the portal's content area during a tab switch).
 *  - page:       fills the portal's content area as a route's loading.tsx fallback. It sits in the
 *                same spot as `overlay`, so the two hand over without a jump.
 *
 * The picture is only rendered in the browser (the pick is random), and it fades in once loaded
 * so a slow first download never shows a broken or half-drawn image.
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { loaderHidden, loaderShown, pickLoadingGif } from './loadingGifs';

export type ScreenLoaderVariant = 'fullscreen' | 'overlay' | 'page';

const FRAME: Record<ScreenLoaderVariant, string> = {
  fullscreen: 'fixed inset-0 z-[200] bg-[#E5D8CB]',
  overlay: 'absolute inset-0 z-40 bg-[#E5D8CB]',
  // 4rem = the portal top bar, so the loader centres in the visible content area.
  page: 'w-full min-h-[calc(100dvh-4rem)] bg-[#E5D8CB]',
};

const GIF_SIZE: Record<ScreenLoaderVariant, string> = {
  fullscreen: 'size-36 sm:size-44',
  overlay: 'size-32 sm:size-40',
  page: 'size-32 sm:size-40',
};

const noopSubscribe = () => () => {};

export interface ScreenLoaderProps {
  variant?: ScreenLoaderVariant;
  /** Text under the picture. */
  label?: string;
  /** Spoken to screen readers (defaults to the label). */
  srLabel?: string;
  /** Surface colour for the covering variants (e.g. the admin portal's lighter paper). */
  background?: string;
  className?: string;
}

export function ScreenLoader({
  variant = 'page',
  label = 'Loading...',
  srLabel,
  background,
  className = '',
}: ScreenLoaderProps) {
  // false during SSR and hydration, true afterwards: the random pick never causes a mismatch.
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [gif] = useState(pickLoadingGif);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = loadedSrc === gif;

  useEffect(() => {
    loaderShown();
    return loaderHidden;
  }, []);

  // "Loading..." with the three dots breathing in turn; screen readers get the plain label.
  const text = label.replace(/(\.\.\.|…)$/, '');
  const hasDots = text !== label;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={srLabel ?? label}
      className={`flex flex-col items-center justify-center select-none ${FRAME[variant]} ${className}`}
      style={background ? { backgroundColor: background } : undefined}
    >
      <div className={`relative grid place-items-center ${GIF_SIZE[variant]}`} aria-hidden="true">
        {/* Held space + a soft caramel ring while the picture downloads. */}
        {!loaded && <span className="screen-loader-ring absolute size-16 rounded-full" />}
        {inBrowser && (
          // eslint-disable-next-line @next/next/no-img-element -- animated GIF, served as-is
          <img
            src={gif}
            alt=""
            draggable={false}
            decoding="async"
            ref={(img) => {
              // Already cached: `load` may have fired before React attached the handler.
              if (img?.complete && img.naturalWidth > 0 && loadedSrc !== gif) setLoadedSrc(gif);
            }}
            onLoad={() => setLoadedSrc(gif)}
            className={`relative size-full object-contain transition-[opacity,transform] duration-500 ease-out ${
              loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        )}
      </div>
      <p
        aria-hidden="true"
        className="mt-3 font-lora text-sm font-semibold tracking-wide text-[#5C4535] sm:text-base"
      >
        {text}
        {hasDots && (
          <span className="screen-loader-dots">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Small inline indicator for a value or line that is still loading (a KPI figure, a note), so a
 * loading component never shows the skeleton bars it used to: three caramel dots in a row.
 */
export function InlineLoader({ className = '', label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={`ink-dots ${className}`}>
      <span />
      <span />
      <span />
    </span>
  );
}

export default ScreenLoader;
