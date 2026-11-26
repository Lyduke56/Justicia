'use client';

/**
 * The loading indicator for content inside a screen: a tab's data, a list, a grid, a chart, a
 * picker in a modal. A small pressed-in groove with a caramel arc running around it (the same
 * language as the booking submit loader) and "Loading..." with breathing dots under it.
 *
 * The GIF loader (ScreenLoader) is only for whole-screen loads and tab/screen switches; use this
 * everywhere else.
 */
import React from 'react';

export interface PanelLoaderProps {
  /** Text under the spinner. */
  label?: string;
  /** Spoken to screen readers (defaults to the label). */
  srLabel?: string;
  /** Spacing / height of the frame (e.g. `min-h-[18rem]`, `h-full`, `py-6!`). */
  className?: string;
}

export function PanelLoader({ label = 'Loading...', srLabel, className = '' }: PanelLoaderProps) {
  // "Loading..." with the three dots breathing in turn; screen readers get the plain label.
  const text = label.replace(/(\.\.\.|…)$/, '');
  const hasDots = text !== label;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={srLabel ?? label}
      className={`flex w-full flex-col items-center justify-center py-10 select-none sm:py-12 ${className}`}
    >
      <span aria-hidden="true" className="relative size-11 sm:size-12">
        {/* Pressed-in groove. */}
        <span className="absolute inset-0 rounded-full" style={{ boxShadow: 'var(--neu-pressed-sm-shadow)' }} />
        {/* Caramel arc running around it. */}
        <svg viewBox="0 0 48 48" className="absolute inset-0 size-full animate-spin">
          <circle cx="24" cy="24" r="18.5" fill="none" stroke="#C58B3C" strokeOpacity="0.18" strokeWidth="3.5" />
          <circle cx="24" cy="24" r="18.5" fill="none" stroke="#C58B3C" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="34 120" />
        </svg>
      </span>
      <p aria-hidden="true" className="mt-3 font-lora text-xs font-semibold tracking-wide text-[#5C4535] sm:text-[13px]">
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

export default PanelLoader;
