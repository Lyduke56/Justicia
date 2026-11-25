'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * idle       → the form / confirmation is on screen.
 * processing → the request is running (duplicate submits are ignored).
 * success    → the request answered and succeeded.
 * error      → the request answered with an error (or could not be sent).
 */
export type SubmissionPhase = 'idle' | 'processing' | 'success' | 'error';

/** What a submission task reports. Only this decides between the check and the X. */
export type SubmissionResult = { ok: true } | { ok: false; error: string };

export interface RunOptions {
  /** Keep the loader on screen at least this long so it can be read (ms, default 900). */
  minDuration?: number;
}

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

/** Turns a server action's usual `{ success, error }` answer into a SubmissionResult. */
export function toSubmissionResult(res: unknown, fallback = FALLBACK_ERROR): SubmissionResult {
  if (res && typeof res === 'object') {
    const r = res as { success?: unknown; error?: unknown };
    if (r.success === true || (r.success === undefined && !r.error)) return { ok: true };
    return { ok: false, error: typeof r.error === 'string' && r.error ? r.error : fallback };
  }
  return { ok: false, error: fallback };
}

/**
 * Drives a submit → processing → success / error flow for SubmissionModal (or any other UI).
 * The phase only becomes success or error once `task` has answered, and only from its answer:
 * a check is never shown for a failed request, and nothing but the task can produce the X.
 */
export function useSubmission() {
  const [phase, setPhase] = useState<SubmissionPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async (task: () => Promise<SubmissionResult>, { minDuration = 900 }: RunOptions = {}) => {
    if (running.current) return null;
    running.current = true;
    setError(null);
    setPhase('processing');
    const startedAt = Date.now();
    let result: SubmissionResult;
    try {
      result = await task();
    } catch (err) {
      result = { ok: false, error: err instanceof Error && err.message ? err.message : FALLBACK_ERROR };
    }
    const remaining = minDuration - (Date.now() - startedAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    running.current = false;
    setPhase(result.ok ? 'success' : 'error');
    setError(result.ok ? null : result.error);
    return result;
  }, []);

  /** Back to the form (e.g. "Try again" after an error). Ignored while a request is running. */
  const reset = useCallback(() => {
    if (running.current) return;
    setPhase('idle');
  }, []);

  return { phase, error, run, reset, processing: phase === 'processing' };
}
