import type { Metadata } from 'next';
import { RegisterView } from '@/components/auth/RegisterView';
import { SIGN_UP_ROLE_LABEL, parseSignUpRole } from '@/components/auth/signUpRole';

type RegisterPageProps = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export async function generateMetadata({ searchParams }: RegisterPageProps): Promise<Metadata> {
  const role = parseSignUpRole((await searchParams).role);
  return { title: role ? `Sign Up as a ${SIGN_UP_ROLE_LABEL[role]}` : 'Create Account' };
}

/**
 * Register Page — the account type chosen in the role-selection modal arrives as ?role=client
 * or ?role=lawyer and becomes the sign-up form's role. Without a valid role the page asks for
 * one first.
 */
export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const role = parseSignUpRole((await searchParams).role);
  return <RegisterView role={role} />;
}
