'use client';

import React, { useCallback, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Navbar } from './Navbar';
import { HeroSection, HERO_NAV_DELAY } from './HeroSection';
import { MottoSection } from './MottoSection';
import { AboutSection } from './AboutSection';
import { FeaturesSection } from './FeaturesSection';
import { Footer } from './Footer';
import { SignInModal } from '@/components/auth/SignInModal';
import { RoleSelectModal } from '@/components/auth/RoleSelect';
import { SpotlightProvider, GlobalCursorSpotlight } from './LibrarySpotlight';

/**
 * Fine film grain over the whole page. It softens the flat dark areas and the gradients
 * so they read as print rather than screen. 0 turns it off.
 */
const GRAIN_OPACITY = 0.05;

const GRAIN_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export function LandingPageClient() {
  const [signInOpen, setSignInOpen] = useState(false);
  const [signUpOpen, setSignUpOpen] = useState(false);
  // Flips when the hero starts its entrance, so the navbar arrives as part of it
  const [introStarted, setIntroStarted] = useState(false);
  const startIntro = useCallback(() => setIntroStarted(true), []);

  return (
    // reducedMotion="user": visitors who ask for less motion get instant transforms
    // (fades still play), without every component having to check for it.
    <MotionConfig reducedMotion="user">
      <SpotlightProvider>
        <div className="relative min-h-screen bg-[#0d0705] text-[#ded7cb] selection:bg-[#c5944e]/30 selection:text-white">
          {/* Global Ambient Cursor Light Beam */}
          <GlobalCursorSpotlight enabled={introStarted} />

          {/* Film grain */}
          {GRAIN_OPACITY > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 z-40"
              style={{ backgroundImage: GRAIN_TEXTURE, opacity: GRAIN_OPACITY }}
            />
          )}

          {/* Top Navigation Bar */}
          <Navbar
            onOpenSignIn={() => setSignInOpen(true)}
            onOpenSignUp={() => setSignUpOpen(true)}
            introReady={introStarted}
            introDelay={HERO_NAV_DELAY}
          />

          {/* Hero Section */}
          <HeroSection onIntroStart={startIntro} />

          {/* Motto Section */}
          <MottoSection />

          {/* Pause between Motto and About. Motto dims into #0d0705 on exit and About lifts
              out of #0d0705 on entry, so this gap is solid #0d0705 on purpose. Adjust the
              height classes to lengthen or shorten the pause. */}
          <div aria-hidden="true" className="pointer-events-none h-[60vh] w-full bg-[#0d0705] sm:h-[70vh] lg:h-[80vh]" />

          {/* About Section */}
          <AboutSection />

          {/* Pause between About and Features: About dims into #0d0705 on exit. */}
          <div aria-hidden="true" className="pointer-events-none h-[40vh] w-full bg-[#0d0705] sm:h-[50vh] lg:h-[60vh]" />

          {/* Features Section */}
          <FeaturesSection />

          {/* Footer */}
          <Footer />

          {/* Sign In Modal */}
          <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />

          {/* Sign Up: choose an account type first, then on to /register?role=… */}
          <RoleSelectModal
            open={signUpOpen}
            onClose={() => setSignUpOpen(false)}
            onSignIn={() => {
              setSignUpOpen(false);
              setSignInOpen(true);
            }}
          />
        </div>
      </SpotlightProvider>
    </MotionConfig>
  );
}
