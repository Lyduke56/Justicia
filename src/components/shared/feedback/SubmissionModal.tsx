'use client';

/**
 * Dialog frame for actions that submit something (book, approve, confirm payment, save …).
 *
 *  idle       → the full sheet you pass as children (usually a NeuModalSheet).
 *  processing → the sheet fades and blurs out, the panel shrinks to a compact card and the
 *               SubmissionBadge runs its line around the groove.
 *  success    → the line writes a check; the copy and a "Done" button follow once it lands.
 *  error      → the line writes an X; the error, "Try again" (back to the sheet) and "Close" follow.
 *
 * The compact card keeps one height in every state so nothing jumps when the mark lands.
 * Esc, the backdrop and the close buttons are disabled while the request runs.
 * Render it inside <AnimatePresence> so the overlay and panel animate out when it closes.
 * Pair it with useSubmission, which only reports success or error from the real result.
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { NeuButton, NEU_MODAL_SIZES, type NeuModalSize } from '@/components/shared/neu';
import { overlayVariants, panelVariants } from '@/components/shared/neu/NeuModal';
import { SubmissionBadge } from './SubmissionBadge';
import type { SubmissionPhase } from './useSubmission';

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
const noopSubscribe = () => () => {};

export interface SubmissionCopy {
  title: React.ReactNode;
  message?: React.ReactNode;
}

export interface SubmissionModalProps {
  phase: SubmissionPhase;
  /** id of the visible heading (the sheet's title, then the status card's). */
  titleId: string;
  /** Width of the full sheet. */
  size?: NeuModalSize;
  onClose: () => void;
  /** "Try again" after an error: back to the sheet (the error can be shown there too). */
  onRetry?: () => void;
  processing: SubmissionCopy;
  success: SubmissionCopy & { actionLabel?: string };
  /** Message defaults to `error`. */
  failure: SubmissionCopy & { retryLabel?: string; closeLabel?: string };
  /** The error the request answered with. */
  error?: string | null;
  /** Small pills under the message (e.g. the date and time that was booked). */
  details?: React.ReactNode;
  /** After a success that now waits on someone else, keep a bead circling the badge. */
  waitingAfterSuccess?: boolean;
  /** The full sheet shown while idle. */
  children: React.ReactNode;
}

export interface SubmissionStatusProps extends Omit<SubmissionModalProps, 'children' | 'size'> {
  /** Padding / layout of the card (defaults to the compact modal card). */
  className?: string;
  /** Replaces the default buttons once the mark has landed (e.g. links on an auth page). */
  actions?: React.ReactNode;
}

/**
 * The compact result card on its own: badge, copy that changes when the mark lands, optional
 * detail pills and buttons. SubmissionModal shows it after the sheet shrinks; auth panels show
 * it inline in place of their form.
 */
