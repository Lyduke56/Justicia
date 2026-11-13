'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';

/** Native dialog supplies focus containment, Escape, and return-to-trigger focus. */
export function AdminDialog({ open, onClose, labelledBy, variant = 'modal', children }: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  variant?: 'modal' | 'drawer' | 'navigation';
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      // Wait until React finishes removing the dialog before restoring focus.
      queueMicrotask(() => {
        if (open && !dialog.open && trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
      });
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={`admin-portal admin-dialog admin-dialog-${variant}`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
    >
      <div className="admin-dialog-panel">{children}</div>
    </dialog>
  );
}
