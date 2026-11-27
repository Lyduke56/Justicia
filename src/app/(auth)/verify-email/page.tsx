import type { Metadata } from 'next';
import { AuthPageCard } from '@/components/auth/AuthPanel';
import { VerifyEmailPanel, type VerifyLinkStatus } from '@/components/auth/VerifyEmailPanel';

export const metadata: Metadata = { title: 'Verify Email' };

const LINK_STATUSES: VerifyLinkStatus[] = ['expired', 'invalid', 'verified'];

/** Shown after sign-up: how to finish verifying the account. /auth/verify also lands here (?link=…). */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const link = (await searchParams).link;
  const status = LINK_STATUSES.find((s) => s === link);
  return (
    <AuthPageCard>
      <VerifyEmailPanel linkStatus={status} />
    </AuthPageCard>
  );
}
