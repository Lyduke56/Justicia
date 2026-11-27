'use client';

/**
 * The booking dialog's submit animation for any dialog or form in the app.
 *
 *  SubmitModal       → a NeuModal whose sheet morphs into the loader when you submit, then the line
 *                      writes a check (success) or an X (error). Takes the same props as NeuModal
 *                      plus the submission's phase and copy. Render it inside <AnimatePresence>.
 *  SubmissionOverlay → the same loader → check / X card on its own, for forms that are not in a
 *                      dialog (settings, profile, Payment QR…). It appears when the submission
 *                      starts and goes away when the person closes it.
 *
 * Pair both with useSubmission: the check or X only follows the real answer of the request.
 */
import React, { useId } from 'react';
import { AnimatePresence } from 'motion/react';
import { NeuAlert, NeuModalSheet, type NeuModalProps } from '@/components/shared/neu';
import { SubmissionModal, type SubmissionCopy } from './SubmissionModal';
import type { SubmissionPhase } from './useSubmission';

interface SubmissionCopyProps {
  processing: SubmissionCopy;
  success: SubmissionCopy & { actionLabel?: string };
  /** Message defaults to the request's error. */
  failure: SubmissionCopy & { retryLabel?: string; closeLabel?: string };
  /** Small pills under the result (e.g. a date and time). */
  details?: React.ReactNode;
  /** After a success that now waits on someone else, keep a bead circling the badge. */
  waitingAfterSuccess?: boolean;
}

/** The parts of useSubmission() these components read. */
export interface SubmissionState {
  phase: SubmissionPhase;
  error: string | null;
  reset: () => void;
}

export interface SubmitModalProps extends Omit<NeuModalProps, 'dismissible' | 'labelledBy'>, SubmissionCopyProps {
  submission: SubmissionState;
  /** "Try again" after an error. Defaults to back to the sheet (submission.reset). */
  onRetry?: () => void;
  /** Show the last error at the top of the sheet after "Try again" (default true). */
  errorInSheet?: boolean;
}

export function SubmitModal({
  submission,
  onRetry,
  errorInSheet = true,
  processing,
  success,
  failure,
  details,
  waitingAfterSuccess,
  size = 'md',
  onClose,
  children,
  ...sheet
}: SubmitModalProps) {
  const titleId = useId();
  const { phase, error } = submission;
  return (
    <SubmissionModal
      phase={phase}
      titleId={titleId}
      size={size}
      onClose={onClose}
      onRetry={onRetry ?? submission.reset}
      error={error}
      processing={processing}
      success={success}
      failure={failure}
      details={details}
      waitingAfterSuccess={waitingAfterSuccess}
    >
      <NeuModalSheet titleId={titleId} onClose={onClose} closeDisabled={phase === 'processing'} {...sheet}>
        {errorInSheet && error && phase === 'idle' && (
          <NeuAlert key="submission-error" tone="error" title={failure.title}>
            {error}
          </NeuAlert>
        )}
        {children}
      </NeuModalSheet>
    </SubmissionModal>
  );
}

export interface SubmissionOverlayProps extends SubmissionCopyProps {
  submission: SubmissionState;
  /** Called when the card is closed after a success (before it goes away). */
  onDone?: () => void;
}

export function SubmissionOverlay({ submission, onDone, ...copy }: SubmissionOverlayProps) {
  const titleId = useId();
  const { phase, error, reset } = submission;
  const close = () => {
    if (phase === 'success') onDone?.();
    reset();
  };
  return (
    <AnimatePresence>
      {phase !== 'idle' && (
        <SubmissionModal
          key="submission-overlay"
          phase={phase}
          titleId={titleId}
          size="sm"
          onClose={close}
          error={error}
          {...copy}
          failure={{ closeLabel: 'Back', ...copy.failure }}
        >
          {null}
        </SubmissionModal>
      )}
    </AnimatePresence>
  );
}
