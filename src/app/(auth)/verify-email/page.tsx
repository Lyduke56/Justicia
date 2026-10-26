import type { Metadata } from 'next';
import Link from 'next/link';
import { ScalesLogo } from '@/components/landing/LawIcons';

export const metadata: Metadata = { title: 'Verify Email' };

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 py-12 bg-[#0c0805]">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center justify-center gap-2 mb-6 group">
          <ScalesLogo className="w-7 h-7 text-[#c59341] group-hover:text-[#d6a54f] transition-colors" />
          <span className="font-cinzel font-bold tracking-[0.3em] text-[#e6ded2] text-lg group-hover:text-white transition-colors">
            JUSTICIA
          </span>
        </Link>
        <div className="rounded-2xl border border-[#3c2a1c] bg-[#140d07] p-8 shadow-2xl space-y-4 text-center">
          <h2 className="font-cinzel text-xl font-bold text-[#ded7cb]">Check your inbox</h2>
          <p className="text-sm text-[#8c7a6a]">
            We sent a verification link to your email address. Click the link to activate your account.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block text-xs font-semibold tracking-wider uppercase text-[#c59341] hover:text-[#d6a54f] transition-colors"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
