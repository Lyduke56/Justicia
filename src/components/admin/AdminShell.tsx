'use client';

import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { KeepAliveViews, ROUTE_SLOT } from '@/components/live/KeepAliveViews';
import { adminTabViews } from './AdminTabs';
import './admin.css';
import { usePathname, useRouter } from 'next/navigation';
import { ClientTopbar } from '@/components/client/ClientTopbar';
import { getAdminNotificationsAction, type AdminNotification } from '@/app/actions/adminNotificationActions';
import { SignOutConfirmModal } from '@/components/shared/SignOutConfirmModal';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useMyAvatarSync } from '@/components/account/avatarStore';
import { ScreenTransitionOverlay, useScreenGate } from '@/components/shared/loading';
import { HomeIcon, GearIcon, ShieldCheckIcon, ScaleIcon, UserGroupIcon, DocumentTextIcon, LogoutIcon, FlagIcon, EarningsIcon } from './AdminIcons';

const navigation = [
  { name: 'Overview', href: '/admin/dashboard', icon: HomeIcon, active: (path: string) => path === '/admin/dashboard' },
  { name: 'Verification queue', href: '/admin/lawyers/verification-queue', icon: ShieldCheckIcon, active: (path: string) => path.startsWith('/admin/lawyers/verification-queue') },
  { name: 'Lawyer directory', href: '/admin/lawyers', icon: ScaleIcon, active: (path: string) => path === '/admin/lawyers' || (path.startsWith('/admin/lawyers/') && !path.startsWith('/admin/lawyers/verification-queue')) },
  { name: 'User accounts', href: '/admin/users', icon: UserGroupIcon, active: (path: string) => path.startsWith('/admin/users') },
  { name: 'Reports', href: '/admin/reports', icon: FlagIcon, active: (path: string) => path.startsWith('/admin/reports') },
  { name: 'Earnings', href: '/admin/earnings', icon: EarningsIcon, active: (path: string) => path.startsWith('/admin/earnings') },
  { name: 'Audit log', href: '/admin/settings/security-audit-log', icon: DocumentTextIcon, active: (path: string) => path.startsWith('/admin/settings/security-audit-log') },
];

const navClass = (active: boolean) => `admin-nav-link flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A6A27] ${active ? 'bg-[#D4C1AB] font-semibold text-[#34150F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.12),inset_-2px_-2px_4px_rgba(255,255,255,0.65)]' : 'text-[#3E2A1E] hover:bg-[#E5D7C5]'}`;

