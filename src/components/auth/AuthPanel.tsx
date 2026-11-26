'use client';

/**
 * Surfaces for the authentication screens, styled like the portal's dialogs (inset parchment
 * panel with the caramel rim, Lora title, Inter subtitle, raised icon tile):
 *
 *  - AuthDialog:      a real modal (landing page sign-in / forgot password). The backdrop and
 *                     panel animate in and out together, and the panel resizes smoothly when its
 *                     content changes (e.g. sign in → forgot password).
 *  - AuthPageCard:    the same panel standing on a parchment page (/forgot-password,
 *                     /auth/reset-password, /verify-email), with the Justicia mark above it.
 *  - AuthPanelHeader: the centred header used inside both.
 */
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AnimatePresence, motion, MotionConfig, useReducedMotion, type Variants } from 'motion/react';
import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import { CloseIcon } from '@/components/shared/neu';
import { overlayVariants } from '@/components/shared/neu/NeuModal';

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const noopSubscribe = () => () => {};

export function AuthPanelHeader({
  icon,
  title,
  subtitle,
  titleId,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon && (
        <motion.div
          initial={{ scale: 0.4, rotate: -16, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 440, damping: 16, delay: 0.1 }}
          className="relative mb-4 grid size-14 place-items-center rounded-2xl text-[#C58B3C] neu-raised-sm"
          aria-hidden="true"
        >
          {/* One soft ring ripples out as the panel lands. */}
          <motion.span
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.35, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-current"
          />
          {icon}
        </motion.div>
      )}
      <h2 id={titleId} className="text-balance font-lora text-[27px] sm:text-[31px] font-semibold leading-tight tracking-[-0.01em] text-[#34150F]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-2 max-w-[36ch] text-balance font-inter text-[13.5px] leading-relaxed text-[#5C4535]">{subtitle}</p>
      )}
    </div>
  );
}

const panelVariants: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.94, rotateX: 12, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 260, damping: 25, opacity: { duration: 0.22 }, filter: { duration: 0.3 } },
  },
  exit: { opacity: 0, y: 28, scale: 0.95, rotateX: -8, filter: 'blur(5px)', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } },
};

export interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  /** id of the visible title. */
  labelledBy: string;
  /** Called after the closing animation (e.g. to reset the dialog to its first view). */
  onExitComplete?: () => void;
  children: React.ReactNode;
}

export function AuthDialog({ open, onClose, labelledBy, onExitComplete, children }: AuthDialogProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Read through a ref so a new onClose identity on every parent render doesn't re-run the
  // open/close effect (which would steal focus back to the first field).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Lock page scroll, close on Escape, and return focus to where it was when the dialog closes.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    // Focus the first field once the panel is in place.
    const focusTimer = setTimeout(() => panelRef.current?.querySelector<HTMLElement>('input:not([type=hidden]), button')?.focus(), 80);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      clearTimeout(focusTimer);
      previous?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence onExitComplete={onExitComplete}>
        {open && (
          <motion.div
            key="auth-dialog"
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(ellipse_at_center,rgba(26,15,10,0.55)_0%,rgba(26,15,10,0.82)_100%)]"
            style={{ perspective: 1400 }}
            variants={overlayVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              variants={panelVariants}
              layout
              transition={{ layout: { type: 'spring', stiffness: 300, damping: 32 } }}
              style={{ borderRadius: 30, transformOrigin: '50% 100%' }}
              className="neu-modal relative my-auto w-full max-w-[460px] overflow-hidden"
            >
              <motion.button
                type="button"
                aria-label="Close"
                onClick={onClose}
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
                className="absolute right-5 top-5 z-10 grid size-9 place-items-center rounded-full text-[#5C4535] transition-colors hover:text-[#A8742E] neu-raised-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </motion.button>
              <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto neu-scrollbar-discrete px-6 pb-8 pt-9 sm:px-10 sm:pb-9 sm:pt-11">
                {children}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body
  );
}

/** Animated swap between views inside an auth panel (sign in ↔ forgot password, form ↔ result). */
export function AuthPanelView({ viewKey, direction = 1, children }: { viewKey: string; direction?: 1 | -1; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={viewKey}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 28 * direction, filter: 'blur(4px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, x: -28 * direction, filter: 'blur(4px)' }}
        transition={{ duration: 0.26, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** A standalone auth page: parchment backdrop, the Justicia mark, and the dialog-style panel. */
export function AuthPageCard({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[#E5D8CB] px-4 py-10 sm:py-14">
      {/* Soft caramel glow behind the panel, like light on parchment. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(211,151,88,0.22)_0%,rgba(229,216,203,0)_65%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="relative mb-7"
      >
        <Link
          href="/"
          aria-label="Justicia home"
          className="block rounded-md text-[#34150F] transition-colors hover:text-[#C58B3C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C58B3C]/60"
        >
          <JusticiaLogo className="h-auto w-40" />
        </Link>
      </motion.div>
      <motion.section
        layout
        initial={{ opacity: 0, y: 36, scale: 0.96, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 220, damping: 26, opacity: { duration: 0.3 }, filter: { duration: 0.35 }, layout: { type: 'spring', stiffness: 300, damping: 32 } }}
        style={{ borderRadius: 30 }}
        className="neu-modal relative w-full max-w-[460px] px-7 pb-8 pt-9 sm:px-10 sm:pb-10 sm:pt-10"
      >
        {children}
      </motion.section>
      {footer && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="relative mt-6 text-center font-inter text-[12px] text-[#7A604D]"
        >
          {footer}
        </motion.div>
      )}
    </main>
  );
}
