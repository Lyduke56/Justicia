'use client';

import React from 'react';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/SignUpForm';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';
import { authLinkClass } from '@/components/auth/AuthFields';

/**
 * RegisterView — split-screen sign-up: the gavel image with the headline on the left, the
 * registration form on the right, with synchronized entrance animations.
 */
export function RegisterView() {
  return (
    <AuthSplitLayout
      headline="Sign Up With"
      description="Access reliable Philippine legal guidance powered by AI, designed to help you better understand your rights, explore legal concerns, and navigate complex legal matters with greater confidence."
      title="Create Account"
      subtitle="It only takes a minute. You can book a lawyer right after."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthSplitLayout>
  );
}
