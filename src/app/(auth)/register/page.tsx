import type { Metadata } from 'next';
import { RegisterView } from '@/components/auth/RegisterView';

export const metadata: Metadata = { title: 'Create Account' };

/**
 * Register Page — mounts the real SignUpForm and split-screen layout
 * with synchronized smooth-landing entrance animations.
 */
export default function RegisterPage() {
  return <RegisterView />;
}
