'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { RoleSelectModal } from '@/components/auth/RoleSelect';
import { authFormFooterClass, authLinkClass } from '@/components/auth/AuthFields';
import { SIGN_UP_ROLE_LABEL, signUpHref, type SignUpRole } from '@/components/auth/signUpRole';

/** For someone who picked the wrong account type: a one-click switch to the other sign-up. */
const OTHER_ROLE: Record<SignUpRole, { prompt: string; role: SignUpRole }> = {
  client: { prompt: 'Are you a lawyer?', role: 'lawyer' },
  lawyer: { prompt: 'Looking for legal help?', role: 'client' },
};

/**
 * RegisterView — split-screen sign-up for the role chosen in the account-type modal: the gavel
 * image with the headline on the left; on the right, "Sign Up as a Client / Lawyer" over the
 * form. Opened without a role, it shows the account-type modal first; closing that modal goes
 * back to where the visitor came from.
 */
export function RegisterView({ role }: { role: SignUpRole | null }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const leave = () => {
    setLeaving(true);
    if (window.history.length > 1) router.back();
    else router.replace('/');
  };

  const other = role ? OTHER_ROLE[role] : null;

  return (
    <>
      <AuthSplitLayout
        headline="Sign Up With"
        description="Access reliable Philippine legal guidance powered by AI, designed to help you better understand your rights, explore legal concerns, and navigate complex legal matters with greater confidence."
        title={
          role ? (
            <>
              Sign Up as a <span className="text-[#8A5A22]">{SIGN_UP_ROLE_LABEL[role]}</span>
            </>
          ) : (
            'Sign Up'
          )
        }
      >
        {role && other ? (
          <>
            <SignUpForm role={role} />
            <div className={`mt-7 space-y-1.5 ${authFormFooterClass}`}>
              <p>
                Already have an account?{' '}
                <Link href="/login" className={authLinkClass}>
                  Sign in
                </Link>
              </p>
              <p>
                {other.prompt}{' '}
                <Link href={signUpHref(other.role)} replace className={authLinkClass}>
                  Sign up as a {SIGN_UP_ROLE_LABEL[other.role]}
                </Link>
              </p>
            </div>
          </>
        ) : (
          // Behind the account-type modal (and shown if it's dismissed before the page leaves).
          <div className="text-center font-inter text-[13.5px] text-[#6E5545]">
            <p>Choose an account type to continue.</p>
            <button type="button" onClick={() => setLeaving(false)} className={`mt-3 ${authLinkClass}`}>
              Choose account type
            </button>
          </div>
        )}
      </AuthSplitLayout>
      <RoleSelectModal open={!role && !leaving} onClose={leave} replace />
    </>
  );
}
