'use client';

import { JusticiaLogo } from '@/components/brand/JusticiaLogo';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { KeepAliveViews, ROUTE_SLOT } from '@/components/live/KeepAliveViews';
import { adminTabViews } from './AdminTabs';
import './admin.css';
import { usePathname } from 'next/navigation';
import { SignOutConfirmModal } from '@/components/shared/SignOutConfirmModal';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useMyAvatar, useMyAvatarSync } from '@/components/account/avatarStore';
import { ProfilePhoto } from '@/components/shared/ProfilePhoto';
import { ScreenTransitionOverlay, useScreenGate } from '@/components/shared/loading';
import { HomeIcon, UserCircleIcon, GearIcon, ShieldCheckIcon, ScaleIcon, UserGroupIcon, DocumentTextIcon, LogoutIcon, FlagIcon, EarningsIcon } from './AdminIcons';

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
  const myAvatar = useMyAvatar(user.avatarUrl);
  const pathname = usePathname();
  // The loading screen covers the content area until the screen has everything it needs; the
  // screen's entrance plays once it lifts. Kept-alive tabs and the route page are its slots.
  const activeSlot = Object.hasOwn(adminTabViews, pathname) ? pathname : ROUTE_SLOT;
  const { covered: screenLoading, start: startScreenTransition, store: screenStore, revealFor } = useScreenGate(pathname, activeSlot);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const openSignOut = () => {
    setAccountOpen(false);
    setMobileOpen(false);
    setSignOutOpen(true);
  };
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen && !accountOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setAccountOpen(false);
        if (accountOpen) accountTrigger.current?.focus();
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileOpen, accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [accountOpen]);

  const navigateTab = (event: { preventDefault: () => void }, href: string) => {
    startScreenTransition(href);
    if (!Object.hasOwn(adminTabViews, href)) return;
    event.preventDefault();
    if (href !== pathname) window.history.pushState(null, '', href);
    setMobileOpen(false);
    setAccountOpen(false);
  };

  const links = (mobile = false) => navigation.map(({ name, href, icon: Icon, active }) => {
    const selected = active(pathname);
    return <Link key={href} href={href} onNavigate={(event) => navigateTab(event, href)} onClick={mobile ? () => setMobileOpen(false) : undefined} aria-current={selected ? 'page' : undefined} className={navClass(selected)}>
      <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-[#9A6A27]' : 'text-[#5C4535]'}`} /><span>{name}</span>
    </Link>;
  });
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/admin-accounts');

  return <div className="admin-portal flex h-dvh flex-col bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30">
    <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-[#352219] bg-[#23150F] px-4 text-[#DED7CB] shadow-md sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-haspopup="dialog" onClick={() => setMobileOpen((open) => !open)} className="rounded-lg p-2 hover:text-[#C58B3C] focus-visible:outline-2 focus-visible:outline-[#C58B3C] md:hidden">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
        </button>
        <Link href="/admin/dashboard" onNavigate={(event) => navigateTab(event, "/admin/dashboard")} className="truncate rounded-sm font-cinzel text-sm tracking-[0.16em] hover:text-[#C58B3C] focus-visible:outline-2 focus-visible:outline-[#C58B3C] sm:text-base"><JusticiaLogo className="inline-block w-32 h-auto align-middle" /> <span className="text-[#C58B3C]">ADMIN</span></Link>
      </div>
      <div ref={accountRef} className="relative">
        <button type="button" ref={accountTrigger} aria-label="Account menu" aria-expanded={accountOpen} aria-controls="admin-account-menu" onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#352219] focus-visible:outline-2 focus-visible:outline-[#C58B3C]">
          <span className="hidden max-w-40 truncate text-xs sm:block">{user.fullName}</span><ProfilePhoto src={myAvatar} className="h-7 w-7 ring-2 ring-[#C58B3C]" fallback={<UserCircleIcon className="h-7 w-7 text-[#C58B3C]" />} />
        </button>
        {accountOpen && <div id="admin-account-menu" className="admin-account-menu absolute right-0 top-full z-50 mt-3 w-60 max-w-[calc(100vw-32px)] p-3 text-xs">
          <div className="border-b border-[#CBB6A1] px-3 py-2"><p className="truncate font-semibold">{user.fullName}</p><p className="truncate text-[#A69584]">{user.email}</p></div>
          <Link href="/admin/profile" onNavigate={() => startScreenTransition('/admin/profile')} onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[#DCC9B5] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><UserCircleIcon className="h-4 w-4 text-[#C58B3C]" />My profile</Link>
          <Link href="/admin/settings" onNavigate={(event) => navigateTab(event, '/admin/settings')} onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[#DCC9B5] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><GearIcon className="h-4 w-4 text-[#C58B3C]" />Settings</Link>
          <div className="border-t border-[#CBB6A1] pt-1"><button type="button" onClick={openSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#DCC9B5] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><LogoutIcon className="h-4 w-4 text-[#C58B3C]" />Sign out</button></div>
        </div>}
      </div>
    </header>
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
