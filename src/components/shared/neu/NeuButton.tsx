'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Spinner } from './NeuIcons';

export type NeuButtonVariant = 'primary' | 'secondary' | 'dark' | 'danger';

const VARIANTS: Record<NeuButtonVariant, string> = {
  // Caramel call-to-action (Send, Confirm, Enter Meeting…)
  primary: 'neu-btn-caramel text-[#341512]',
  // Raised parchment button; light and shadow come from the #E5D8CB surface
  secondary: 'neu-raised-sm bg-[#E5D8CB] text-[#341512] hover:text-[#A8742E]',
  // Espresso emphasis (View Details, Attach…)
  dark: 'neu-btn-espresso text-[#F3E6D6]',
  // Destructive (Cancel booking, Withdraw, Decline)
  danger: 'neu-btn-danger text-white',
};

/** Ripple tint per variant: light on dark fills, caramel on parchment. */
const RIPPLE: Record<NeuButtonVariant, string> = {
  primary: 'bg-white/45',
  secondary: 'bg-[#C58B3C]/30',
  dark: 'bg-white/25',
  danger: 'bg-white/30',
};

export interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeuButtonVariant;
  icon?: React.ReactNode;
  /** Shows a spinner in place of the icon and blocks clicks. */
  loading?: boolean;
  size?: 'sm' | 'md';
}

type Ripple = { id: number; x: number; y: number; size: number };

/**
 * The one button used across the consultation booking modals and empty states. Lifts on hover,
 * presses in on click, and sends a soft ripple out from the point you pressed.
 */
export function NeuButton({
  variant = 'secondary',
  icon,
  loading = false,
  size = 'md',
  className = '',
  disabled,
  children,
  onPointerDown,
  ...rest
}: NeuButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const sizing =
    size === 'sm'
      ? 'h-9 px-4 rounded-xl text-xs gap-1.5'
      : 'h-11 min-w-[120px] px-6 rounded-xl text-xs sm:text-sm gap-2';

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const d = Math.max(r.width, r.height) * 2.2;
        setRipples((prev) => [...prev, { id: e.timeStamp, x: e.clientX - r.left - d / 2, y: e.clientY - r.top - d / 2, size: d }]);
        onPointerDown?.(e);
      }}
      // overflow-hidden clips the ripple only; the button's own box-shadow is not clipped.
      className={`relative overflow-hidden inline-flex items-center justify-center font-lora font-bold whitespace-nowrap select-none transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96] motion-reduce:transform-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizing} ${VARIANTS[variant]} ${className}`}
    >
      <AnimatePresence>
        {ripples.map((rp) => (
          <motion.span
            key={rp.id}
            aria-hidden="true"
            initial={{ scale: 0, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            onAnimationComplete={() => setRipples((prev) => prev.filter((p) => p.id !== rp.id))}
            className={`pointer-events-none absolute rounded-full ${RIPPLE[variant]}`}
            style={{ left: rp.x, top: rp.y, width: rp.size, height: rp.size }}
          />
        ))}
      </AnimatePresence>
      <span className="relative inline-flex items-center justify-center gap-[inherit]">
        {loading ? <Spinner className="w-4 h-4" /> : icon}
        {children}
      </span>
    </button>
  );
}

export default NeuButton;
