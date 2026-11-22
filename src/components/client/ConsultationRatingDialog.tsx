'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

export function ConsultationRatingDialog({ lawyerName, busy, onClose, children }: {
  lawyerName: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialogRef} aria-labelledby={titleId} aria-busy={busy}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="m-auto w-[calc(100%_-_2rem)] max-w-md max-h-[85dvh] overflow-y-auto rounded-[20px] border border-[#D8C6B0] bg-[#E5D8CB] p-6 text-[#34150F] shadow-2xl backdrop:bg-black/40">
    <h2 id={titleId} className="font-lora text-lg font-bold mb-2">How would you rate your consultation with {lawyerName}?</h2>
    <p className="font-inter text-xs text-[#7D6855] mb-5">Your review helps other clients choose a lawyer.</p>
    {children}
  </dialog>;
}
