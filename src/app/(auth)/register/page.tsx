import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/SignUpForm';

export const metadata: Metadata = { title: 'Create Account' };

/**
 * Register Page — mounts the real SignUpForm (Server Action) inside
 * the existing neumorphic split-screen layout.
 */
export default function RegisterPage() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Column: Image with Text Overlay */}
      <div className="relative w-full lg:w-1/2 min-h-[360px] lg:min-h-screen flex flex-col justify-end overflow-hidden">
        <Image
          src="/actual_images/gavel.png"
          alt="Judge with gavel and law book"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center filter brightness-90"
        />
        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

        {/* Text Overlay at bottom */}
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-left">
          <h1 className="font-cormorant text-4xl sm:text-5xl lg:text-[54px] font-medium text-[#FAF6F0] leading-[1.1] tracking-tight">
            Join <span className="text-[#D29D54]">Justicia</span>
          </h1>
          <p className="text-[#ded7cb]/80 text-xs sm:text-sm mt-3 sm:mt-4 max-w-lg leading-relaxed font-light">
            Access Philippine legal guidance powered by AI, and connect with verified licensed attorneys whenever you need professional counsel.
          </p>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="w-full lg:w-1/2 min-h-screen flex items-center justify-center bg-[#EACEAA] p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-[480px] mx-auto py-8">
          <h2 className="font-cormorant text-4xl sm:text-[44px] font-medium text-[#34150F] text-center leading-none mb-8 select-none">
            Create Account
          </h2>

          <SignUpForm variant="neumorphic" />

          {/* Sign In Link */}
          <p className="text-center text-[11px] text-[#7A604D] pt-4">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
