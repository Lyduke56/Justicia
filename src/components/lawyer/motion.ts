import type { Variants } from 'motion/react';
import { RAISED_SHADOW } from '@/components/shared/neu';

/**
 * Lawyer dashboard motion: one material gesture, "the parchment embosses its content".
 *
 *  - EMBOSS: a raised surface first appears pressed into the paper (an imprint: inset shade
 *    top-left, light bottom-right), then pushes up until it casts the regular .neu-raised shadow.
 *  - CARVE:  a recessed well starts flush with the page and sinks to the .neu-recessed depth.
 *
 * Every keyframe keeps the same shadow layers (count, order, inset or not) as the CSS class it
 * settles into, so the browser interpolates them and nothing jumps when the animation ends.
 * Content inside a surface rises in after the surface has formed.
 */

export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** RAISED_SHADOW's layers (4 outer, 2 inset) arranged as an imprint pressed into the page. */
export const DEBOSSED_SHADOW =
  '0px 0px 0px 0px rgba(206, 194, 183, 0), 0px 0px 0px 0px rgba(252, 238, 223, 0), 0px 0px 0px 0px rgba(206, 194, 183, 0), 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 6px 6px 12px 0px rgba(206, 194, 183, 0.85), inset -6px -6px 12px 0px rgba(252, 238, 223, 0.9)';

/** A little higher than RAISED_SHADOW, for hover. */
export const LIFTED_SHADOW =
  '11px 11px 24px 0px rgba(206, 194, 183, 0.95), -9px -9px 18px 0px rgba(252, 238, 223, 0.95), 9px -9px 18px 0px rgba(206, 194, 183, 0.2), -9px 9px 18px 0px rgba(206, 194, 183, 0.2), inset -1px -1px 2px 0px rgba(206, 194, 183, 0.5), inset 1px 1px 2px 0px rgba(252, 238, 223, 0.3)';

/** Exactly .neu-recessed. */
export const RECESSED_SHADOW =
  '-1px -1px 2px 0px rgba(206, 194, 183, 0.5), 1px 1px 2px 0px rgba(252, 238, 223, 0.3), inset 5px 5px 13px 0px rgba(206, 194, 183, 0.9), inset -5px -5px 10px 0px rgba(252, 238, 223, 0.9), inset 5px -5px 10px 0px rgba(206, 194, 183, 0.2), inset -5px 5px 10px 0px rgba(206, 194, 183, 0.2)';

/** .neu-recessed's layers at zero: flush with the page. */
export const FLUSH_SHADOW =
  '0px 0px 0px 0px rgba(206, 194, 183, 0), 0px 0px 0px 0px rgba(252, 238, 223, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 0px 0px 0px 0px rgba(252, 238, 223, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0)';

export const PAGE: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.04 } },
};

export const GROUP: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const EMBOSS: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.985, boxShadow: DEBOSSED_SHADOW },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    boxShadow: RAISED_SHADOW,
    transition: {
      opacity: { duration: 0.22, ease: 'easeOut' },
      boxShadow: { duration: 0.8, delay: 0.14, ease: EASE_OUT },
      y: { type: 'spring', stiffness: 220, damping: 24, delay: 0.14 },
      scale: { type: 'spring', stiffness: 220, damping: 24, delay: 0.14 },
      // Contents rise once the surface has formed (not after its whole shadow settles).
      delayChildren: 0.22,
      staggerChildren: 0.06,
    },
  },
};

export const CARVE: Variants = {
  hidden: { opacity: 0, boxShadow: FLUSH_SHADOW },
  show: {
    opacity: 1,
    boxShadow: RECESSED_SHADOW,
    transition: {
      opacity: { duration: 0.25, ease: 'easeOut' },
      boxShadow: { duration: 0.7, ease: EASE_OUT },
      delayChildren: 0.18,
      staggerChildren: 0.06,
    },
  },
};

export const RISE: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Divider draws outward from its centre. */
export const DRAW: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  show: { scaleX: 1, opacity: 1, transition: { duration: 0.7, ease: EASE_OUT } },
};

/** Heading text rolls up/down when the filter changes. */
export const ROLL: Variants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.16 } },
};

/** Switching between grid and list. */
export const SWAP: Variants = {
  enter: { opacity: 0, y: 14 },
  center: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.16, ease: 'easeIn' } },
};

/** Card content slides the way you paged, its sections cascading (same as the client card). */
export const CARD_SLIDE: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 48 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 32, staggerChildren: 0.05, delayChildren: 0.03 },
  },
  exit: (d: number) => ({ opacity: 0, x: -d * 48, transition: { duration: 0.16, ease: 'easeIn' } }),
};

export const CARD_POP: Variants = {
  enter: { opacity: 0, scale: 0.94, y: -6 },
  center: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 24 } },
};

export const CARD_ITEM: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE_OUT } },
};

/** Table rows rise in top to bottom. */
export const ROWS: Variants = {
  enter: {},
  center: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

export const ROW: Variants = {
  enter: { opacity: 0, y: 10 },
  center: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 360, damping: 30 } },
};

/** Popover unfolds from a hinge at its top edge (same as the top bar's popovers). */
export const POPOVER: Variants = {
  hidden: { opacity: 0, rotateX: -24, y: -12, scale: 0.94 },
  show: {
    opacity: 1,
    rotateX: 0,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24, mass: 0.9, opacity: { duration: 0.18 } },
  },
  exit: { opacity: 0, rotateX: -18, y: -8, scale: 0.96, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};

/** Calendar grid slides in the direction you browse. */
export const GRID_SLIDE: Variants = {
  enter: (d: number) => ({ opacity: 0, x: d * 28 }),
  center: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 340, damping: 32 } },
  exit: (d: number) => ({ opacity: 0, x: -d * 28, transition: { duration: 0.14 } }),
};
