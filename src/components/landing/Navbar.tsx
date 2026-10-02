'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ScalesLogo } from './LawIcons';

interface NavbarProps {
  onToggleAssetMode?: () => void;
  isSvgMode?: boolean;
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

export function Navbar({ onToggleAssetMode, isSvgMode, onOpenSignIn, onOpenSignUp }: NavbarProps) {
  const [activeSection, setActiveSection] = useState<'home' | 'features' | 'about'>('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoMode, setLogoMode] = useState<'mockup' | 'brand'>('mockup');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setIsScrolled(scrollPos > 30);

      const aboutEl = document.getElementById('about');
      const featuresEl = document.getElementById('features');

      if (aboutEl && scrollPos >= aboutEl.offsetTop - 200) {
        setActiveSection('about');
      } else if (featuresEl && scrollPos >= featuresEl.offsetTop - 200) {
        setActiveSection('features');
      } else {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#0e0906]/90 backdrop-blur-md border-b border-[#322316]/60 shadow-2xl py-3'
          : 'bg-transparent py-5 lg:py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLogoMode(prev => (prev === 'mockup' ? 'brand' : 'mockup'))}
            title="Click to toggle between [LOGO HERE] and [JUSTICIA] brand"
            className="group font-cinzel text-base sm:text-lg tracking-widest text-[#ded6cb] hover:text-[#c59341] transition-colors flex items-center gap-2 text-left"
          >
            {logoMode === 'mockup' ? (
              <span className="font-semibold text-sm sm:text-base tracking-[0.2em] text-[#d4cbbf]">
                [LOGO HERE]
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ScalesLogo className="w-5 h-5 text-[#c59341]" />
                <span className="font-bold tracking-[0.25em] text-[#e6ded2]">
                  [ <span className="text-[#c59341]">JUSTICIA</span> ]
                </span>
              </span>
            )}
          </button>
        </div>

        {/* Center / Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-12">
          {/* HOME */}
          <a
            href="#home"
            onClick={() => setActiveSection('home')}
            className="relative py-1 font-cinzel text-xs lg:text-sm font-semibold tracking-[0.2em] transition-colors uppercase text-[#ded7cb] hover:text-[#c59341]"
          >
            HOME
            {activeSection === 'home' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c59341] rounded-full shadow-[0_0_8px_rgba(197,147,65,0.6)]" />
            )}
          </a>

          {/* FEATURES */}
          <a
            href="#features"
            onClick={() => setActiveSection('features')}
            className="relative py-1 font-cinzel text-xs lg:text-sm font-semibold tracking-[0.2em] transition-colors uppercase text-[#b8ada0] hover:text-[#c59341]"
          >
            FEATURES
            {activeSection === 'features' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c59341] rounded-full shadow-[0_0_8px_rgba(197,147,65,0.6)]" />
            )}
          </a>

          {/* ABOUT JUSTICIA */}
          <a
            href="#about"
            onClick={() => setActiveSection('about')}
            className="relative py-1 font-cinzel text-xs lg:text-sm font-semibold tracking-[0.2em] transition-colors uppercase text-[#b8ada0] hover:text-[#c59341]"
          >
            ABOUT JUSTICIA
            {activeSection === 'about' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c59341] rounded-full shadow-[0_0_8px_rgba(197,147,65,0.6)]" />
            )}
          </a>
        </nav>

        {/* Right: Auth Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          {/* Asset toggle button (Photorealistic vs SVG) */}
          {onToggleAssetMode && (
            <button
              onClick={onToggleAssetMode}
              className="mr-1 text-[11px] font-sans tracking-wide text-[#a89a8c] hover:text-[#c59341] border border-[#3c2a1c] hover:border-[#c59341]/60 px-2.5 py-1.5 rounded transition-all bg-black/30"
              title="Toggle between photographic assets and vector SVG mode"
            >
              Mode: <span className="text-[#c59341] font-semibold">{isSvgMode ? 'SVG' : 'Photo'}</span>
            </button>
          )}

          {/* SIGN UP Button (Warm Tan/Gold Filled) */}
          {onOpenSignUp ? (
            <button
              type="button"
              onClick={onOpenSignUp}
              id="navbar-signup-btn"
              className="font-cinzel text-xs font-bold tracking-[0.15em] bg-[#c59341] hover:bg-[#d6a54f] text-[#140c06] px-5 py-2 rounded shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-center"
            >
              SIGN UP
            </button>
          ) : (
            <Link
              href="/register"
              className="font-cinzel text-xs font-bold tracking-[0.15em] bg-[#c59341] hover:bg-[#d6a54f] text-[#140c06] px-5 py-2 rounded shadow-md transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-center"
            >
              SIGN UP
            </Link>
          )}

          {/* LOG IN Button (Gold Outlined) — opens sign-in modal */}
          <button
            onClick={onOpenSignIn}
            id="navbar-login-btn"
            className="font-cinzel text-xs font-bold tracking-[0.15em] border border-[#c59341] text-[#c59341] hover:bg-[#c59341]/10 bg-black/25 backdrop-blur-sm px-5 py-2 rounded transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 text-center"
          >
            LOG IN
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={onOpenSignIn}
            id="navbar-mobile-login-btn"
            className="font-cinzel text-[11px] font-bold tracking-wider border border-[#c59341] text-[#c59341] px-3 py-1.5 rounded"
          >
            LOG IN
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-[#c59341] p-2 focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#110a06]/95 border-b border-[#3c2a1c] px-6 py-6 space-y-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col space-y-3 font-cinzel text-sm tracking-[0.15em]">
            <a
              href="#home"
              onClick={() => {
                setActiveSection('home');
                setMobileMenuOpen(false);
              }}
              className="text-[#ded7cb] hover:text-[#c59341] py-1 border-b border-[#291b10]"
            >
              HOME
            </a>
            <a
              href="#features"
              onClick={() => {
                setActiveSection('features');
                setMobileMenuOpen(false);
              }}
              className="text-[#ded7cb] hover:text-[#c59341] py-1 border-b border-[#291b10]"
            >
              FEATURES
            </a>
            <a
              href="#about"
              onClick={() => {
                setActiveSection('about');
                setMobileMenuOpen(false);
              }}
              className="text-[#ded7cb] hover:text-[#c59341] py-1 border-b border-[#291b10]"
            >
              ABOUT JUSTICIA
            </a>
          </div>

          <div className="pt-2 flex flex-col gap-3">
            {onToggleAssetMode && (
              <button
                onClick={onToggleAssetMode}
                className="w-full text-xs font-sans py-2 rounded border border-[#3c2a1c] text-[#a89a8c] bg-black/40"
              >
                Rendering Mode: <span className="text-[#c59341] font-semibold">{isSvgMode ? 'SVG Vector' : 'Photorealistic'}</span>
              </button>
            )}
            {onOpenSignUp ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSignUp();
                }}
                className="font-cinzel text-center text-xs font-bold tracking-[0.15em] bg-[#c59341] text-[#140c06] py-2.5 rounded shadow-md"
              >
                SIGN UP
              </button>
            ) : (
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="font-cinzel text-center text-xs font-bold tracking-[0.15em] bg-[#c59341] text-[#140c06] py-2.5 rounded shadow-md"
              >
                SIGN UP
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
