'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

export function Navbar({ onOpenSignIn }: NavbarProps) {
  const [activeSection, setActiveSection] = useState<'home' | 'features' | 'about'>('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setIsScrolled(scrollPos > 30);

      const aboutEl = document.getElementById('about');
      const featuresEl = document.getElementById('features');

      if (aboutEl && scrollPos >= aboutEl.offsetTop - 300) {
        setActiveSection('about');
      } else if (featuresEl && scrollPos >= featuresEl.offsetTop - 300) {
        setActiveSection('features');
      } else {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#160c0d]/90 backdrop-blur-md shadow-2xl py-3 border-b border-[#3c2a1c]/60'
          : 'bg-transparent py-5 lg:py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        {/* Left: Brand Name / Logo */}
        <div className="flex items-center">
          <Link
            href="/"
            className="group flex items-center gap-2 font-cinzel text-sm sm:text-base tracking-[0.2em] text-[#ded7cb] hover:text-[#c5944e] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#c5944e] group-hover:scale-125 transition-transform" />
            <span className="font-bold">JUSTICIA</span>
          </Link>
        </div>

        {/* Center / Navigation Links with Sliding Active Underline */}
        <nav className="hidden md:flex items-center gap-10 lg:gap-14">
          {/* HOME */}
          <a
            href="#home"
            onClick={() => setActiveSection('home')}
            className={`relative py-1 font-cinzel text-xs lg:text-sm font-semibold tracking-[0.2em] uppercase transition-colors ${
              activeSection === 'home' ? 'text-[#c5944e]' : 'text-[#b8ada0] hover:text-[#ded7cb]'
            }`}
          >
            HOME
            {activeSection === 'home' && (
              <motion.span
                layoutId="activeNavIndicator"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c5944e]"
              />
            )}
          </a>

          {/* FEATURES */}
          <a
            href="#features"
            onClick={() => setActiveSection('features')}
            className={`relative py-1 font-cinzel text-xs lg:text-sm font-semibold tracking-[0.2em] uppercase transition-colors ${
              activeSection === 'features' ? 'text-[#c5944e]' : 'text-[#b8ada0] hover:text-[#ded7cb]'
            }`}
          >
            FEATURES
            {activeSection === 'features' && (
              <motion.span
                layoutId="activeNavIndicator"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c5944e]"
              />
            )}
          </a>

          {/* ABOUT JUSTICIA */}
          <a
            href="#about"
            onClick={() => setActiveSection('about')}
            className={`relative py-1 font-cinzel text-xs lg:text-sm font-semibold tracking-[0.2em] uppercase transition-colors ${
              activeSection === 'about' ? 'text-[#c5944e]' : 'text-[#b8ada0] hover:text-[#ded7cb]'
            }`}
          >
            ABOUT JUSTICIA
            {activeSection === 'about' && (
              <motion.span
                layoutId="activeNavIndicator"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#c5944e]"
              />
            )}
          </a>
        </nav>

        {/* Right: Auth Action Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          {/* SIGN UP Button */}
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Link
              href="/register"
              className="font-cinzel text-xs font-bold tracking-[0.15em] bg-[#c5944e] hover:bg-[#d6a25b] text-[#160c0d] px-5 py-2 rounded transition-all duration-200 block shadow-sm"
            >
              SIGN UP
            </Link>
          </motion.div>

          {/* LOG IN Button */}
          {onOpenSignIn ? (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onOpenSignIn}
              id="navbar-login-btn"
              className="font-cinzel text-xs font-bold tracking-[0.15em] border border-[#c5944e] text-[#c5944e] hover:bg-[#c5944e]/10 bg-transparent px-5 py-2 rounded transition-all duration-200 cursor-pointer"
            >
              LOG IN
            </motion.button>
          ) : (
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/login"
                id="navbar-login-btn"
                className="font-cinzel text-xs font-bold tracking-[0.15em] border border-[#c5944e] text-[#c5944e] hover:bg-[#c5944e]/10 bg-transparent px-5 py-2 rounded transition-all duration-200 block"
              >
                LOG IN
              </Link>
            </motion.div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          {onOpenSignIn ? (
            <button
              onClick={onOpenSignIn}
              id="navbar-mobile-login-btn"
              className="font-cinzel text-[11px] font-bold tracking-wider border border-[#c5944e] text-[#c5944e] px-3 py-1.5 rounded cursor-pointer"
            >
              LOG IN
            </button>
          ) : (
            <Link
              href="/login"
              id="navbar-mobile-login-btn"
              className="font-cinzel text-[11px] font-bold tracking-wider border border-[#c5944e] text-[#c5944e] px-3 py-1.5 rounded"
            >
              LOG IN
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-[#c5944e] p-2 focus:outline-none"
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

      {/* Mobile Drawer with AnimatePresence */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-[#160c0d]/95 border-b border-[#3c2a1c] px-6 py-6 space-y-4 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex flex-col space-y-3 font-cinzel text-sm tracking-[0.15em]">
              <a
                href="#home"
                onClick={() => {
                  setActiveSection('home');
                  setMobileMenuOpen(false);
                }}
                className="text-[#ded7cb] hover:text-[#c5944e] py-1 border-b border-[#291b10]"
              >
                HOME
              </a>
              <a
                href="#features"
                onClick={() => {
                  setActiveSection('features');
                  setMobileMenuOpen(false);
                }}
                className="text-[#ded7cb] hover:text-[#c5944e] py-1 border-b border-[#291b10]"
              >
                FEATURES
              </a>
              <a
                href="#about"
                onClick={() => {
                  setActiveSection('about');
                  setMobileMenuOpen(false);
                }}
                className="text-[#ded7cb] hover:text-[#c5944e] py-1 border-b border-[#291b10]"
              >
                ABOUT JUSTICIA
              </a>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="font-cinzel text-center text-xs font-bold tracking-[0.15em] bg-[#c5944e] text-[#160c0d] py-2.5 rounded"
              >
                SIGN UP
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

