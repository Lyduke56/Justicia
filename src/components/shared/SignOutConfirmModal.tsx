'use client';

/**
 * Confirms signing out (client, lawyer and admin portals) in the shared neumorphic modal, then
 * opens the landing page. `everywhere` ends every session of the account ("Sign out everywhere"
 * in Settings); otherwise only this browser is signed out.
 */
import React, { useState, useTransition } from 'react';
import { AnimatePresence } from 'motion/react';
import { signOutThisDeviceAction } from '@/app/actions/signOutActions';
import { signOutEverywhereAction } from '@/app/actions/accountPrivacyActions';
import { leaveToLanding } from '@/lib/auth/leaving';
import { NeuAlert, NeuButton, NeuModal } from '@/components/shared/neu';

function SignOutGlyph({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function SignOutConfirmModal({
  open,
  onClose,
  everywhere = false,
}: {
  open: boolean;
  onClose: () => void;
  everywhere?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState('');

  const close = () => {
    if (pending) return;
    setError('');
    onClose();
  };

  const confirm = () =>
    start(async () => {
      setError('');
      const res = everywhere ? await signOutEverywhereAction() : await signOutThisDeviceAction();
      if (!res.success) {
        setError(res.error);
        return;
      }
      leaveToLanding();
    });

  return (
    <AnimatePresence>
      {open && (
        <NeuModal
          key={everywhere ? 'sign-out-everywhere' : 'sign-out'}
          onClose={close}
          dismissible={!pending}
          size="sm"
          icon={<SignOutGlyph className="w-5 h-5" />}
          iconTone="danger"
          title={everywhere ? 'Sign out on every device?' : 'Sign out of Justicia?'}
          footer={
            <>
              <NeuButton variant="secondary" onClick={close} disabled={pending}>
                Stay Signed In
              </NeuButton>
              <NeuButton variant="danger" onClick={confirm} loading={pending}>
                {pending ? 'Signing out…' : everywhere ? 'Sign Out Everywhere' : 'Sign Out'}
              </NeuButton>
            </>
          }
        >
          <p className="font-inter text-xs sm:text-[13px] leading-relaxed text-[#5C4535]">
            {everywhere
              ? 'This ends your session on every device and browser, including this one. You will return to the Justicia home page.'
              : 'You will return to the Justicia home page and need to sign in again to open your account.'}
          </p>
          {error && <NeuAlert tone="error">{error}</NeuAlert>}
        </NeuModal>
      )}
    </AnimatePresence>
  );
}

export default SignOutConfirmModal;
