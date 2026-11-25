import type { Metadata } from 'next';
import { AuthPageCard } from '@/components/auth/AuthPanel';
import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel';

export const metadata: Metadata = { title: 'Verify Email' };

/** Shown after sign-up: how to finish verifying the account. */
export default function VerifyEmailPage() {
  return (
    <AuthPageCard>
      <VerifyEmailPanel />
    </AuthPageCard>
  );
}
