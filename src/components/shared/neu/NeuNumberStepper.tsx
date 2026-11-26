'use client';

/**
 * Up / down buttons for a number field, in place of the browser's spinner arrows (globals.css
 * hides those because they can't be styled). A small raised capsule sits inside the right edge of
 * the field; give the input `pr-12` so the text clears it.
 *
 *   <div className="relative">
 *     <input type="number" className="… pr-12" value={v} onChange={…} />
 *     <NeuNumberStepper value={v} onChange={setV} min={0} label="Years of practice" />
 *   </div>
 *
 * Press and hold repeats. The buttons are skipped by Tab (like native spinners); keyboard users
 * already have the arrow keys on the field itself.
 */
import React, { useEffect, useRef } from 'react';

export interface NeuNumberStepperProps {
  /** The field's current value (as typed, so it may be empty). */
  value: string | number;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Where to start when the field is empty (defaults to min, else 0). */
  fallback?: number;
  /** Names the field for screen readers: "Increase {label}". */
  label: string;
  disabled?: boolean;
  className?: string;
}

const HOLD_DELAY_MS = 400;
const REPEAT_MS = 70;

function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

export function NeuNumberStepper({ value, onChange, step = 1, min, max, fallback, label, disabled = false, className = '' }: NeuNumberStepperProps) {
  // Latest props for the hold-to-repeat timer, which outlives a single render.
  const latest = useRef({ value, onChange, step, min, max, fallback });
  useEffect(() => {
    latest.current = { value, onChange, step, min, max, fallback };
  });
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});

  const bump = (direction: 1 | -1) => {
    const { value: v, onChange: change, step: s, min: lo, max: hi, fallback: fb } = latest.current;
    const current = v === '' || v === null || Number.isNaN(Number(v)) ? null : Number(v);
    let next = current === null ? (fb ?? lo ?? 0) : current + direction * s;
    if (lo !== undefined) next = Math.max(lo, next);
    if (hi !== undefined) next = Math.min(hi, next);
    // Keep the step's decimals without float noise (e.g. 0.1 + 0.2).
    const decimals = (String(s).split('.')[1] ?? '').length;
    change(decimals ? next.toFixed(decimals) : String(Math.round(next)));
    // Write the new value into the ref right away so held repeats keep counting.
    latest.current = { ...latest.current, value: decimals ? next.toFixed(decimals) : String(Math.round(next)) };
  };

  const stop = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
    timers.current = {};
  };
  useEffect(() => stop, []);

  const press = (e: React.PointerEvent, direction: 1 | -1) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault(); // keep focus where it is (usually the field)
    stop();
    bump(direction);
    timers.current.delay = setTimeout(() => {
      timers.current.repeat = setInterval(() => bump(direction), REPEAT_MS);
    }, HOLD_DELAY_MS);
  };

  const num = value === '' || Number.isNaN(Number(value)) ? null : Number(value);
  const atMax = max !== undefined && num !== null && num >= max;
  const atMin = min !== undefined && num !== null && num <= min;

  const half =
    'grid flex-1 place-items-center text-[#7A604D] transition-colors hover:bg-[#D39758]/15 hover:text-[#341512] active:bg-[#D39758]/25 disabled:cursor-not-allowed disabled:text-[#B9A48F] disabled:hover:bg-transparent cursor-pointer';

  return (
    <span
      className={`absolute right-2.5 top-1/2 flex h-[30px] w-6 -translate-y-1/2 flex-col overflow-hidden rounded-[8px] bg-[#E5D8CB] shadow-[2px_2px_5px_rgba(190,170,150,0.55),-2px_-2px_5px_rgba(255,248,240,0.85)] ${
        disabled ? 'opacity-60' : ''
      } ${className}`}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Increase ${label}`}
        disabled={disabled || atMax}
        onPointerDown={(e) => press(e, 1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        className={half}
      >
        <Chevron up />
      </button>
      <span aria-hidden="true" className="h-px bg-[#C8B59E]/60" />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Decrease ${label}`}
        disabled={disabled || atMin}
        onPointerDown={(e) => press(e, -1)}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        className={half}
      >
        <Chevron up={false} />
      </button>
    </span>
  );
}

export default NeuNumberStepper;
