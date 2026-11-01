'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

export function Navbar({ onOpenSignIn }: NavbarProps) {
  const [activeSection, setActiveSection] = useState<'home' | 'about' | 'features'>('home');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY;
      setIsScrolled(scrollPos > 30);

      const aboutEl = document.getElementById('about');
      const featuresEl = document.getElementById('features');

      // Order on page is: home -> about -> features
      if (featuresEl && scrollPos >= featuresEl.offsetTop - 300) {
        setActiveSection('features');
      } else if (aboutEl && scrollPos >= aboutEl.offsetTop - 300) {
        setActiveSection('about');
      } else {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'home', label: 'HOME', href: '#home' },
    { id: 'about', label: 'ABOUT JUSTICIA', href: '#about' },
    { id: 'features', label: 'FEATURES', href: '#features' },
  ] as const;

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-[background-color,border-color,padding,box-shadow,backdrop-filter] duration-300 ease-out ${
        isScrolled
          ? 'bg-[#140a0c]/90 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.6)] py-4 lg:py-4.5 border-[#3c2a1c]/60'
          : 'bg-transparent py-5 lg:py-6 border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between">
        {/* Left: Brand Name / Logo */}
        <div className="flex items-center">
          <Link
            href="/"
            className="group flex items-center gap-2.5 font-lora text-sm sm:text-base tracking-[0.2em] text-[#ded7cb] hover:text-[#f3ece0] transition-colors duration-250"
          >
            <span className="w-2 h-2 rounded-full bg-[#c5944e] group-hover:scale-125 group-hover:shadow-[0_0_8px_rgba(197,148,78,0.8)] transition-all duration-300" />
            <span className="font-bold tracking-[0.22em]">JUSTICIA</span>
          </Link>
        </div>

        {/* Center / Navigation Links: HOME -> ABOUT JUSTICIA -> FEATURES */}
        <nav className="hidden md:flex items-center gap-10 lg:gap-14">
          {navLinks.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={() => setActiveSection(item.id)}
                className={`relative py-2 font-lora text-[14.5px] lg:text-[15px] font-normal tracking-[0.2em] uppercase transition-colors duration-250 ${
                  isActive ? 'text-[#c5944e]' : 'text-[#b8ada0] hover:text-[#ded7cb]'
                }`}
              >
                {item.label}
                {isActive && (
                  <motion.span
                    layoutId="activeNavIndicator"
                    transition={{
                      type: 'spring',
                      stiffness: 350,
                      damping: 30,
                    }}
                    className="absolute -bottom-2.5 left-0 right-0 h-[2px] rounded-full bg-gradient-to-r from-[#c5944e]/90 via-[#f0c580] to-[#c5944e]/90 shadow-[0_1px_8px_rgba(197,148,78,0.55)]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Right: Auth Action Buttons with Enhanced Physics & Glow */}
        <div className="hidden sm:flex items-center gap-3">
          {/* SIGN UP Button */}
          <motion.div
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            <Link
              href="/register"
              className="font-lora text-[13.5px] font-medium tracking-[0.15em] bg-gradient-to-r from-[#c5944e] to-[#d6a25b] hover:from-[#d6a25b] hover:to-[#e4b574] text-[#160c0d] px-5 py-2 rounded transition-all duration-300 block shadow-sm hover:shadow-[0_4px_16px_rgba(197,148,78,0.35)]"
            >
              SIGN UP
            </Link>
          </motion.div>

          {/* LOG IN Button */}
          {onOpenSignIn ? (
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={onOpenSignIn}
              id="navbar-login-btn"
              className="font-lora text-[13.5px] font-medium tracking-[0.15em] border border-[#c5944e]/70 hover:border-[#c5944e] text-[#c5944e] hover:bg-[#c5944e]/10 bg-transparent px-5 py-2 rounded transition-all duration-300 cursor-pointer hover:shadow-[0_4px_16px_rgba(197,148,78,0.18)]"
            >
              LOG IN
            </motion.button>
          ) : (
            <motion.div
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Link
                href="/login"
                id="navbar-login-btn"
                className="font-lora text-[13.5px] font-medium tracking-[0.15em] border border-[#c5944e]/70 hover:border-[#c5944e] text-[#c5944e] hover:bg-[#c5944e]/10 bg-transparent px-5 py-2 rounded transition-all duration-300 block hover:shadow-[0_4px_16px_rgba(197,148,78,0.18)]"
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
              className="font-lora text-[11px] font-bold tracking-wider border border-[#c5944e] text-[#c5944e] px-3 py-1.5 rounded cursor-pointer"
            >
              LOG IN
            </button>
          ) : (
            <Link
              href="/login"
              id="navbar-mobile-login-btn"
              className="font-lora text-[11px] font-bold tracking-wider border border-[#c5944e] text-[#c5944e] px-3 py-1.5 rounded"
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
            className="md:hidden bg-[#140a0c]/95 border-b border-[#3c2a1c]/60 px-6 py-6 space-y-4 backdrop-blur-xl overflow-hidden"
          >
            <div className="flex flex-col space-y-3 font-lora text-sm tracking-[0.15em]">
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
                href="#about"
                onClick={() => {
                  setActiveSection('about');
                  setMobileMenuOpen(false);
                }}
                className="text-[#ded7cb] hover:text-[#c5944e] py-1 border-b border-[#291b10]"
              >
                ABOUT JUSTICIA
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
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="font-lora text-center text-xs font-bold tracking-[0.15em] bg-[#c5944e] text-[#160c0d] py-2.5 rounded"
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
