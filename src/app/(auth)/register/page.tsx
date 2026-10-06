'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

        {/* Gradient Scrim for contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

        {/* Text Overlay at bottom */}
        <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-left">
          <h1 className="font-cormorant text-4xl sm:text-5xl lg:text-[54px] font-medium text-[#FAF6F0] leading-[1.1] tracking-tight">
            Sign Up With <span className="text-[#D29D54]">Justicia</span>
          </h1>
          <p className="text-[#ded7cb]/80 text-xs sm:text-sm mt-3 sm:mt-4 max-w-lg leading-relaxed font-light">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </div>
      </div>

      {/* Right Column: Neumorphic Form Panel */}
      <div className="w-full lg:w-1/2 min-h-screen flex items-center justify-center bg-[#EACEAA] p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-[560px] mx-auto py-6">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4 sm:space-y-5" noValidate>
            {/* Full Name */}
            <div>
              <label
                htmlFor="reg_fullname"
                className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
              >
                Full Name:
              </label>
              <input
                id="reg_fullname"
                type="text"
                placeholder="e.g. Juan C. De la Cruz"
                className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                }}
              />
            </div>

            {/* Address */}
            <div>
              <label
                htmlFor="reg_address"
                className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
              >
                Address:
              </label>
              <input
                id="reg_address"
                type="text"
                placeholder="Enter your complete address here"
                className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                }}
              />
            </div>

            {/* Row: Email & Contact Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="reg_email"
                  className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
                >
                  Email:
                </label>
                <input
                  id="reg_email"
                  type="email"
                  placeholder="sample@gmail.com"
                  className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                  }}
                />
              </div>

              {/* Contact Number */}
              <div>
                <label
                  htmlFor="reg_contact"
                  className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
                >
                  Contact Number:
                </label>
                <input
                  id="reg_contact"
                  type="tel"
                  placeholder="09XX-XXX-XXXX"
                  className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                  style={{
                    boxShadow:
                      'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                  }}
                />
              </div>
            </div>

            {/* Row: Birthdate & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Birthdate */}
              <div>
                <label
                  htmlFor="reg_birthdate"
                  className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
                >
                  Birthdate:
                </label>
                <div className="relative">
                  <input
                    id="reg_birthdate"
                    type="text"
                    placeholder="YYYY-MM-DD"
                    className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 pr-10 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                    style={{
                      boxShadow:
                        'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                    }}
                  />
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Gender */}
              <div>
                <label
                  htmlFor="reg_gender"
                  className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
                >
                  Gender:
                </label>
                <div className="relative">
                  <select
                    id="reg_gender"
                    defaultValue=""
                    className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 pr-10 text-sm text-[#34150F] focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 appearance-none cursor-pointer border-none"
                    style={{
                      boxShadow:
                        'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                    }}
                  >
                    <option value="" disabled className="text-[#9e836f]/60">
                      Select gender
                    </option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D]">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Citizenship */}
            <div>
              <label
                htmlFor="reg_citizenship"
                className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
              >
                Citizenship:
              </label>
              <input
                id="reg_citizenship"
                type="text"
                placeholder="e.g. Filipino"
                className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                style={{
                  boxShadow:
                    'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                }}
              />
            </div>

            {/* Row: Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div>
                <label
                  htmlFor="reg_password"
                  className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
                >
                  Password:
                </label>
                <div className="relative">
                  <input
                    id="reg_password"
                    type={showPassword ? 'text' : 'password'}
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
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="reg_confirm_password"
                  className="block text-xs font-medium text-[#6B5344] mb-1.5 pl-0.5 select-none"
                >
                  Confirm Password:
                </label>
                <div className="relative">
                  <input
                    id="reg_confirm_password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full bg-[#EACEAA] rounded-[14px] px-4 py-2.5 sm:py-3 pr-11 text-sm text-[#34150F] placeholder:text-[#9e836f]/60 focus:outline-none focus:ring-1 focus:ring-[#D29D54]/70 transition-all border-none"
                    style={{
                      boxShadow:
                        'inset 3px 3px 6px rgba(125, 90, 55, 0.28), inset -3px -3px 6px rgba(255, 255, 255, 0.88)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A604D] hover:text-[#34150F] transition-colors p-1"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
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
              </div>
            </div>

            {/* Centered Dark CREATE ACCOUNT Button */}
            <div className="flex justify-center pt-3">
              <button
                type="submit"
                id="create-account-btn"
                className="w-[230px] sm:w-[240px] bg-[#34150F] hover:bg-[#250e0a] text-[#FAF6F0] text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase py-3.5 px-6 rounded-[14px] shadow-[0_6px_16px_rgba(52,21,15,0.35)] hover:shadow-[0_8px_20px_rgba(52,21,15,0.45)] transition-all duration-200 active:translate-y-0.5 cursor-pointer"
              >
                CREATE ACCOUNT
              </button>
            </div>

            {/* Subtle Sign in link */}
            <p className="text-center text-[11px] text-[#7A604D] pt-1">
              Already have an account?{' '}
              <Link href="/login" className="text-[#99431E] hover:text-[#34150F] font-semibold underline underline-offset-2 transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
