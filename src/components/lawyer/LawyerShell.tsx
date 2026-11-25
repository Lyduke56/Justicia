'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useMyAvatarSync } from '@/components/account/avatarStore';
import { ScreenTransitionOverlay, useScreenTransition } from '@/components/shared/loading';
import {
  DashboardGridIcon,
  EarningsPayoutsIcon,
  ConsultationChatIcon,
  MessagesIcon,
  ClientDocumentsIcon,
  UserPersonIcon,
} from './LawyerIcons';
import { ClientTopbar } from '@/components/client/ClientTopbar';
import { ClientSidebar } from '@/components/client/ClientSidebar';

import { LawyerDashboardView } from './views/LawyerDashboardView';
import { LawyerConsultationsView } from './views/LawyerConsultationsView';
import { LawyerEarningsView } from './views/LawyerEarningsView';
import { DocumentsView } from '@/components/documents/DocumentsView';
import { MessagesView } from '@/components/client/views/MessagesView';
import { KeepAliveViews } from '@/components/live/KeepAliveViews';
import { useLiveRefresh } from '@/components/live/LiveProvider';
import { fetchLive, type LiveResources } from '@/lib/live/fetchLive';

export type LawyerViewKey =
  | 'dashboard'
  | 'consultations'
  | 'messages'
  | 'calendar'
  | 'documents'
  | 'earnings'
  | 'reviews'
  | 'profile'
  | 'settings'
  /** My Profile in the account menu: the personal profile page (/lawyer/account). */
  | 'account'
  | 'other';

interface LawyerNavItem {
  key: Exclude<LawyerViewKey, 'settings' | 'account' | 'other'>;
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
    /** Profile photo (null shows the person icon). */
    avatarUrl?: string | null;
  };
  children?: React.ReactNode;
}

/**
 * Sidebar sections (rendered by the shared ClientSidebar, same design as the client portal):
 * 1. Lawyer Dashboard
 * 2. Consultations
 * 3. Messages
 * 4. Client Documents
 * 5. Lawyer Profile
 * 6. Earnings & Payouts
 * ── Divider ──
 * 7. Settings
 * 8. Logout
 */
const LAWYER_NAV_ITEMS: LawyerNavItem[] = [
  { key: 'dashboard',      name: 'Lawyer Dashboard',  href: '/lawyer/dashboard',      icon: DashboardGridIcon },
  { key: 'consultations',  name: 'Consultations',     href: '/lawyer/consultations',  icon: ConsultationChatIcon },
  { key: 'messages',       name: 'Messages',          href: '/lawyer/messages',       icon: MessagesIcon },
  { key: 'documents',      name: 'Client Documents',  href: '/lawyer/documents',      icon: ClientDocumentsIcon },
  { key: 'profile',        name: 'Lawyer Profile',    href: '/lawyer/profile',        icon: UserPersonIcon },
  { key: 'earnings',       name: 'Earnings & Payouts', href: '/lawyer/earnings',      icon: EarningsPayoutsIcon },
];

/** Derive LawyerViewKey from the current pathname */
function pathnameToView(pathname: string): LawyerViewKey {
  if (pathname === '/lawyer/dashboard') return 'dashboard';
  if (pathname === '/lawyer/consultations' || pathname.startsWith('/lawyer/consultations/')) return 'consultations';
  if (pathname === '/lawyer/messages' || pathname.startsWith('/lawyer/messages/')) return 'messages';
  if (pathname === '/lawyer/calendar' || pathname.startsWith('/lawyer/calendar/') || pathname.startsWith('/lawyer/availability')) return 'calendar';
  if (pathname === '/lawyer/documents' || pathname.startsWith('/lawyer/documents/')) return 'documents';
  if (pathname === '/lawyer/earnings' || pathname.startsWith('/lawyer/earnings/')) return 'earnings';
  if (pathname === '/lawyer/reviews' || pathname.startsWith('/lawyer/reviews/')) return 'reviews';
  if (pathname === '/lawyer/profile' || pathname.startsWith('/lawyer/profile/')) return 'profile';
  if (pathname === '/lawyer/settings' || pathname.startsWith('/lawyer/settings/')) return 'settings';
  if (pathname === '/lawyer/account' || pathname.startsWith('/lawyer/account/')) return 'account';
  return 'dashboard';
}

