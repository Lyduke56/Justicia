'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KeepAliveViews } from '@/components/live/KeepAliveViews';
import { useLiveRefresh } from '@/components/live/LiveProvider';
import { fetchLive, type LiveResources } from '@/lib/live/fetchLive';
import { useRouter, usePathname } from 'next/navigation';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useMyAvatarSync } from '@/components/account/avatarStore';
import {
  AIAssistantIcon,
  FindLawyerIcon,
  MessagesIcon,
  BriefcaseFolderIcon,
  CalendarBookingIcon,
} from './ClientIcons';
import { ClientSidebar } from './ClientSidebar';
import { ClientTopbar } from './ClientTopbar';

// ─── View components (lazy-imported inline to keep bundle splits) ─────────────
import { DashboardView } from './views/DashboardView';
import { FindLawyerView } from './views/FindLawyerView';
import { MessagesView } from './views/MessagesView';
import { DocumentsView } from '@/components/documents/DocumentsView';
import { ConsultationsView } from './views/ConsultationsView';
import { AIAssistantChat } from './AIAssistantChat';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ViewKey =
  | 'dashboard'
  | 'ai-assistant'
  | 'lawyers'
  | 'messages'
  | 'cases'
  | 'consultations'
  | 'other';

interface NavItem {
  key: Exclude<ViewKey, 'other'>;
  name: string;
  href: string;
  icon: React.FC<{ className?: string }>;
}

interface ClientShellProps {
  user: {
    id: string;
    email?: string;
    fullName: string;
    /** Profile photo (null shows the person icon). */
    avatarUrl?: string | null;
  };
  children?: React.ReactNode;
}

// ─── Nav config ───────────────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
  { key: 'ai-assistant',   name: 'AI Legal Assistant',    href: '/client/ai-assistant',  icon: AIAssistantIcon },
  { key: 'lawyers',        name: 'Find a Lawyer',         href: '/client/lawyers',        icon: FindLawyerIcon },
  { key: 'messages',       name: 'Messages',              href: '/client/messages',       icon: MessagesIcon },
  { key: 'cases',          name: 'My Documents',          href: '/client/documents',      icon: BriefcaseFolderIcon },
  { key: 'consultations',  name: 'Consultation Booking',  href: '/client/consultations',  icon: CalendarBookingIcon },
];

