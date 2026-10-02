'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { MottoSection } from './MottoSection';
import { FeaturesSection } from './FeaturesSection';
import { AboutSection } from './AboutSection';
import { Footer } from './Footer';
import { BookshelfSvg } from './BookshelfSvg';
import { AuthModal, type AuthMode } from '@/components/auth/AuthModal';

export function LandingPageClient() {
  const [isSvgMode, setIsSvgMode] = useState(false);
  const [authModal, setAuthModal] = useState<{
    isOpen: boolean;
    mode: AuthMode;
  }>({
    isOpen: false,
    mode: 'signin',
  });

  return (
    <div className="relative min-h-screen bg-[#0c0805] text-[#ded7cb] selection:bg-[#c59341]/30 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar
        isSvgMode={isSvgMode}
        onToggleAssetMode={() => setIsSvgMode(prev => !prev)}
        onOpenSignIn={() => setAuthModal({ isOpen: true, mode: 'signin' })}
        onOpenSignUp={() => setAuthModal({ isOpen: true, mode: 'signup' })}
      />

      {/* UPPER SECTION: Bookshelf Library Background (Hero + Motto) */}
      <div className="relative w-full overflow-hidden">
        {/* Bookshelf Background Layer */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          {isSvgMode ? (
            <div className="w-full h-full opacity-40">
              <BookshelfSvg className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-full relative opacity-45">
              <Image
                src="/images/bookshelf-bg.jpg"
                alt="Antique dark law library bookshelf background"
                fill
                priority
                className="object-cover object-center filter contrast-125 brightness-75"
                sizes="100vw"
              />
            </div>
          )}

          {/* Deep Cinematic Shadows & Vignettes matching mockup */}
          {/* Top nav shadow */}
          <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#0c0805]/95 via-[#0c0805]/60 to-transparent" />
          {/* Side vignettes */}
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-[#0c0805]/40 to-[#0c0805]/90" />
          {/* Bottom transition into About/Courthouse section */}
          <div className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-[#090503] via-[#090503]/85 to-transparent" />
        </div>

        {/* Hero Section */}
        <HeroSection isSvgMode={isSvgMode} />

        {/* Mid Section: Motto (NEMO EST SUPRA LEGES) */}
        <MottoSection />
      </div>

      {/* Features Section (Smooth scroll anchor for FEATURES link) */}
      <FeaturesSection />

      {/* LOWER SECTION: About Justicia with Neoclassical Courthouse Facade */}
      <AboutSection isSvgMode={isSvgMode} />

      {/* Footer */}
      <Footer />

      {/* Auth Modal (Sign In / Sign Up / Forgot Password) */}
      <AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
