'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import {
  HomeIcon,
  BellIcon,
  GearIcon,
  UserCircleIcon,
  AIAssistantIcon,
  FindLawyerIcon,
  MessagesIcon,
  BriefcaseFolderIcon,
  CalendarBookingIcon,
  LogoutIcon,
} from './ClientIcons';

// ─── View components (lazy-imported inline to keep bundle splits) ─────────────
import { DashboardView } from './views/DashboardView';
import { FindLawyerView } from './views/FindLawyerView';
import { MessagesView } from './views/MessagesView';
import { CasesView } from './views/CasesView';
import { ConsultationsView } from './views/ConsultationsView';
import { AIAssistantChat } from './AIAssistantChat';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ViewKey =
  | 'dashboard'
  | 'ai-assistant'
  | 'lawyers'
  | 'messages'
  | 'cases'
  | 'consultations';

interface NavItem {
  key: ViewKey;
  name: string;
  href: string;
  icon: React.FC<{ className?: string }>;
}

interface ClientShellProps {
  user: {
    id: string;
    email?: string;
    fullName: string;
  };
  children?: React.ReactNode;
}

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { key: 'ai-assistant',   name: 'AI Legal Assistant',    href: '/client/ai-assistant',  icon: AIAssistantIcon },
  { key: 'lawyers',        name: 'Find a Lawyer',         href: '/client/lawyers',        icon: FindLawyerIcon },
  { key: 'messages',       name: 'Messages',              href: '/client/messages',       icon: MessagesIcon },
  { key: 'cases',          name: 'My Cases & Documents',  href: '/client/cases',          icon: BriefcaseFolderIcon },
  { key: 'consultations',  name: 'Consultation Booking',  href: '/client/consultations',  icon: CalendarBookingIcon },
];

