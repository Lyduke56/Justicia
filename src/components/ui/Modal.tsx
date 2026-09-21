import React from 'react';

/**
 * Modal — Shared UI component
 * Accessible dialog overlay using the native <dialog> element.
 * TODO: Add animation (fade in/out)
 * TODO: Add focus trap
 * TODO: Add Escape key close handler
 */

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  'aria-describedby'?: string;
}

export function Modal({ isOpen, onClose, title, children, 'aria-describedby': describedBy }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={describedBy}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-muted transition"
            aria-label="Close modal"
            type="button"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
