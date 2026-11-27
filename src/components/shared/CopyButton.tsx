'use client';

import { useEffect, useRef, useState } from 'react';

/** Copies displayed text only; clipboard failures never masquerade as success. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const request = useRef(0);

  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    const id = ++request.current;
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(value);
      if (request.current === id) setStatus('copied');
    } catch {
      if (request.current === id) setStatus('error');
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2 normal-case tracking-normal">
      <button
        type="button"
        onClick={() => void copy()}
        disabled={!value.trim() || status === 'copying'}
        aria-label={`Copy ${label}`}
        title={status === 'copied' ? 'Copied' : status === 'copying' ? 'Copying…' : `Copy ${label}`}
        aria-busy={status === 'copying' || undefined}
        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors enabled:hover:bg-[#C58B3C]/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525] disabled:opacity-50 ${
          status === 'copied'
            ? 'text-[#1F7A3A] enabled:hover:text-[#174D2A]'
            : status === 'error'
              ? 'text-[#B42318] enabled:hover:text-[#7A1A12]'
              : 'text-[#7D6855] enabled:hover:text-[#946525]'
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {status === 'copied' ? <path d="m5 12 4 4L19 6" /> : <>
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
          </>}
        </svg>
      </button>
      <span role="status" aria-live="polite" aria-atomic="true" className={status === 'error' ? 'text-xs font-normal text-[#B42318]' : 'sr-only'}>
        {status === 'copied' ? `${label} copied.` : status === 'error' ? 'Could not copy. Select the text and copy it manually, or try again.' : ''}
      </span>
    </span>
  );
}
