'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { MottoSection } from './MottoSection';
import { AboutSection } from './AboutSection';
import { FeaturesSection } from './FeaturesSection';
import { Footer } from './Footer';
import { SignInModal } from '@/components/auth/SignInModal';
import {
  SpotlightProvider,
  GlobalCursorSpotlight,
  BookshelfSpotlight,
} from './LibrarySpotlight';

export function LandingPageClient() {
  const [signInOpen, setSignInOpen] = useState(false);
  const runwayRef = useRef<HTMLDivElement>(null);

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

        {/* Atmospheric Scroll Runway between Motto and About */}
        <div
          ref={runwayRef}
          className="relative h-[140vh] sm:h-[170vh] lg:h-[200vh] w-full overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-0 z-0">
            <Image
              src="/actual_images/book_bg.png"
              alt="Antique law library bookshelf background"
              fill
              priority={false}
              className="object-cover object-top filter contrast-110"
              sizes="100vw"
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: 'rgba(20, 11, 12, 0.90)' }}
            />
            {/* Bookshelf Spotlight Reveal */}
            <BookshelfSpotlight
              containerRef={runwayRef}
              oversizedClassName="inset-0"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0d0705] via-transparent to-[#0d0705]" />
          </div>
        </div>

        {/* About Section */}
        <AboutSection />

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
