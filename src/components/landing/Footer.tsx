import React from 'react';
import Link from 'next/link';
import { ScalesLogo } from './LawIcons';

export function Footer() {
  return (
    <footer className="relative bg-[#070402] border-t border-[#26190f] text-[#8e8275] py-12 px-4 sm:px-6 lg:px-12 z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand & Motto */}
        <div className="flex items-center gap-3">
          <ScalesLogo className="w-5 h-5 text-[#c59341]" />
          <div className="flex flex-col">
            <span className="font-cinzel font-bold text-sm tracking-[0.2em] text-[#ded7cb]">
              JUSTICIA
            </span>
            <span className="font-cinzel text-[10px] tracking-widest text-[#8c8072]">
              NEMO EST SUPRA LEGES
            </span>
          </div>
        </div>

        {/* Legal Disclaimer */}
        <p className="text-center md:text-left text-xs max-w-xl text-[#786d62] font-sans">
          Disclaimer: Justicia AI provides general legal information and assistance based on Philippine statutes and jurisprudence. It does not constitute formal legal representation. Always consult a licensed attorney for specific legal counsel.
        </p>

        {/* Navigation / Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-xs font-cinzel">
          <Link href="/privacy" className="hover:text-[#c59341] transition-colors">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline text-[#3a2c20]">•</span>
          <Link href="/terms" className="hover:text-[#c59341] transition-colors">
            Terms of Service
          </Link>
          <span className="hidden sm:inline text-[#3a2c20]">•</span>
          <span className="text-[#655b51]">© {new Date().getFullYear()} Justicia</span>
        </div>
      </div>
    </footer>
  );
}
