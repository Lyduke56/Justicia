'use client';

import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { MottoSection } from './MottoSection';
import { FeaturesSection } from './FeaturesSection';
import { AboutSection } from './AboutSection';
import { Footer } from './Footer';
import { SignInModal } from '@/components/auth/SignInModal';

export function LandingPageClient() {
  const [signInOpen, setSignInOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#0d0705] text-[#ded7cb] selection:bg-[#c5944e]/30 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar onOpenSignIn={() => setSignInOpen(true)} />

      {/* Hero Section */}
      <HeroSection />

      {/* Motto Section */}
      <MottoSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* About Section */}
      <AboutSection />

      {/* Footer */}
      <Footer />

      {/* Sign In Modal */}
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
