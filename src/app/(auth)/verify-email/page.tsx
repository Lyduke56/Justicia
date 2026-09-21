import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Verify Email' };

/**
 * Verify Email Page
 *
 * Shown after registration to prompt the user to check their inbox.
 * Supabase sends a verification link; this page handles the redirect
 * after the user clicks the link (token exchange).
 *
 * TODO: Handle PKCE token exchange from Supabase email link
 * TODO: Show loading state during token verification
 * TODO: Redirect to role dashboard on success
 * TODO: Allow resending the verification email
 */
export default function VerifyEmailPage() {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6 text-center">
      <h2 className="text-xl font-semibold">Check your inbox</h2>
      <p className="text-sm text-muted-foreground">
        We sent a verification link to your email address. Click the link to activate your account.
      </p>
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(auth)/verify-email/page.tsx</code>
        <br />
        TODO: PKCE token exchange, resend email button
      </div>
    </div>
  );
}
