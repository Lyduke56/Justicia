import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthPageCard } from '@/components/auth/AuthPanel';

export const metadata: Metadata = { title: 'Reset Password' };

/**
 * Forgot Password — the same panel as the landing page's dialog, standing on its own page
 * (linked from account settings and from the sign-in page).
 */
export default function ForgotPasswordPage() {
  return (
    <AuthPageCard>
      <ForgotPasswordForm />
    </AuthPageCard>
  );
}