/** Derive ViewKey from the current pathname */
function pathnameToView(pathname: string): ViewKey {
  for (const item of NAV_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.key;
    }
  }
  return 'dashboard';
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ClientShell({ user }: ClientShellProps) {
  useInactivityLogout();

  const router   = useRouter();
  const pathname = usePathname();

  // Initialise view from current URL so hard-refresh works correctly
  const [activeView, setActiveView] = useState<ViewKey>(() => pathnameToView(pathname));
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false);
  const [userDropdownOpen,  setUserDropdownOpen]  = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Keep view in sync when the user navigates with browser back/forward
  useEffect(() => {
    setActiveView(pathnameToView(pathname));
  }, [pathname]);

  // Navigate: update view state + push URL (no full page load)
  const navigate = useCallback(
    (key: ViewKey) => {
      const item = NAV_ITEMS.find((n) => n.key === key);
      const href = item?.href ?? '/client/dashboard';
      setActiveView(key);
      router.push(href, { scroll: false });
      setMobileMenuOpen(false);
    },
    [router]
  );

  const navigateToDashboard = useCallback(() => {
    setActiveView('dashboard');
    router.push('/client/dashboard', { scroll: false });
  }, [router]);

  const firstName = user.fullName.trim().split(' ')[0] || user.fullName;

  // ─── Render active view ───────────────────────────────────────────────────
  function renderView() {
    switch (activeView) {
      case 'ai-assistant':
        return <AIAssistantChat userFirstName={firstName} />;
      case 'lawyers':
        return <FindLawyerView isLoggedIn={true} userId={user.id} />;
      case 'messages':
        return <MessagesView />;
      case 'cases':
        return <CasesView />;
      case 'consultations':
        return <ConsultationsView onNavigate={navigate} />;
      default:
        return <DashboardView firstName={firstName} />;
    }
  }

  return (
    /*
     * Shell layout:
     *   flex-col h-screen        → fills viewport exactly
     *   header (shrink-0)        → never scrolls
     *   flex-row flex-1 min-h-0  → remaining height; min-h-0 prevents flex blowout
     *     aside (overflow-y-auto)→ locked column, scrollable only if nav items overflow
     *     main  (overflow-y-auto)→ THE ONLY scrollable zone
     */
    <div className="flex flex-col h-screen bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30">

      {/* ─── Top Navigation Bar ──────────────────────────────────────────────── */}
      <header className="shrink-0 h-16 w-full bg-[#23150F] border-b border-[#352219] flex items-center justify-between px-4 sm:px-8 shadow-md z-40">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            id="mobile-menu-toggle"
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

          <button
            type="button"
            id="nav-logo"
            onClick={navigateToDashboard}
            className="font-cinzel text-sm sm:text-base tracking-[0.2em] text-[#ded7cb] hover:text-[#C58B3C] transition-colors"
          >
            [LOGO HERE]
          </button>
        </div>

        {/* Right: Icons */}
        <div className="flex items-center gap-4 sm:gap-6 text-[#ded7cb]">
          <button
            type="button"
            id="nav-home"
            onClick={navigateToDashboard}
            className={`p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] ${
              activeView === 'dashboard' ? 'text-[#C58B3C]' : ''
            }`}
            title="Dashboard Home"
            aria-label="Dashboard Home"
          >
            <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              id="nav-notifications"
              onClick={() => { setNotificationsOpen(!notificationsOpen); setUserDropdownOpen(false); }}
              className="relative p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] focus:outline-none"
              title="Notifications"
              aria-label="Notifications"
            >
              <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C58B3C] animate-pulse" />
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl bg-[#2A1810] border border-[#3E271D] shadow-2xl p-4 text-xs z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-[#3E271D]">
                  <span className="font-semibold text-[#ded7cb]">Notifications</span>
                  <span className="text-[10px] text-[#C58B3C]">Mark all read</span>
                </div>
                <div className="py-3 space-y-2 text-[#C4B7A5]">
                  <div className="p-2 rounded-lg bg-[#341F16] hover:bg-[#3E251B] transition cursor-pointer">
                    <p className="font-medium text-[#ded7cb]">Consultation Confirmed</p>
                    <p className="text-[10px] text-[#A69584] mt-0.5">Your booking with Atty. Santos is verified.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-[#341F16] hover:bg-[#3E251B] transition cursor-pointer">
                    <p className="font-medium text-[#ded7cb]">AI Assistant Update</p>
                    <p className="text-[10px] text-[#A69584] mt-0.5">Civil Code and Labor Code references updated.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative">
            <button
              type="button"
              id="nav-user-menu"
              onClick={() => { setUserDropdownOpen(!userDropdownOpen); setNotificationsOpen(false); }}
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
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    id="dropdown-my-profile"
                    onClick={() => { router.push('/client/profile'); setUserDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition text-left"
                  >
                    <UserCircleIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    id="dropdown-settings"
                    onClick={() => { router.push('/client/settings'); setUserDropdownOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition text-left"
                  >
                    <GearIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>Account Settings</span>
                  </button>
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

      {/* ─── Body: Sidebar + Content ─────────────────────────────────────────── */}
      {/*
        min-h-0 is CRITICAL here: without it flex children can exceed the parent's
        height and break scroll containment (the sidebar would grow infinitely).
      */}
      <div className="flex flex-row flex-1 min-h-0 relative">

        {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
        <aside
          className="w-64 shrink-0 bg-[#DECEB8] border-r border-[#D1BEA8] p-5 hidden md:flex flex-col justify-between overflow-y-auto"
          aria-label="Client portal navigation"
        >
          <div className="space-y-6">
            <nav className="space-y-2" aria-label="Main navigation">
              {NAV_ITEMS.map((item) => {
                const active = activeView === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    id={`sidebar-nav-${item.key}`}
                    onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all text-left ${
                      active
                        ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                        : 'text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#34150F]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#C58B3C]' : 'text-[#5C4535]'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom: Settings + Logout */}
          <div className="space-y-2 pt-6">
            <hr className="border-[#C8B59E] mb-4" />
            <button
              type="button"
              id="sidebar-settings"
              onClick={() => router.push('/client/settings')}
              className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#34150F] transition-all text-left"
            >
              <GearIcon className="w-5 h-5 text-[#5C4535]" />
              <span>Settings</span>
            </button>

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

        {/* ── Mobile Sidebar Drawer ────────────────────────────────────────────── */}
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
                    JUSTICIA
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
                  {NAV_ITEMS.map((item) => {
                    const active = activeView === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => navigate(item.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                          active
                            ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                            : 'text-[#3E2A1E] hover:bg-[#E5D7C5]'
                        }`}
                      >
                        <Icon className="w-5 h-5 text-[#5C4535]" />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#C8B59E]">
                <button
                  type="button"
                  onClick={() => { router.push('/client/settings'); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#3E2A1E] hover:bg-[#E5D7C5] text-left"
                >
                  <GearIcon className="w-5 h-5 text-[#5C4535]" />
                  <span>Settings</span>
                </button>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#3E2A1E] hover:text-[#99431E] text-left"
                  >
                    <LogoutIcon className="w-5 h-5 text-[#5C4535]" />
                    <span>Logout</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content Viewport (ONLY scrollable zone) ─────────────────────── */}
        <main
          className="flex-1 overflow-y-auto bg-[#EFE5D8]"
          id="client-main-content"
        >
          {/*
            key={activeView} → React unmounts/remounts on view change,
            triggering the CSS fade-in animation defined in globals.css
          */}
          <div key={activeView} className="client-view-enter">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}