export function LawyerShell({ user, children }: LawyerShellProps) {
  useInactivityLogout();
  useMyAvatarSync(user.avatarUrl);

  const router = useRouter();
  const pathname = usePathname();

  const [activeView, setActiveView] = useState<LawyerViewKey>(() => pathnameToView(pathname));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveLawyerNotifs, setLiveLawyerNotifs] = useState<LiveResources['notifications']>([]);
  // Global loading screen over the content area while the shell switches screens.
  const { loading: screenLoading, start: startScreenTransition } = useScreenTransition(pathname);

  const loadNotifications = useCallback(
    () =>
      fetchLive('notifications', { role: 'lawyer' })
        .then((data) => {
          if (data) setLiveLawyerNotifs(data);
        })
        .catch(() => {}),
    []
  );

  useEffect(() => {
    loadNotifications();
    // Time-based "consultation starting soon" alerts are generated on read, so keep a slow tick.
    const timer = setInterval(loadNotifications, 60000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  // New notifications arrive instantly via Supabase Realtime.
  useLiveRefresh(['notifications'], loadNotifications);

  // While a sidebar navigation is in flight, ignore intermediate pathnames
  // (rapid clicks A → B → C would otherwise flash B when its URL commits).
  const pendingPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingPathRef.current && pathname !== pendingPathRef.current) return;
    pendingPathRef.current = null;
    setActiveView(pathnameToView(pathname));
  }, [pathname]);

  // Warm the router cache for every sidebar destination.
  useEffect(() => {
    for (const item of LAWYER_NAV_ITEMS) router.prefetch(item.href);
    router.prefetch('/lawyer/settings');
    router.prefetch('/lawyer/account');
  }, [router]);

  const navigate = useCallback(
    (key: LawyerViewKey) => {
      const item = LAWYER_NAV_ITEMS.find((n) => n.key === key);
      const href = item?.href ?? (key === 'settings' ? '/lawyer/settings' : key === 'account' ? '/lawyer/account' : '/lawyer/dashboard');
      startScreenTransition(href);
      setActiveView(key);
      pendingPathRef.current = href;
      router.push(href, { scroll: false });
      setMobileMenuOpen(false);
    },
    [router, startScreenTransition]
  );

  const navigateToDashboard = useCallback(() => {
    startScreenTransition('/lawyer/dashboard');
    setActiveView('dashboard');
    pendingPathRef.current = '/lawyer/dashboard';
    router.push('/lawyer/dashboard', { scroll: false });
  }, [router, startScreenTransition]);

  const handleNotificationClick = useCallback(
    (n: LiveResources['notifications'][number]) => {
      if (n.type === 'meeting_starting' || n.type === 'new_message') {
        const thread = n.metadata?.threadId;
        const href = thread ? `/lawyer/messages?thread=${thread}` : '/lawyer/messages';
        startScreenTransition(href);
        setActiveView('messages');
        router.push(href, { scroll: false });
      } else if (n.type?.includes('consultation')) navigate('consultations');
    },
    [router, navigate, startScreenTransition]
  );

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const settingsActive = activeView === 'settings';

  // Tabs that stay mounted once opened (instant switching, live-refreshed).
  // Route-driven pages (profile, settings, reviews, …) render from `children`.
  const keepAliveViews: Record<string, () => React.ReactNode> = {
    dashboard: () => <LawyerDashboardView />,
    consultations: () => <LawyerConsultationsView lawyerUserId={user.id} lawyerName={user.fullName} />,
    messages: () => <MessagesView role="lawyer" />,
    documents: () => <DocumentsView role="lawyer" />,
    earnings: () => <LawyerEarningsView isDemo={user.id.startsWith('demo-')} />,
  };
  const keepAliveKey = activeView in keepAliveViews ? activeView : null;

  return (
    /*
     * Shell layout:
     *   flex-col h-screen        → fills viewport exactly
     *   header (shrink-0)        → never scrolls
     *   flex-row flex-1 min-h-0  → remaining height; min-h-0 prevents flex blowout
     *     aside (overflow-y-auto)→ locked column, scrollable only if nav items overflow
     *     main  (overflow-y-auto)→ THE ONLY scrollable zone
     */
    <div className="lawyer-portal flex flex-col h-screen bg-[#E5D8CB] text-[#341512] selection:bg-[#C58B3C]/30" data-view={activeView}>

      {/* ─── Top Navigation Bar (shared with the client portal) ─────────────── */}
      <ClientTopbar
        user={user}
        accountDetail={user.rollNumber ? `Roll #${user.rollNumber} · ${user.ibpChapter || 'IBP Member'}` : undefined}
        seenKey="justicia:lawyer:notifications-seen-at"
        homeActive={activeView === 'dashboard'}
        settingsActive={settingsActive}
        notifications={liveLawyerNotifs}
        onHome={navigateToDashboard}
        onSettings={() => navigate('settings')}
        onProfile={() => navigate('account')}
        onNotificationClick={handleNotificationClick}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
      />

      {/* ─── Body: Sidebar + Content ─────────────────────────────────────────── */}
      <div className="flex flex-row flex-1 min-h-0 relative">
        {/* ── Sidebar (desktop column + mobile drawer, shared with the client portal) ── */}
        <ClientSidebar
          items={LAWYER_NAV_ITEMS}
          activeKey={settingsActive ? null : activeView}
          settingsActive={settingsActive}
          onSelect={(key) => navigate(key as LawyerViewKey)}
          onSettings={() => navigate('settings')}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={closeMobileMenu}
          ariaLabel="Lawyer practice navigation"
        />

        {/* Main Content Viewport; the wrapper positions the screen-transition loader over it. */}
        <div className="relative flex min-w-0 flex-1" data-screen-loading={screenLoading || undefined}>
          <main
            className={`flex-1 min-w-0 overflow-y-auto bg-[#E5D8CB] ${activeView === 'documents' ? 'lawyer-designed-view' : ''}`}
            id="lawyer-main-content"
            aria-busy={screenLoading || undefined}
          >
            <KeepAliveViews
              activeKey={keepAliveKey}
              views={keepAliveViews}
              fallback={children ?? <LawyerDashboardView />}
              fallbackKey={pathname}
              scrollContainerId="lawyer-main-content"
            />
          </main>
          <ScreenTransitionOverlay show={screenLoading} />
        </div>
      </div>
    </div>
  );
}

export default LawyerShell;