/** Derive ViewKey from the current pathname */
function pathnameToView(pathname: string): ViewKey {
  if (
    pathname === '/client/documents' ||
    pathname.startsWith('/client/documents/') ||
    pathname === '/client/cases' ||
    pathname.startsWith('/client/cases/')
  ) {
    return 'cases';
  }
  for (const item of NAV_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return item.key;
    }
  }
  if (pathname === '/client/dashboard') return 'dashboard';
  return 'other';
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ClientShell({ user, children }: ClientShellProps) {
  useInactivityLogout();
  useMyAvatarSync(user.avatarUrl);

  const router   = useRouter();
  const pathname = usePathname();

  // Initialise view from current URL so hard-refresh works correctly
  const [activeView, setActiveView] = useState<ViewKey>(() => pathnameToView(pathname));
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false);
  const [liveNotifs, setLiveNotifs] = useState<LiveResources['notifications']>([]);

  const loadNotifications = useCallback(
    () =>
      fetchLive('notifications', { role: 'client' })
        .then((data) => {
          if (data) setLiveNotifs(data);
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

  // Keep view in sync when the user navigates with browser back/forward, but
  // ignore intermediate pathnames while a sidebar navigation is in flight.
  const pendingPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (pendingPathRef.current && pathname !== pendingPathRef.current) return;
    pendingPathRef.current = null;
    setActiveView(pathnameToView(pathname));
  }, [pathname]);

  // Warm the router cache for every sidebar destination.
  useEffect(() => {
    for (const item of NAV_ITEMS) router.prefetch(item.href);
    router.prefetch('/client/dashboard');
  }, [router]);

  // Navigate: update view state + push URL (no full page load)
  const navigate = useCallback(
    (key: ViewKey) => {
      const item = NAV_ITEMS.find((n) => n.key === key);
      const href = item?.href ?? '/client/dashboard';
      setActiveView(key);
      pendingPathRef.current = href;
      router.push(href, { scroll: false });
      setMobileMenuOpen(false);
    },
    [router]
  );

  const navigateToDashboard = useCallback(() => {
    setActiveView('dashboard');
    pendingPathRef.current = '/client/dashboard';
    router.push('/client/dashboard', { scroll: false });
  }, [router]);

  const handleNotificationClick = useCallback(
    (n: LiveResources['notifications'][number]) => {
      if (n.type === 'meeting_starting' || n.type === 'new_message') {
        const thread = n.metadata?.threadId;
        router.push(thread ? `/client/messages?thread=${thread}` : '/client/messages', { scroll: false });
      } else if (n.type?.includes('consultation')) navigate('consultations');
    },
    [router, navigate]
  );

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const settingsActive = pathname === '/client/settings' || pathname.startsWith('/client/settings/');

  const firstName = user.fullName.trim().split(' ')[0] || user.fullName;

  // ─── Views ─────────────────────────────────────────────────────────────────
  // Tabs that stay mounted once opened (instant switching, live-refreshed).
  const keepAliveViews: Record<string, () => React.ReactNode> = {
    dashboard: () => <DashboardView firstName={firstName} />,
    consultations: () => <ConsultationsView onNavigate={navigate} />,
    messages: () => <MessagesView />,
    cases: () => <DocumentsView role="client" />,
  };
  const keepAliveKey = activeView in keepAliveViews ? activeView : null;

  // URL-driven views (search filters, ?q=…) and route pages are rendered fresh.
  function renderRouteView() {
    switch (activeView) {
      case 'ai-assistant':
        return <AIAssistantChat userFirstName={firstName} />;
      case 'lawyers':
        if (pathname.startsWith('/client/lawyers/') && pathname !== '/client/lawyers' && children) {
          return children;
        }
        return <FindLawyerView isLoggedIn={true} userId={user.id} />;
      default:
        return children ?? <DashboardView firstName={firstName} />;
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
    <div className="flex flex-col h-screen bg-[#E5D8CB] text-[#34150F] selection:bg-[#C58B3C]/30">

      {/* ─── Top Navigation Bar ──────────────────────────────────────────────── */}
      <ClientTopbar
        user={user}
        homeActive={activeView === 'dashboard'}
        settingsActive={settingsActive}
        notifications={liveNotifs}
        onHome={navigateToDashboard}
        onSettings={() => router.push('/client/settings')}
        onProfile={() => router.push('/client/profile')}
        onNotificationClick={handleNotificationClick}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((open) => !open)}
      />

      {/* ─── Body: Sidebar + Content ─────────────────────────────────────────── */}
      {/*
        min-h-0 is CRITICAL here: without it flex children can exceed the parent's
        height and break scroll containment (the sidebar would grow infinitely).
      */}
      <div className="flex flex-row flex-1 min-h-0 relative">

        {/* ── Sidebar (desktop column + mobile drawer) ─────────────────────────── */}
        <ClientSidebar
          items={NAV_ITEMS}
          activeKey={settingsActive ? null : activeView}
          settingsActive={settingsActive}
          onSelect={(key) => navigate(key as ViewKey)}
          onSettings={() => router.push('/client/settings')}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={closeMobileMenu}
        />

        {/* ── Main Content Viewport (ONLY scrollable zone) ─────────────────────── */}
        <main
          className="flex-1 overflow-y-auto bg-[#E5D8CB]"
          id="client-main-content"
        >
          <KeepAliveViews
            activeKey={keepAliveKey}
            views={keepAliveViews}
            fallback={renderRouteView()}
            fallbackKey={`${activeView}:${pathname}`}
            scrollContainerId="client-main-content"
          />
        </main>
      </div>
    </div>
  );
}
