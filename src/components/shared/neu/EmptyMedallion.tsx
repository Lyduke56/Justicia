'use client';

/**
 * The picture at the top of every empty / no-results state: a soft pressed-in well, a flat raised
 * parchment disc holding the caramel icon (no glow, gradient or highlight), and a faint dotted
 * orbit with one small bead circling it. The disc pops in, the icon floats gently and the bead keeps a slow turn, so an empty screen
 * still feels alive without drawing attention.
 *
 * The shadows are tuned for small objects (tight offsets, short blur) rather than the large
 * neu-raised surfaces, so they read as depth instead of a smudge.
 */
import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export type EmptyMedallionSize = 'sm' | 'md' | 'lg';

const SIZES: Record<EmptyMedallionSize, { well: number; disc: number; icon: string }> = {
  sm: { well: 64, disc: 40, icon: '[&_svg]:size-5' },
  md: { well: 88, disc: 54, icon: '[&_svg]:size-[26px]' },
  lg: { well: 104, disc: 64, icon: '[&_svg]:size-[30px]' },
};

export interface EmptyMedallionProps {
  icon: React.ReactNode;
  size?: EmptyMedallionSize;
  className?: string;
}

export function EmptyMedallion({ icon, size = 'md', className = '' }: EmptyMedallionProps) {
  const reduce = useReducedMotion();
  const s = SIZES[size];
  // The orbit sits halfway between the disc and the well's rim.
  const orbit = (s.well + s.disc) / 2;

  return (
    <div
      aria-hidden="true"
      className={`relative mx-auto grid shrink-0 place-items-center rounded-full ${className}`}
      style={{
        width: s.well,
        height: s.well,
        boxShadow: 'inset 3px 3px 7px rgba(190, 170, 150, 0.7), inset -3px -3px 7px rgba(255, 249, 241, 0.9)',
      }}
    >
      {/* Dotted orbit + one caramel bead going round. */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute"
        style={{ width: orbit, height: orbit }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 16, ease: 'linear', repeat: Infinity }}
      >
        <circle cx="50" cy="50" r="48" fill="none" stroke="#C58B3C" strokeOpacity="0.5" strokeWidth="1.6" strokeDasharray="1.5 5.5" strokeLinecap="round" />
        <circle cx="50" cy="2" r="3.6" fill="#C58B3C" />
      </motion.svg>

      {/* Raised disc with the icon. */}
      <motion.span
        className="relative grid place-items-center rounded-full text-[#B07A34]"
        style={{
          width: s.disc,
          height: s.disc,
          // Flat parchment, no gloss: depth comes only from the raised shadow.
          background: '#E5D8CB',
          boxShadow: '3px 3px 7px rgba(190, 170, 150, 0.65), -3px -3px 7px rgba(255, 249, 241, 0.95)',
        }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 380, damping: 18, delay: 0.08 }}
      >
        <span className={`neu-float flex ${s.icon}`}>{icon}</span>
      </motion.span>
    </div>
  );
}

export default EmptyMedallion;