export function AdminShell({ user, children }: { user: { id: string; email?: string; fullName: string; avatarUrl?: string | null }; children: ReactNode }) {
  useInactivityLogout();
  useMyAvatarSync(user.avatarUrl);
  const pathname = usePathname();
  const router = useRouter();
  // The loading screen covers the content area until the screen has everything it needs; the
  // screen's entrance plays once it lifts. Kept-alive tabs and the route page are its slots.
  const activeSlot = Object.hasOwn(adminTabViews, pathname) ? pathname : ROUTE_SLOT;
  const { covered: screenLoading, start: startScreenTransition, store: screenStore, revealFor } = useScreenGate(pathname, activeSlot);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const openSignOut = () => {
    setMobileOpen(false);
    setSignOutOpen(true);
  };

  // ─── Notification bell: reports, lawyer applications and updates, deletion requests ───
  // Built on the server from recent audit events; refreshed every 30 s and when the tab regains focus.
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      getAdminNotificationsAction()
        .then((res) => {
          if (active && res.success) setNotifications(res.notifications);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileOpen]);

  const navigateTab = (event: { preventDefault: () => void }, href: string) => {
    startScreenTransition(href);
    if (!Object.hasOwn(adminTabViews, href)) return;
    event.preventDefault();
    if (href !== pathname) window.history.pushState(null, '', href);
    setMobileOpen(false);
  };

  /** Top bar buttons (home, Settings in the account menu): the same in-place tab switch as the sidebar. */
  const openTab = (href: string) => {
    startScreenTransition(href);
    setMobileOpen(false);
    if (href === pathname) return;
    if (Object.hasOwn(adminTabViews, href)) window.history.pushState(null, '', href);
    else router.push(href);
  };

  /** Opens what a notification is about (tabs switch in place, like the sidebar). */
  const openNotification = (n: AdminNotification) => {
    const href = n.metadata?.href;
    if (!href || href === pathname) return;
    startScreenTransition(href);
    if (Object.hasOwn(adminTabViews, href)) window.history.pushState(null, '', href);
    else router.push(href);
  };

  const links = (mobile = false) => navigation.map(({ name, href, icon: Icon, active }) => {
    const selected = active(pathname);
    return <Link key={href} href={href} onNavigate={(event) => navigateTab(event, href)} onClick={mobile ? () => setMobileOpen(false) : undefined} aria-current={selected ? 'page' : undefined} className={navClass(selected)}>
      <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-[#9A6A27]' : 'text-[#5C4535]'}`} /><span>{name}</span>
    </Link>;
  });
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/admin-accounts');

  return <div className="admin-portal flex h-dvh flex-col bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30">
    {/* Same top bar as the client and lawyer portals. */}
    <ClientTopbar
      user={user}
      seenKey="justicia:admin:notifications-seen-at"
      homeActive={pathname === '/admin/dashboard'}
      notifications={notifications}
      onHome={() => openTab('/admin/dashboard')}
      onSettings={() => openTab('/admin/settings')}
      onProfile={() => openTab('/admin/profile')}
      onNotificationClick={(n) => openNotification(n as AdminNotification)}
      mobileMenuOpen={mobileOpen}
      onToggleMobileMenu={() => setMobileOpen((open) => !open)}
      notificationsEmptyHint="Reports, lawyer applications, document and profile updates, and account deletion requests will appear here."
      settingsLabel="Settings"
      logoTag="ADMIN"
    />
    <div className="relative flex min-h-0 flex-1">
      <aside aria-label="Admin navigation" className="admin-sidebar hidden shrink-0 flex-col justify-between overflow-y-auto md:flex">
        <div><p className="admin-sidebar-label">Administration</p><nav aria-label="Main navigation" className="space-y-2">{links()}</nav></div>
        <div className="admin-sidebar-footer space-y-2">
          <Link href="/admin/settings" onNavigate={(event) => navigateTab(event, "/admin/settings")} aria-current={settingsActive ? 'page' : undefined} className={navClass(settingsActive)}><GearIcon className="h-5 w-5 text-[#5C4535]" />Settings</Link>
          <div><button type="button" onClick={openSignOut} className={`${navClass(false)} text-left hover:text-[#99431E]`}><LogoutIcon className="h-5 w-5 text-[#5C4535]" />Sign out</button></div>
        </div>
      </aside>
      {mobileOpen && <div id="admin-mobile-navigation" className="fixed inset-0 z-50 md:hidden">
        <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 w-full bg-black/55" />
        <aside aria-label="Mobile admin navigation" className="relative flex h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto border-r border-[#D1BEA8] bg-[#DECEB8] p-5 shadow-2xl">
          <div><div className="mb-5 flex items-center justify-between border-b border-[#C8B59E] pb-4"><span className="flex items-center gap-2"><JusticiaLogo className="w-28 h-auto" /> ADMIN</span><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 transition-colors hover:bg-[#D4C1AB] hover:text-[#34150F] focus-visible:outline-2 focus-visible:outline-[#9A6A27]">×</button></div><nav aria-label="Main navigation" className="space-y-2">{links(true)}</nav></div>
          <div className="space-y-2 border-t border-[#C8B59E] pt-4"><Link href="/admin/settings" onNavigate={(event) => navigateTab(event, "/admin/settings")} onClick={() => setMobileOpen(false)} aria-current={settingsActive ? 'page' : undefined} className={navClass(settingsActive)}><GearIcon className="h-5 w-5 text-[#5C4535]" />Settings</Link><div><button type="button" onClick={openSignOut} className={`${navClass(false)} text-left`}><LogoutIcon className="h-5 w-5 text-[#5C4535]" />Sign out</button></div></div>
        </aside>
      </div>}
      {/* The wrapper positions the screen-transition loader over the content area only. */}
      <div className="relative flex min-w-0 flex-1" data-screen-loading={screenLoading || undefined}>
        <main id="admin-main-content" aria-busy={screenLoading || undefined} className="admin-content min-w-0 flex-1 overflow-y-auto bg-[#EFE5D8]"><KeepAliveViews activeKey={Object.hasOwn(adminTabViews, pathname) ? pathname : null} views={adminTabViews} fallback={children} fallbackKey={pathname} scrollContainerId="admin-main-content" gate={{ store: screenStore, revealFor }} /></main>
        <ScreenTransitionOverlay show={screenLoading} background="#EFE5D8" />
      </div>
    </div>
    <SignOutConfirmModal open={signOutOpen} onClose={() => setSignOutOpen(false)} />
  </div>;
}

export default AdminShell;
