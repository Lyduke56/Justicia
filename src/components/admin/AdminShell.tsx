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
  ShieldCheckIcon,
  ScaleIcon,
  UserGroupIcon,
  BookOpenIcon,
  SparklesIcon,
  DocumentTextIcon,
  LogoutIcon,
} from './AdminIcons';

interface AdminShellProps {
  user: {
    id: string;
    email?: string;
    fullName: string;
  };
  children: React.ReactNode;
}

const ADMIN_NAV_ITEMS = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: HomeIcon,
  },
  {
    name: 'Verification Queue',
    href: '/admin/lawyers/verification-queue',
    icon: ShieldCheckIcon,
  },
  {
    name: 'Lawyer Directory',
    href: '/admin/lawyers',
    icon: ScaleIcon,
  },
  {
    name: 'User Accounts',
    href: '/admin/users',
    icon: UserGroupIcon,
  },
  {
    name: 'Knowledge Base',
    href: '/admin/knowledge-base',
    icon: BookOpenIcon,
  },
  {
    name: 'AI Management',
    href: '/admin/ai-management',
    icon: SparklesIcon,
  },
  {
    name: 'Security & Audit Log',
    href: '/admin/settings/security-audit-log',
    icon: DocumentTextIcon,
  },
];

export function AdminShell({ user, children }: AdminShellProps) {
  // Mount 30-min inactivity auto-logout
  useInactivityLogout();

  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const isCurrentActive = (href: string) => {
    return pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
  };

  return (
    <div className="flex flex-col h-screen bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30">
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="shrink-0 h-16 w-full bg-[#23150F] border-b border-[#352219] flex items-center justify-between px-4 sm:px-8 shadow-md z-40">
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
            href="/admin/dashboard"
            className="font-cinzel text-sm sm:text-base tracking-[0.2em] text-[#ded7cb] hover:text-[#C58B3C] transition-colors"
          >
            [LOGO HERE]
          </Link>
        </div>

        {/* Right: Icons (Home, Bell, Profile) - Settings icon removed */}
        <div className="flex items-center gap-4 sm:gap-6 text-[#ded7cb]">
          <Link
            href="/admin/dashboard"
            className={`p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] ${
              pathname === '/admin/dashboard' ? 'text-[#C58B3C]' : ''
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
                  <span className="font-semibold text-[#ded7cb]">Admin Notifications</span>
                  <span className="text-[10px] text-[#C58B3C]">Live</span>
                </div>
                <div className="py-3 space-y-2 text-[#C4B7A5]">
                  <div className="p-2 rounded-lg bg-[#341F16] hover:bg-[#3E251B] transition cursor-pointer">
                    <p className="font-medium text-[#ded7cb]">Verification Queue</p>
                    <p className="text-[10px] text-[#A69584] mt-0.5">Lawyer credentials ready for review.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#341F16] hover:bg-[#3E251B] transition cursor-pointer">
                    <p className="font-medium text-[#ded7cb]">Security & Audit</p>
                    <p className="text-[10px] text-[#A69584] mt-0.5">System audit log active and monitoring sessions.</p>
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
              <div className="absolute right-0 mt-3 w-56 rounded-2xl bg-[#2A1810] border border-[#3E271D] shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-[#3E271D]">
                  <p className="font-medium text-[#ded7cb] truncate">{user.fullName}</p>
                  <p className="text-[11px] text-[#A69584] truncate">{user.email}</p>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#C58B3C]/20 text-[#C58B3C]">
                    Administrator
                  </span>
                </div>
                <div className="py-1">
                  <Link
                    href="/admin/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition"
                  >
                    <UserCircleIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>Officer Profile</span>
                  </Link>
                  <Link
                    href="/admin/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition"
                  >
                    <GearIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>System Settings</span>
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
      <div className="flex flex-row flex-1 min-h-0 relative">
        {/* Left Sidebar (Desktop) */}
        <aside
          className="w-64 shrink-0 bg-[#DECEB8] border-r border-[#D1BEA8] p-5 hidden md:flex flex-col justify-between overflow-y-auto"
          aria-label="Admin portal navigation"
        >
          <div className="space-y-6">
            <nav className="space-y-2" aria-label="Main navigation">
              {ADMIN_NAV_ITEMS.map((item) => {
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
              href="/admin/settings"
              className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isCurrentActive('/admin/settings')
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
                    JUSTICIA ADMIN
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
                  {ADMIN_NAV_ITEMS.map((item) => {
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
                  href="/admin/settings"
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

export default AdminShell;
