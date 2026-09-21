import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Create Account' };

/**
 * Register Page
 *
 * Allows new users to create an account and choose their role (client or lawyer).
 * Lawyer accounts are created with verification_status = 'pending' and must
 * complete the verification flow before accessing lawyer features.
 *
 * TODO: Implement Supabase Auth sign-up
 * TODO: Insert row into user_accounts with selected role
 * TODO: Send verification email on sign-up
 * TODO: Redirect to /verify-email after registration
 * TODO: Add terms of service + privacy policy checkbox
 */
export default function RegisterPage() {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Create your account</h2>
        <p className="text-sm text-muted-foreground mt-1">Join Justicia — free for clients</p>
      </div>
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
        🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(auth)/register/page.tsx</code>
        <br />
        TODO: Name, email, password, role selector (client/lawyer), ToS checkbox
      </div>
    </div>
  );
}
