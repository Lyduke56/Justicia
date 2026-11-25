'use client';

import React, { useState } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthPanelHeaderIcon } from '@/components/auth/AuthFields';
import { AuthDialog, AuthPanelHeader, AuthPanelView } from '@/components/auth/AuthPanel';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignUp?: () => void;
  /** Override the built-in forgot-password view (by default it opens inside this dialog). */
  onSwitchToForgotPassword?: () => void;
}

const TITLE_ID = 'signin-dialog-title';

/**
 * SignInModal — the landing page sign-in dialog, in the same style as the portal's dialogs.
 * The backdrop and panel animate in and out together; "Forgot password?" swaps the panel's
 * content to the reset-link form in place (the panel resizes smoothly) instead of leaving the page.
 */
export function SignInModal({ isOpen, onClose, onSwitchToSignUp, onSwitchToForgotPassword }: SignInModalProps) {
  const [view, setView] = useState<'signin' | 'forgot'>('signin');

  return (
    <AuthDialog open={isOpen} onClose={onClose} labelledBy={TITLE_ID} onExitComplete={() => setView('signin')}>
      <AuthPanelView viewKey={view} direction={view === 'forgot' ? 1 : -1}>
        {view === 'signin' ? (
          <>
            <AuthPanelHeader
              titleId={TITLE_ID}
              icon={<AuthPanelHeaderIcon kind="signin" />}
              title="Welcome back"
              subtitle="Sign in to continue to your Justicia dashboard."
            />
            <div className="mt-7">
              <SignInForm
                onClose={onClose}
                onSwitchToSignUp={onSwitchToSignUp}
                onSwitchToForgotPassword={onSwitchToForgotPassword ?? (() => setView('forgot'))}
                showSignUpLink
              />
            </div>
          </>
        ) : (
          <ForgotPasswordForm titleId={TITLE_ID} onClose={onClose} onSwitchToSignIn={() => setView('signin')} />
        )}
      </AuthPanelView>
    </AuthDialog>
  );
}
