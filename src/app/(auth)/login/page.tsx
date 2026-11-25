import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/SignInForm';
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout';

export const metadata: Metadata = { title: 'Sign In' };

/**
 * Login Page — the real SignInForm (Server Action via useActionState) in the same split-screen
 * layout as the registration page.
 */
export default function LoginPage() {
  return (
    <AuthSplitLayout
      headline="Sign In To"
      description="Welcome back. Access your Philippine legal assistance dashboard, verified attorney consultations, and AI-powered document review."
      title="Sign In"
      subtitle="Welcome back. Enter your details to continue."
    >
      <SignInForm showSignUpLink />
    </AuthSplitLayout>
  );
}
