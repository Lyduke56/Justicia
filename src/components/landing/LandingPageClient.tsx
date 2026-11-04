'use client';

import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { MottoSection } from './MottoSection';
import { AboutSection } from './AboutSection';
import { FeaturesSection } from './FeaturesSection';
import { Footer } from './Footer';
import { SignInModal } from '@/components/auth/SignInModal';
import { SpotlightProvider, GlobalCursorSpotlight } from './LibrarySpotlight';

export function LandingPageClient() {
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <SpotlightProvider>
      <div className="relative min-h-screen bg-[#0d0705] text-[#ded7cb] selection:bg-[#c5944e]/30 selection:text-white">
        {/* Global Ambient Cursor Light Beam */}
        <GlobalCursorSpotlight />

        {/* Top Navigation Bar */}
        <Navbar onOpenSignIn={() => setSignInOpen(true)} />

        {/* Hero Section */}
        <HeroSection />

        {/* Motto Section */}
        <MottoSection />

        {/* Scroll runway between Motto and About: plain dark spacer (no books).
            Motto dims into #0d0705 on exit and About lifts out of #0d0705 on entry,
            so this gap is solid #0d0705 on purpose. Adjust the height classes to
            lengthen or shorten the pause. */}
        <div
          aria-hidden="true"
          className="h-[110vh] sm:h-[135vh] lg:h-[160vh] w-full bg-[#0d0705] pointer-events-none"
        />

        {/* About Section */}
        <AboutSection />

        {/* Scroll runway between About and Features: plain dark spacer.
            About dims into #0d0705 on exit, so this gap blends in seamlessly. */}
        <div
          aria-hidden="true"
          className="h-[60vh] sm:h-[80vh] lg:h-[100vh] w-full bg-[#0d0705] pointer-events-none"
        />

        {/* Features Section */}
        <FeaturesSection />

        {/* Footer */}
        <Footer />

        {/* Sign In Modal */}
        <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
      </div>
    </SpotlightProvider>
  );
}