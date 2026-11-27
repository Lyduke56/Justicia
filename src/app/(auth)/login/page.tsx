import type { Metadata } from 'next';
import { LoginView } from '@/components/auth/LoginView';

export const metadata: Metadata = { title: 'Sign In' };

/**
 * Login Page — the real SignInForm (Server Action via useActionState) in the same split-screen
 * layout as the registration page. `?redirectTo=` (set by the proxy when a signed-out visitor
 * opens a portal link, e.g. from an email) is passed on so sign-in returns to that page; the
 * server action checks it before using it.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams).redirectTo;
  const redirectTo = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined;
  return <LoginView redirectTo={redirectTo} />;
}
