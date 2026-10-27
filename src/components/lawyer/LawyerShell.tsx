'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import {
  HomeIcon,
  BellIcon,
  UserCircleIcon,
  GearIcon,
  DashboardGridIcon,
  ConsultationChatIcon,
  MessagesIcon,
  CalendarGridIcon,
  ClientDocumentsIcon,
  UserPersonIcon,
  LogoutIcon,
} from './LawyerIcons';

import { LawyerDashboardView } from './views/LawyerDashboardView';
import { LawyerConsultationsView } from './views/LawyerConsultationsView';
import { DocumentsView } from '@/components/documents/DocumentsView';

export type LawyerViewKey =
  | 'dashboard'
  | 'consultations'
  | 'messages'
  | 'calendar'
  | 'documents'
  | 'profile'
  | 'settings'
  | 'other';

interface LawyerNavItem {
  key: Exclude<LawyerViewKey, 'settings' | 'other'>;
  name: string;
  href: string;
  icon: React.FC<{ className?: string }>;
}

interface LawyerShellProps {
  user: {
    id: string;
    email?: string;
    fullName: string;
    rollNumber?: string;
    ibpChapter?: string;
    isVerified?: boolean;
  };
  children?: React.ReactNode;
}

/**
 * EXACT sidebar sections as designed in Figma mockups:
 * 1. Lawyer Dashboard
 * 2. Consultations
 * 3. Messages
 * 4. Calendar
 * 5. Client Documents
 * 6. Lawyer Profile
 * ── Divider ──
 * 7. Settings
 * 8. Logout
 */
const LAWYER_NAV_ITEMS: LawyerNavItem[] = [
  { key: 'dashboard',      name: 'Lawyer Dashboard',  href: '/lawyer/dashboard',      icon: DashboardGridIcon },
  { key: 'consultations',  name: 'Consultations',     href: '/lawyer/consultations',  icon: ConsultationChatIcon },
  { key: 'messages',       name: 'Messages',          href: '/lawyer/messages',       icon: MessagesIcon },
  { key: 'calendar',       name: 'Calendar',          href: '/lawyer/calendar',       icon: CalendarGridIcon },
  { key: 'documents',      name: 'Client Documents',  href: '/lawyer/documents',      icon: ClientDocumentsIcon },
  { key: 'profile',        name: 'Lawyer Profile',    href: '/lawyer/profile',        icon: UserPersonIcon },
];

/** Derive LawyerViewKey from the current pathname */
function pathnameToView(pathname: string): LawyerViewKey {
  if (pathname === '/lawyer/dashboard') return 'dashboard';
  if (pathname === '/lawyer/consultations' || pathname.startsWith('/lawyer/consultations/')) return 'consultations';
  if (pathname === '/lawyer/messages' || pathname.startsWith('/lawyer/messages/')) return 'messages';
  if (pathname === '/lawyer/calendar' || pathname.startsWith('/lawyer/calendar/') || pathname.startsWith('/lawyer/availability')) return 'calendar';
  if (pathname === '/lawyer/documents' || pathname.startsWith('/lawyer/documents/')) return 'documents';
  if (pathname === '/lawyer/profile' || pathname.startsWith('/lawyer/profile/')) return 'profile';
  if (pathname === '/lawyer/settings' || pathname.startsWith('/lawyer/settings/')) return 'settings';
  return 'dashboard';
}

