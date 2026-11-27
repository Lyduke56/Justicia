'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KeepAliveViews, ROUTE_SLOT } from '@/components/live/KeepAliveViews';
import { useLiveRefresh } from '@/components/live/LiveProvider';
import { fetchLive, type LiveResources } from '@/lib/live/fetchLive';
import { useRouter, usePathname } from 'next/navigation';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useMyAvatarSync } from '@/components/account/avatarStore';
import { ScreenTransitionOverlay, useScreenGate } from '@/components/shared/loading';
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

/** Tabs kept mounted once opened (see keepAliveViews below). */
const KEEP_ALIVE_KEYS: ViewKey[] = ['dashboard', 'consultations', 'messages', 'cases'];

// ─── Component ────────────────────────────────────────────────────────────────
export function ClientShell({ user, children }: ClientShellProps) {
  useInactivityLogout();
  useMyAvatarSync(user.avatarUrl);

  const router   = useRouter();
  const pathname = usePathname();

  // Initialise view from current URL so hard-refresh works correctly
  const [activeView, setActiveView] = useState<ViewKey>(() => pathnameToView(pathname));
  // The loading screen covers the content area until the screen has everything it needs; the
  // screen's entrance plays once it lifts. Kept-alive tabs and the route page are its slots.
  const activeSlot = KEEP_ALIVE_KEYS.includes(activeView) ? activeView : ROUTE_SLOT;
  const { covered: screenLoading, start: startScreenTransition, store: screenStore, revealFor } = useScreenGate(pathname, activeSlot);
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
      startScreenTransition(href);
      setActiveView(key);
      pendingPathRef.current = href;
      router.push(href, { scroll: false });
      setMobileMenuOpen(false);
    },
    [router, startScreenTransition]
  );

  const navigateToDashboard = useCallback(() => {
    startScreenTransition('/client/dashboard');
    setActiveView('dashboard');
    pendingPathRef.current = '/client/dashboard';
    router.push('/client/dashboard', { scroll: false });
  }, [router, startScreenTransition]);

  /** Route pages outside the sidebar (settings, profile, a message thread …). */
  const goTo = useCallback(
    (href: string) => {
      startScreenTransition(href);
      router.push(href, { scroll: false });
    },
    [router, startScreenTransition]
  );

  const handleNotificationClick = useCallback(
    (n: LiveResources['notifications'][number]) => {
      if (n.type === 'consultation_call_waiting' && typeof n.metadata?.consultationId === 'string') {
        // The other side is already in the call: go straight to it.
        router.push(`/call/${n.metadata.consultationId}`);
      } else if (n.type === 'meeting_starting' || n.type === 'new_message') {
        const thread = n.metadata?.threadId;
        goTo(thread ? `/client/messages?thread=${thread}` : '/client/messages');
      } else if (n.type?.includes('consultation')) navigate('consultations');
    },
    [goTo, navigate, router]
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
        notifications={liveNotifs}
        onHome={navigateToDashboard}
        onSettings={() => goTo('/client/settings')}
        onProfile={() => goTo('/client/profile')}
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
          onSettings={() => goTo('/client/settings')}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={closeMobileMenu}
        />

        {/* ── Main Content Viewport (ONLY scrollable zone) ─────────────────────── */}
        {/* The wrapper positions the screen-transition loader over the content area only. */}
        <div className="relative flex min-w-0 flex-1" data-screen-loading={screenLoading || undefined}>
          <main
            className="flex-1 min-w-0 overflow-y-auto bg-[#E5D8CB]"
            id="client-main-content"
            aria-busy={screenLoading || undefined}
          >
            <KeepAliveViews
              activeKey={keepAliveKey}
              views={keepAliveViews}
              fallback={renderRouteView()}
              fallbackKey={`${activeView}:${pathname}`}
              scrollContainerId="client-main-content"
              gate={{ store: screenStore, revealFor }}
            />
          </main>
          <ScreenTransitionOverlay show={screenLoading} />
        </div>
      </div>
    </div>
  );
}
