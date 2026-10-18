'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import {
  HomeIcon,
  BellIcon,
  UserCircleIcon,
  GearIcon,
  CalendarBookingIcon,
  UserGroupIcon,
  ScaleIcon,
  ClockIcon,
  ShieldCheckIcon,
  MessagesIcon,
  BriefcaseFolderIcon,
  StarIcon,
  LogoutIcon,
} from './LawyerIcons';

interface LawyerShellProps {
  user: {
    id: string;
    email?: string;
    fullName: string;
    rollNumber?: string;
    ibpChapter?: string;
    isVerified?: boolean;
  };
  children: React.ReactNode;
}

const LAWYER_NAV_ITEMS = [
  {
    name: 'Dashboard',
    href: '/lawyer/dashboard',
    icon: HomeIcon,
  },
  {
    name: 'Consultations',
    href: '/lawyer/consultations',
    icon: CalendarBookingIcon,
  },
  {
    name: 'My Clients',
    href: '/lawyer/clients',
    icon: UserGroupIcon,
  },
  {
    name: 'Active Cases',
    href: '/lawyer/cases',
    icon: ScaleIcon,
  },
  {
    name: 'Availability & Rates',
    href: '/lawyer/availability',
    icon: ClockIcon,
  },
  {
    name: 'Verification Status',
    href: '/lawyer/verification',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Messages',
    href: '/lawyer/messages',
    icon: MessagesIcon,
  },
  {
    name: 'Documents',
    href: '/lawyer/documents',
    icon: BriefcaseFolderIcon,
  },
  {
    name: 'Client Reviews',
    href: '/lawyer/reviews',
    icon: StarIcon,
  },
];