export function SubmissionStatus({
  phase,
  titleId,
  processing,
  success,
  failure,
  error,
  details,
  waitingAfterSuccess,
  onClose,
  onRetry,
  className = 'px-7 sm:px-9 pt-9 pb-8',
  actions,
}: SubmissionStatusProps) {
  const outcome = phase === 'success' ? 'success' : phase === 'error' ? 'error' : null;
  // The copy and buttons change when the mark has landed, not when the server answers.
  const [landedFor, setLandedFor] = useState<string | null>(null);
  const finished = outcome !== null && landedFor === outcome;
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (finished) actionsRef.current?.querySelector('button')?.focus();
  }, [finished]);

  const copy: SubmissionCopy = !finished
    ? processing
    : outcome === 'success'
      ? success
      : { title: failure.title, message: failure.message ?? error ?? 'Please try again.' };

  return (
    <motion.div
      key="status"
      layout
      className={`flex flex-col items-center text-center ${className}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: 0.08, ease: EASE_OUT }}
    >
      <SubmissionBadge
        outcome={outcome}
        waiting={finished && outcome === 'success' && waitingAfterSuccess}
        onLanded={() => setLandedFor(outcome)}
      />

      <motion.div layout className="mt-6 min-h-[6.5rem] w-full" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={finished ? outcome : 'working'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <h2
              id={titleId}
              className={`font-lora text-xl font-bold leading-tight ${finished && outcome === 'error' ? 'text-[#7A1A12]' : 'text-[#341512]'}`}
            >
              {copy.title}
            </h2>
            {copy.message && (
              <p
                role={finished && outcome === 'error' ? 'alert' : undefined}
                className="mx-auto mt-2 max-w-[36ch] font-inter text-[13px] leading-relaxed text-[#5C4535] whitespace-pre-line break-words"
              >
                {copy.message}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {details && (
        <motion.div layout className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {details}
        </motion.div>
      )}

      {/* Space is held while working so the card doesn't grow when the buttons appear. */}
      <motion.div
        ref={actionsRef}
        layout
        className="mt-6 flex w-full flex-col-reverse items-stretch justify-center gap-3 sm:flex-row sm:items-center"
        style={{ visibility: finished ? 'visible' : 'hidden' }}
        initial={false}
        animate={finished ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={{ duration: 0.3, delay: finished ? 0.15 : 0, ease: EASE_OUT }}
      >
        {actions ? (
          actions
        ) : outcome === 'error' ? (
          <>
            <NeuButton variant="secondary" onClick={onClose} className="w-full sm:w-40">
              {failure.closeLabel ?? 'Close'}
            </NeuButton>
            {onRetry && (
              <NeuButton variant="primary" onClick={onRetry} className="w-full sm:w-40">
                {failure.retryLabel ?? 'Try Again'}
              </NeuButton>
            )}
          </>
        ) : (
          <NeuButton variant="primary" onClick={onClose} className="w-full sm:w-48">
            {success.actionLabel ?? 'Done'}
          </NeuButton>
        )}
      </motion.div>
    </motion.div>
  );
}

export function SubmissionModal({ phase, titleId, size = 'lg', onClose, children, ...status }: SubmissionModalProps) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // The panel only shrinks once the sheet has faded out; it grows back when returning to idle.
  const [compact, setCompact] = useState(phase !== 'idle');
  if (phase === 'idle' && compact) setCompact(false);
  const leaving = phase !== 'idle' && !compact;

  const dismissible = phase !== 'processing';

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  if (!mounted) return null;

  return createPortal(
    <MotionConfig reducedMotion="user">
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4 sm:p-6 bg-[radial-gradient(ellipse_at_center,rgba(26,15,10,0.5)_0%,rgba(26,15,10,0.78)_100%)]"
        style={{ perspective: 1400 }}
        variants={overlayVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && dismissible) onClose();
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-busy={phase === 'processing' || undefined}
          variants={panelVariants}
          layout
          transition={{ layout: { type: 'spring', stiffness: 260, damping: 30, mass: 0.9 } }}
          // Radius in style so motion keeps the corners round while the panel resizes.
          style={{ borderRadius: 30, transformOrigin: '50% 50%' }}
          className={`neu-modal relative my-auto flex w-full max-h-[90vh] flex-col overflow-hidden ${
            compact ? 'max-w-[26rem]' : NEU_MODAL_SIZES[size]
          }`}
        >
          {compact ? (
            <SubmissionStatus phase={phase} titleId={titleId} onClose={onClose} {...status} />
          ) : (
            <motion.div
              key="sheet"
              className={`flex min-h-0 flex-1 flex-col ${leaving ? 'pointer-events-none' : ''}`}
              initial={{ opacity: 0 }}
              animate={leaving ? { opacity: 0, scale: 0.97, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: leaving ? 0.22 : 0.3, ease: EASE_OUT }}
              onAnimationComplete={() => {
                if (leaving) setCompact(true);
              }}
            >
              {children}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </MotionConfig>,
    document.body
  );
}

export default SubmissionModal;
