import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Log in' };

/**
 * Login Page
 *
 * Allows existing users to authenticate with email + password.
 * After login, middleware redirects to the role-appropriate dashboard.
 *
 * TODO: Implement Supabase Auth email/password sign-in
 * TODO: Add Google / social OAuth buttons
 * TODO: Add MFA step-up flow (TOTP)
 * TODO: Show inline validation errors
 * TODO: Link to forgot-password and register pages
 */
export default function LoginPage() {
  return (
    <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">Log in to your Justicia account</p>
      </div>

      {/* TODO: Replace with real form + Supabase auth action */}
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground text-center">
          🚧 <strong>Scaffold placeholder</strong> — <code>src/app/(auth)/login/page.tsx</code>
          <br />
          TODO: Email/password form, OAuth, MFA step-up
        </div>
      </div>
    </div>
  );
}
