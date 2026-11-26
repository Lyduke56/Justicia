'use client';

import React, { useState } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthDialog, AuthPanelHeader, AuthPanelView } from '@/components/auth/AuthPanel';
import { RoleSelectPanel } from '@/components/auth/RoleSelect';
import { JusticiaLogo } from '@/components/brand/JusticiaLogo';

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
 * The Justicia mark sits in the raised tile above the title. The backdrop and panel animate in
 * and out together; "Forgot password?" and "Create an account" swap the panel's content in place
 * (to the reset-link form, or to the account-type choice that leads to /register?role=…) and the
 * panel resizes smoothly, instead of leaving the page.
 */
export function SignInModal({ isOpen, onClose, onSwitchToSignUp, onSwitchToForgotPassword }: SignInModalProps) {
  const [view, setView] = useState<'signin' | 'forgot' | 'role'>('signin');

  return (
    <AuthDialog open={isOpen} onClose={onClose} labelledBy={TITLE_ID} onExitComplete={() => setView('signin')}>
      <AuthPanelView viewKey={view} direction={view === 'signin' ? -1 : 1}>
        {view === 'signin' ? (
          <>
            <AuthPanelHeader
              titleId={TITLE_ID}
              icon={<JusticiaLogo markOnly className="h-8 w-auto" aria-hidden="true" />}
              title="Welcome back"
              subtitle="Sign in to continue to your Justicia dashboard."
            />
            <div className="mt-8">
              <SignInForm
                onClose={onClose}
                onSwitchToSignUp={onSwitchToSignUp ?? (() => setView('role'))}
                onSwitchToForgotPassword={onSwitchToForgotPassword ?? (() => setView('forgot'))}
                showSignUpLink
              />
            </div>
          </>
        ) : view === 'role' ? (
          <RoleSelectPanel titleId={TITLE_ID} onSignIn={() => setView('signin')} />
        ) : (
          <ForgotPasswordForm titleId={TITLE_ID} onClose={onClose} onSwitchToSignIn={() => setView('signin')} />
        )}
      </AuthPanelView>
    </AuthDialog>
  );
}