export function LawyerShell({ user, children }: LawyerShellProps) {
  // Mount 30-min inactivity auto-logout
  useInactivityLogout();

  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const isCurrentActive = (href: string) => {
    return pathname === href || (href !== '/lawyer/dashboard' && pathname.startsWith(href));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30">
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-16 w-full bg-[#23150F] border-b border-[#352219] flex items-center justify-between px-4 sm:px-8 shadow-md">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-[#ded7cb] hover:text-[#C58B3C] p-1.5 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          <Link
            href="/lawyer/dashboard"
            className="font-cinzel text-sm sm:text-base tracking-[0.2em] text-[#ded7cb] hover:text-[#C58B3C] transition-colors"
          >
            [LOGO HERE]
          </Link>
        </div>

        {/* Right: Icons (Home, Bell, Profile) - Settings icon removed */}
        <div className="flex items-center gap-4 sm:gap-6 text-[#ded7cb]">
          <Link
            href="/lawyer/dashboard"
            className={`p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] ${
              pathname === '/lawyer/dashboard' ? 'text-[#C58B3C]' : ''
            }`}
            title="Dashboard Home"
            aria-label="Dashboard Home"
          >
            <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </Link>

          {/* Notifications button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setUserDropdownOpen(false);
              }}
              className="relative p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] focus:outline-none"
              title="Notifications"
              aria-label="Notifications"
            >
              <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C58B3C] animate-pulse" />
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-[#2A1810] border border-[#3E271D] shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#3E271D]">
                  <span className="font-semibold text-[#ded7cb]">Lawyer Notifications</span>
                  <span className="text-[10px] text-[#C58B3C]">Active</span>
                </div>
                <div className="py-3 space-y-2 text-[#C4B7A5]">
                  <div className="p-2 rounded-lg bg-[#341F16] hover:bg-[#3E251B] transition cursor-pointer">
                    <p className="font-medium text-[#ded7cb]">Verified Counsel Status</p>
                    <p className="text-[10px] text-[#A69584] mt-0.5">Your profile is visible in Find a Lawyer directory.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#341F16] hover:bg-[#3E251B] transition cursor-pointer">
                    <p className="font-medium text-[#ded7cb]">Consultation Requests</p>
                    <p className="text-[10px] text-[#A69584] mt-0.5">Calendar availability is active for client bookings.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar / Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserDropdownOpen(!userDropdownOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 p-1 rounded-full hover:text-[#C58B3C] transition-colors focus:outline-none"
              title={user.fullName}
              aria-label="User Menu"
            >
              <UserCircleIcon className="w-6 h-6 sm:w-7 sm:h-7 text-[#ded7cb]" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-3 w-60 rounded-2xl bg-[#2A1810] border border-[#3E271D] shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-[#3E271D]">
                  <p className="font-medium text-[#ded7cb] truncate">{user.fullName}</p>
                  <p className="text-[11px] text-[#A69584] truncate">{user.email}</p>
                  {user.rollNumber && (
                    <p className="text-[10px] text-[#C58B3C] uppercase tracking-wider font-semibold mt-0.5">
                      Roll #{user.rollNumber} • {user.ibpChapter || 'IBP Member'}
                    </p>
                  )}
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-600/20 text-emerald-400">
                    Verified Counsel
                  </span>
                </div>
                <div className="py-1">
                  <Link
                    href="/lawyer/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition"
                  >
                    <UserCircleIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>Public Profile</span>
                  </Link>
                  <Link
                    href="/lawyer/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition"
                  >
                    <GearIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>Account Settings</span>
                  </Link>
                </div>
                <div className="pt-1 border-t border-[#3E271D]">
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-950/30 transition text-left"
                    >
                      <LogoutIcon className="w-4 h-4 text-red-400" />
                      <span>Sign Out</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Body Layout: Left Sidebar + Main Content ──────────────────────── */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Left Sidebar (Desktop) */}
        <aside
          className="w-64 shrink-0 bg-[#DECEB8] border-r border-[#D1BEA8] p-5 hidden md:flex flex-col justify-between"
          aria-label="Lawyer practice navigation"
        >
          <div className="space-y-6">
            <nav className="space-y-2" aria-label="Main navigation">
              {LAWYER_NAV_ITEMS.map((item) => {
                const active = isCurrentActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      active
                        ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                        : 'text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#34150F]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#C58B3C]' : 'text-[#5C4535]'}`} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar: Divider + Settings + Logout */}
          <div className="space-y-2 pt-6">
            <hr className="border-[#C8B59E] mb-4" />
            <Link
              href="/lawyer/settings"
              className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isCurrentActive('/lawyer/settings')
                  ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                  : 'text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#34150F]'
              }`}
            >
              <GearIcon className="w-5 h-5 text-[#5C4535]" />
              <span>Settings</span>
            </Link>

            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#99431E] transition-all text-left"
              >
                <LogoutIcon className="w-5 h-5 text-[#5C4535]" />
                <span>Logout</span>
              </button>
            </form>
          </div>
        </aside>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <div className="relative w-72 max-w-[80vw] bg-[#DECEB8] h-full shadow-2xl p-5 flex flex-col justify-between z-10">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#D1BEA8]">
                  <span className="font-cinzel text-sm font-semibold tracking-wider text-[#34150F]">
                    JUSTICIA LAWYER
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1 rounded-md text-[#5C4535] hover:text-[#34150F]"
                  >
                    ✕
                  </button>
                </div>

                <nav className="space-y-2">
                  {LAWYER_NAV_ITEMS.map((item) => {
                    const active = isCurrentActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          active
                            ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                            : 'text-[#3E2A1E] hover:bg-[#E5D7C5]'
                        }`}
                      >
                        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#C58B3C]' : 'text-[#5C4535]'}`} />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#C8B59E]">
                <Link
                  href="/lawyer/settings"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#3E2A1E] hover:bg-[#E5D7C5]"
                >
                  <GearIcon className="w-5 h-5 text-[#5C4535]" />
                  <span>Settings</span>
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#3E2A1E] hover:text-[#99431E]"
                  >
                    <LogoutIcon className="w-5 h-5 text-[#5C4535]" />
                    <span>Logout</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#EFE5D8]">
          {children}
        </main>
      </div>
    </div>
  );
}

export default LawyerShell;
