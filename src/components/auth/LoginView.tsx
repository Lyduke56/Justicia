'use client';

import React, { useState } from 'react';
import { SignInForm } from '@/components/auth/SignInForm';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { RoleSelectModal } from '@/components/auth/RoleSelect';

/**
 * LoginView — split-screen sign-in. "Create an account" opens the account-type modal in place;
 * picking Client or Lawyer goes on to /register?role=….
 */
export function LoginView({ redirectTo }: { redirectTo?: string } = {}) {
  const [roleOpen, setRoleOpen] = useState(false);
  const closeRole = () => setRoleOpen(false);

  return (
    <>
      <AuthSplitLayout
        headline="Sign In To"
        description="Welcome back. Access your Philippine legal assistance dashboard, verified attorney consultations, and AI-powered document review."
        title="Sign In"
      >
        <SignInForm showSignUpLink redirectTo={redirectTo} onSwitchToSignUp={() => setRoleOpen(true)} />
      </AuthSplitLayout>
      {/* Already on the sign-in screen, so its "Sign in" just closes the modal. */}
      <RoleSelectModal open={roleOpen} onClose={closeRole} onSignIn={closeRole} />
    </>
  );
}
