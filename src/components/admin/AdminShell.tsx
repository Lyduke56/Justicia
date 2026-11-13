'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { AdminDialog } from './AdminDialog';
import { HomeIcon, UserCircleIcon, GearIcon, ShieldCheckIcon, ScaleIcon, UserGroupIcon, DocumentTextIcon, LogoutIcon } from './AdminIcons';

const navigation = [
  { name: 'Overview', href: '/admin/dashboard', icon: HomeIcon, active: (path: string) => path === '/admin/dashboard' },
  { name: 'Verification queue', href: '/admin/lawyers/verification-queue', icon: ShieldCheckIcon, active: (path: string) => path.startsWith('/admin/lawyers/verification-queue') },
  { name: 'Lawyer directory', href: '/admin/lawyers', icon: ScaleIcon, active: (path: string) => path === '/admin/lawyers' || (path.startsWith('/admin/lawyers/') && !path.startsWith('/admin/lawyers/verification-queue')) },
  { name: 'User accounts', href: '/admin/users', icon: UserGroupIcon, active: (path: string) => path.startsWith('/admin/users') },
  { name: 'Audit log', href: '/admin/settings/security-audit-log', icon: DocumentTextIcon, active: (path: string) => path.startsWith('/admin/settings/security-audit-log') },
];

const navClass = () => 'admin-nav-link';

export function AdminShell({ user, children }: { user: { id: string; email?: string; fullName: string }; children: ReactNode }) {
  useInactivityLogout();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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

  const links = (mobile = false) => navigation.map(({ name, href, icon: Icon, active }) => {
    const selected = active(pathname);
    return <Link key={href} href={href} onClick={mobile ? () => setMobileOpen(false) : undefined} aria-current={selected ? 'page' : undefined} className={navClass()}>
      <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-[#9A6A27]' : 'text-[#5C4535]'}`} /><span>{name}</span>
    </Link>;
  });
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/admin-accounts');

  return <div className="admin-portal flex h-dvh flex-col">
    <a href="#admin-main-content" className="admin-skip-link">Skip to content</a>
    <header className="admin-header z-40 flex h-16 shrink-0 items-center justify-between border-b border-[#352219] bg-[#23150F] px-4 text-[#DED7CB] shadow-md sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-haspopup="dialog" onClick={() => setMobileOpen((open) => !open)} className="rounded-lg p-2 hover:text-[#C58B3C] focus-visible:outline-2 focus-visible:outline-[#C58B3C] md:hidden">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
        </button>
        <Link href="/admin/dashboard" className="truncate rounded-sm font-cinzel text-sm tracking-[0.16em] hover:text-[#C58B3C] focus-visible:outline-2 focus-visible:outline-[#C58B3C] sm:text-base">JUSTICIA <span className="text-[#C58B3C]">ADMIN</span></Link>
      </div>
      <div className="relative">
        <button type="button" aria-label="Account menu" aria-expanded={accountOpen} aria-controls="admin-account-menu" onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#352219] focus-visible:outline-2 focus-visible:outline-[#C58B3C]">
          <span className="hidden max-w-40 truncate text-xs sm:block">{user.fullName}</span><UserCircleIcon className="h-7 w-7 text-[#C58B3C]" />
        </button>
        {accountOpen && <div id="admin-account-menu" className="admin-account-menu absolute right-0 top-full z-50 mt-3 w-60 max-w-[calc(100vw-32px)] p-3 text-xs">
          <div className="border-b border-[#CBB6A1] px-3 py-2"><p className="truncate font-semibold">{user.fullName}</p><p className="truncate text-[#A69584]">{user.email}</p></div>
          <Link href="/admin/settings" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[#DCC9B5] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><GearIcon className="h-4 w-4 text-[#C58B3C]" />Settings</Link>
          <form action={signOutAction} className="border-t border-[#CBB6A1] pt-1"><button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#DCC9B5] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><LogoutIcon className="h-4 w-4 text-[#C58B3C]" />Sign out</button></form>
        </div>}
      </div>
    </header>
    <div className="relative flex min-h-0 flex-1">
      <aside aria-label="Admin navigation" className="admin-sidebar hidden shrink-0 flex-col justify-between overflow-y-auto md:flex">
        <div><p className="admin-sidebar-label">Administration</p><nav aria-label="Main navigation" className="space-y-3">{links()}</nav></div>
        <div className="admin-sidebar-footer space-y-2">
          <Link href="/admin/settings" aria-current={settingsActive ? 'page' : undefined} className={navClass()}><GearIcon className="h-5 w-5 text-[#5C4535]" />Settings</Link>
          <form action={signOutAction}><button type="submit" className={`${navClass()} text-left hover:text-[#99431E]`}><LogoutIcon className="h-5 w-5 text-[#5C4535]" />Sign out</button></form>
        </div>
      </aside>
      <AdminDialog open={mobileOpen} onClose={() => setMobileOpen(false)} labelledBy="admin-navigation-title" variant="navigation">
        <div>
          <div className="mb-6 flex items-center justify-between gap-2 px-2"><h2 id="admin-navigation-title" className="text-base">Administration</h2><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="admin-button admin-icon-button">×</button></div>
          <nav aria-label="Mobile navigation" className="space-y-3">{links(true)}</nav>
        </div>
        <div className="admin-sidebar-footer space-y-2"><Link href="/admin/settings" onClick={() => setMobileOpen(false)} aria-current={settingsActive ? 'page' : undefined} className={navClass()}><GearIcon className="h-5 w-5" />Settings</Link><form action={signOutAction}><button type="submit" className={navClass()}><LogoutIcon className="h-5 w-5" />Sign out</button></form></div>
      </AdminDialog>
      <main id="admin-main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto"><div key={pathname} className="admin-view-enter">{children}</div></main>
    </div>
  </div>;
}

export default AdminShell;
