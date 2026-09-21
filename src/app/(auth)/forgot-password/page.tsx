import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reset Password' };

/**
 * Forgot Password Page
 *
 * Allows users to request a password reset email.
 *
 * TODO: Implement supabase.auth.resetPasswordForEmail()
 * TODO: Show confirmation message after submission
 * TODO: Handle the password update form when the user clicks the reset link
 *       (Supabase sends a link that redirects back with a token)
 */
export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Reset your password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(auth)/forgot-password/page.tsx</code>
        <br />
        TODO: Email input, call resetPasswordForEmail(), success state
      </div>
    </div>
  );
}
