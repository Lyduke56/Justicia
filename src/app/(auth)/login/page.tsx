'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Column: Image with Text Overlay */}
      <div className="relative w-full lg:w-1/2 min-h-[460px] lg:min-h-screen flex flex-col justify-end overflow-hidden">
        {/* Background Image: gavel.png */}
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
            Sign In To <span className="text-[#D29D54]">Justicia</span>
          </h1>
          <p className="text-[#ded7cb]/80 text-xs sm:text-sm mt-3 sm:mt-4 max-w-lg leading-relaxed font-light">
            Welcome back. Access your Philippine legal assistance dashboard, verified attorney consultations, and AI-powered document review.
          </p>
        </div>
      </div>

      {/* Right Column: Neumorphic Form Panel */}
      <div className="w-full lg:w-1/2 min-h-screen flex items-center justify-center bg-[#EACEAA] p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-[440px] mx-auto py-8">
          {/* Header Title */}
          <h2 className="font-cormorant text-4xl sm:text-[44px] font-medium text-[#34150F] text-center leading-none mb-8 select-none">
            Sign In
          </h2>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-5" noValidate>
            {/* Email Field */}
            <div>
              <label
                htmlFor="login_email"
                className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
              >
                Email:
              </label>
              <input
                id="login_email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sample@gmail.com"
                className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="login_password"
                className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
              >
                Password:
              </label>
              <div className="relative">
                <input
                  id="login_password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 pr-11 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D] hover:text-[#34150F] transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Forgot password */}
              <div className="text-right mt-1.5">
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-[#7A604D] hover:text-[#99431E] transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>

            {/* Divider */}
            <div className="relative pt-3 pb-1 text-center">
              <div className="absolute inset-x-0 top-1/2 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-[#cbb396]/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#EACEAA] px-3 text-[11px] text-[#7A604D] font-normal select-none">
                  Continue with:
                </span>
              </div>
            </div>

            {/* Raised Neumorphic Google Button */}
            <div className="flex justify-center pt-1 pb-2">
              <button
                type="button"
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-[13px] bg-[#EACEAA] text-[#34150F] text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  boxShadow:
                    '4px 4px 10px rgba(125, 90, 55, 0.25), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow =
                    '5px 5px 12px rgba(125, 90, 55, 0.3), -5px -5px 12px rgba(255, 255, 255, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow =
                    '4px 4px 10px rgba(125, 90, 55, 0.25), -4px -4px 10px rgba(255, 255, 255, 0.95)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.boxShadow =
                    'inset 2px 2px 5px rgba(125, 90, 55, 0.3), inset -2px -2px 5px rgba(255, 255, 255, 0.85)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.boxShadow =
                    '4px 4px 10px rgba(125, 90, 55, 0.25), -4px -4px 10px rgba(255, 255, 255, 0.95)';
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google</span>
              </button>
            </div>

            {/* Centered Dark SIGN IN Button */}
            <div className="flex justify-center pt-2">
              <button
                type="submit"
                id="login-submit-btn"
                className="w-[210px] sm:w-[220px] bg-[#34150F] hover:bg-[#250e0a] text-[#FAF6F0] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3 px-6 rounded-[14px] shadow-[0_6px_16px_rgba(52,21,15,0.35)] hover:shadow-[0_8px_20px_rgba(52,21,15,0.45)] transition-all duration-200 active:translate-y-0.5 cursor-pointer"
              >
                SIGN IN
              </button>
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-[11px] text-[#7A604D] pt-1">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors">
                Sign up
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
