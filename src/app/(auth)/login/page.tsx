import type { Metadata } from 'next';
import { LoginView } from '@/components/auth/LoginView';

export const metadata: Metadata = { title: 'Sign In' };

/**
 * Login Page — the real SignInForm (Server Action via useActionState) in the same split-screen
 * layout as the registration page.
 */
export default function LoginPage() {
  return <LoginView />;
}
