'use client';

/**
 * The My Documents modal treatment, shared: rendered into <body> (never clipped), a warm vignette
 * backdrop that blurs in, and a recessed parchment sheet (.neu-modal) that tips up from below and
 * comes into focus while its caramel rim closes in around it. Direct children of the sheet (and of
 * a <form> inside it) cascade in. On close the sheet tips back, the rim lets go and it blurs out.
 *
 * Wrap nothing in AnimatePresence yourself — toggle `isOpen` and the exit plays.
 */
import React, { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import { EASE_OUT } from './motion';

const RIM = 'rgba(211, 151, 88, 1)';
const RIM_CLEAR = 'rgba(211, 151, 88, 0)';

const backdropVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  show: { opacity: 1, backdropFilter: 'blur(7px)', transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: 0.24, ease: 'easeIn', delay: 0.06 } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 64, scale: 0.9, rotateX: 18, filter: 'blur(10px)', outlineOffset: '16px', outlineColor: RIM_CLEAR },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    outlineOffset: '0px',
    outlineColor: RIM,
    transition: {
      type: 'spring',
      stiffness: 230,
      damping: 23,
      mass: 0.9,
      opacity: { duration: 0.25 },
      filter: { duration: 0.4, ease: 'easeOut' },
      outlineOffset: { duration: 0.55, ease: EASE_OUT, delay: 0.12 },
      outlineColor: { duration: 0.4, ease: 'easeOut', delay: 0.12 },
    },
  },
  exit: {
    opacity: 0,
    y: 40,
    scale: 0.94,
    rotateX: -12,
    filter: 'blur(8px)',
    outlineOffset: '12px',
    outlineColor: RIM_CLEAR,
    transition: { duration: 0.26, ease: [0.4, 0, 1, 1] },
  },
};

/** Section cascade (same timing as the Documents modals). */
const CASCADE_CSS = `
@keyframes pm-fade-up {
  from { opacity: 0; transform: translateY(12px); filter: blur(4px); }
  to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}
@keyframes pm-pop {
  0%   { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  60%  { opacity: 1; transform: scale(1.06) rotate(2deg); }
  100% { opacity: 1; transform: scale(1) rotate(0); }
}
.pm-card > *, .pm-card form > * { animation: pm-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: 0.1s; }
.pm-card > form, .pm-card > .pm-close { animation: none; }
.pm-card > *:nth-child(2), .pm-card form > *:nth-child(1) { animation-delay: 0.15s; }
.pm-card > *:nth-child(3), .pm-card form > *:nth-child(2) { animation-delay: 0.2s; }
.pm-card > *:nth-child(4), .pm-card form > *:nth-child(3) { animation-delay: 0.25s; }
.pm-card > *:nth-child(5), .pm-card form > *:nth-child(4) { animation-delay: 0.3s; }
.pm-card > *:nth-child(n+6), .pm-card form > *:nth-child(n+5) { animation-delay: 0.35s; }
.pm-pop { animation: pm-pop 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards; }
@media (prefers-reduced-motion: reduce) {
  .pm-card *, .pm-card *::before, .pm-card *::after { animation-duration: 0.001ms !important; animation-delay: 0ms !important; }
}
`;

// Shared scroll-lock counter so closing one stacked modal never unlocks the page while another is open.
let openCount = 0;
const noopSubscribe = () => () => {};

export interface ParchmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** False while saving: backdrop, Esc and the ✕ are ignored. */
  dismissible?: boolean;
  children: React.ReactNode;
  maxWidth?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** Extra classes for the sheet (padding etc.). */
  className?: string;
}

export function ParchmentModal({
  isOpen,
  onClose,
  dismissible = true,
  children,
  maxWidth = 'max-w-[480px] sm:max-w-[520px]',
  ariaLabel,
  ariaLabelledBy,
  className = 'px-6 sm:px-9 pt-8 pb-7 sm:pt-9 sm:pb-8',
}: ParchmentModalProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!isOpen) return;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    return () => {
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, dismissible, onClose]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="parchment-modal"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
            style={{ perspective: 1400 }}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <style>{CASCADE_CSS}</style>
            {/* Warm vignette backdrop */}
            <motion.div
              variants={backdropVariants}
              className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,15,10,0.55)_0%,rgba(26,15,10,0.82)_100%)]"
              onClick={() => dismissible && onClose()}
              aria-hidden="true"
            />
            <motion.div
              variants={panelVariants}
              style={{ transformOrigin: '50% 100%' }}
              className={`pm-card neu-modal relative z-10 w-full ${maxWidth} max-h-[88vh] overflow-y-auto neu-scrollbar-discrete ${className}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Close dialog"
                className="pm-close absolute top-4 right-4 sm:top-5 sm:right-5 size-9 rounded-full flex items-center justify-center text-[#5A4537] hover:text-[#34150F] hover:bg-[#D4C1AB]/40 hover:rotate-90 transition-[color,background-color,rotate] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B9833C]/50 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                ✕
              </button>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

export default ParchmentModal;