export function LawyerShell({ user, children }: LawyerShellProps) {
  useInactivityLogout();

  const router = useRouter();
  const pathname = usePathname();

  const [activeView, setActiveView] = useState<LawyerViewKey>(() => pathnameToView(pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    setActiveView(pathnameToView(pathname));
  }, [pathname]);

  const navigate = useCallback(
    (key: LawyerViewKey) => {
      const item = LAWYER_NAV_ITEMS.find((n) => n.key === key);
      const href = item?.href ?? (key === 'settings' ? '/lawyer/settings' : '/lawyer/dashboard');
      setActiveView(key);
      router.push(href, { scroll: false });
      setMobileMenuOpen(false);
    },
    [router]
  );

  const navigateToDashboard = useCallback(() => {
    setActiveView('dashboard');
    router.push('/lawyer/dashboard', { scroll: false });
  }, [router]);

  function renderView() {
    switch (activeView) {
      case 'consultations':
        return <LawyerConsultationsView />;
      case 'dashboard':
        return <LawyerDashboardView />;
      case 'documents':
        return <DocumentsView role="lawyer" />;
      default:
        return children ?? <LawyerDashboardView />;
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

      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="shrink-0 h-16 w-full bg-[#23150F] border-b border-[#352219] flex items-center justify-between px-4 sm:px-8 shadow-md z-40">
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            id="lawyer-mobile-menu-toggle"
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
            id="lawyer-nav-logo"
            onClick={navigateToDashboard}
            className="font-cinzel text-sm sm:text-base tracking-[0.2em] text-[#ded7cb] hover:text-[#C58B3C] transition-colors"
          >
            [LOGO HERE]
          </button>
        </div>

        {/* Right: Icons (Home, Bell, Settings, Profile) - matching Figma header */}
        <div className="flex items-center gap-4 sm:gap-6 text-[#ded7cb]">
          <button
            type="button"
            id="lawyer-nav-home"
            onClick={navigateToDashboard}
            className={`p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] ${
              activeView === 'dashboard' ? 'text-[#C58B3C]' : ''
            }`}
            title="Dashboard Home"
            aria-label="Dashboard Home"
          >
            <HomeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Notifications button */}
          <div className="relative">
            <button
              type="button"
              id="lawyer-nav-notifications"
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

          {/* Settings shortcut button (as present in Figma header) */}
          <button
            type="button"
            id="lawyer-nav-settings"
            onClick={() => navigate('settings')}
            className={`p-1.5 rounded-lg transition-colors hover:text-[#C58B3C] ${
              activeView === 'settings' ? 'text-[#C58B3C]' : ''
            }`}
            title="Account Settings"
            aria-label="Account Settings"
          >
            <GearIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* User Profile Avatar / Menu */}
          <div className="relative">
            <button
              type="button"
              id="lawyer-nav-user-menu"
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
                  <button
                    type="button"
                    onClick={() => {
                      navigate('profile');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#ded7cb] hover:bg-[#3E271D] transition text-left"
                  >
                    <UserPersonIcon className="w-4 h-4 text-[#C58B3C]" />
                    <span>Public Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('settings');
                      setUserDropdownOpen(false);
                    }}
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
      <div className="flex flex-row flex-1 min-h-0 relative">
        {/* Desktop Sidebar (Figma Mockup: 6 main items + Divider + Settings + Logout) */}
        <aside
          className="w-64 shrink-0 bg-[#DECEB8] border-r border-[#D1BEA8] p-5 hidden md:flex flex-col justify-between overflow-y-auto"
          aria-label="Lawyer practice navigation"
        >
          <div className="space-y-6">
            <nav className="space-y-2" aria-label="Main navigation">
              {LAWYER_NAV_ITEMS.map((item) => {
                const active = activeView === item.key;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    id={`lawyer-sidebar-nav-${item.key}`}
                    onClick={() => navigate(item.key)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all text-left ${
                      active
                        ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                        : 'text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#34150F]'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#C58B3C]' : 'text-[#5C4535]'}`} />
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar: Divider + Settings + Logout */}
          <div className="space-y-2 pt-6">
            <hr className="border-[#C8B59E] mb-4" />
            <button
              type="button"
              id="lawyer-sidebar-settings"
              onClick={() => navigate('settings')}
              className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all text-left ${
                activeView === 'settings'
                  ? 'bg-[#D4C1AB] text-[#34150F] font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.14),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]'
                  : 'text-[#3E2A1E] hover:bg-[#E5D7C5] hover:text-[#34150F]'
              }`}
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
                        <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#C58B3C]' : 'text-[#5C4535]'}`} />
                        <span>{item.name}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="space-y-2 pt-4 border-t border-[#C8B59E]">
                <button
                  type="button"
                  onClick={() => navigate('settings')}
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

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-[#ECE1D2]" id="lawyer-main-content">
          <div key={activeView} className="client-view-enter">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default LawyerShell;
