import type { Metadata } from 'next';
import Image from 'next/image';
import { SignInForm } from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign In' };

/**
 * Login Page — mounts the real SignInForm (Server Action via useActionState)
 * inside the neumorphic split-screen layout matching RegisterView.
 */
export default function LoginPage() {
  return (
    <div className="h-screen max-h-screen w-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left Column: Image with Text Overlay */}
      <div className="relative w-full lg:w-1/2 h-44 sm:h-64 lg:h-full flex flex-col justify-end overflow-hidden flex-shrink-0">
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
        <div className="relative z-10 p-6 sm:p-8 lg:p-12 xl:p-16 text-left">
          <h1 className="font-lora text-2xl sm:text-3xl lg:text-4xl xl:text-[43px] font-normal text-[#E2CCB7] leading-[1.1] tracking-tight">
            Sign In To <span className="text-[#D29D54]">Justicia</span>
          </h1>
          <p className="text-[#E2CCB7]/80 text-xs sm:text-sm mt-2 sm:mt-3 lg:mt-4 max-w-lg leading-relaxed font-light">
            Welcome back. Access your Philippine legal assistance dashboard, verified attorney consultations, and AI-powered document review.
          </p>
        </div>
      </div>

      {/* Right Column: Form Panel */}
      <div className="w-full lg:w-1/2 h-full flex flex-col items-center justify-center bg-[#E5D8CB] px-6 py-6 sm:px-10 lg:px-12 xl:px-16 overflow-y-auto lg:overflow-hidden">
        <div className="w-full max-w-[480px] sm:max-w-[500px] lg:max-w-[520px] mx-auto my-auto flex flex-col justify-center">
          <h2 className="font-lora text-2xl sm:text-3xl lg:text-[35px] font-normal text-[#34150F] text-center leading-none mb-5 sm:mb-6 select-none">
            Sign In
          </h2>

          <SignInForm variant="neumorphic" showSignUpLink={true} />
        </div>
      </div>
    </div>
  );
}
