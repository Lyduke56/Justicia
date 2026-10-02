import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/SignInForm';
import { ScalesLogo } from '@/components/landing/LawIcons';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Log In' };

/**
 * Login Page
 *
 * Standalone sign-in page. The Navbar also opens sign-in as a modal,
 * but this page is used when navigating directly to /login.
 */
export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      {/* Logo header */}
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center justify-center gap-2 mb-4 group">
          <ScalesLogo className="w-7 h-7 text-[#c59341] group-hover:text-[#d6a54f] transition-colors" />
          <span className="font-cinzel font-bold tracking-[0.3em] text-[#e6ded2] text-lg group-hover:text-white transition-colors">
            JUSTICIA
          </span>
        </Link>

        <h1 className="font-cinzel text-2xl font-bold text-[#ded7cb] tracking-wide">
          Welcome Back
        </h1>
        <p className="text-[12px] text-[#7a6a5a] mt-1.5">
          Sign in to your Justicia account
        </p>

        {/* Decorative line */}
        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-[#3c2a1c]" />
          <span className="text-[#c59341] text-[10px]">✦</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-[#3c2a1c]" />
        </div>
      </div>

      {/* Form card */}
      <div
        className="relative rounded-2xl border border-[#3c2a1c] px-7 py-8 shadow-2xl shadow-black/40"
        style={{
          background: 'linear-gradient(145deg, #140d07 0%, #0c0805 60%, #110a06 100%)',
        }}
      >
        {/* Gold top border accent */}
        <div className="absolute left-1/4 right-1/4 -top-px h-px bg-gradient-to-r from-transparent via-[#c59341]/60 to-transparent rounded-full" />

        <SignInForm />
      </div>

      {/* Sign up link */}
      <p className="text-center text-[11px] text-[#7a6a5a] mt-5">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-[#c59341] hover:text-[#d6a54f] transition-colors font-medium">
          Create one free
        </Link>
      </p>
    </div>
  );
}
