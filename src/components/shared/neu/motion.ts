import type { Variants } from 'motion/react';

/**
 * Motion presets for the neumorphic UI.
 *
 * "Extrude": a card starts flat (no light, no shadow, slightly sunk) and pushes up out of the
 * parchment surface, its shadows growing as it rises. The raised value is exactly the
 * .neu-raised shadow so nothing changes when the animation settles.
 */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

export const RAISED_SHADOW =
  '8px 8px 20px 0px rgba(206, 194, 183, 0.9), -8px -8px 16px 0px rgba(252, 238, 223, 0.9), 8px -8px 16px 0px rgba(206, 194, 183, 0.2), -8px 8px 16px 0px rgba(206, 194, 183, 0.2), inset -1px -1px 2px 0px rgba(206, 194, 183, 0.5), inset 1px 1px 2px 0px rgba(252, 238, 223, 0.3)';

/** Same layers as RAISED_SHADOW with zero offset/blur/alpha, so the browser can interpolate. */
export const FLAT_SHADOW =
  '0px 0px 0px 0px rgba(206, 194, 183, 0), 0px 0px 0px 0px rgba(252, 238, 223, 0), 0px 0px 0px 0px rgba(206, 194, 183, 0), 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 0px 0px 0px 0px rgba(206, 194, 183, 0), inset 0px 0px 0px 0px rgba(252, 238, 223, 0)';

export const EXTRUDE: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.965, boxShadow: FLAT_SHADOW },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    boxShadow: RAISED_SHADOW,
    transition: {
      type: 'spring',
      stiffness: 210,
      damping: 24,
      opacity: { duration: 0.35, ease: 'easeOut' },
      boxShadow: { duration: 0.75, ease: EASE_OUT, delay: 0.08 },
    },
  },
};
