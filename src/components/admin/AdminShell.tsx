'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { HomeIcon, UserCircleIcon, GearIcon, ShieldCheckIcon, ScaleIcon, UserGroupIcon, DocumentTextIcon, LogoutIcon } from './AdminIcons';

const navigation = [
  { name: 'Overview', href: '/admin/dashboard', icon: HomeIcon, active: (path: string) => path === '/admin/dashboard' },
  { name: 'Verification queue', href: '/admin/lawyers/verification-queue', icon: ShieldCheckIcon, active: (path: string) => path.startsWith('/admin/lawyers/verification-queue') },
  { name: 'Lawyer directory', href: '/admin/lawyers', icon: ScaleIcon, active: (path: string) => path === '/admin/lawyers' || (path.startsWith('/admin/lawyers/') && !path.startsWith('/admin/lawyers/verification-queue')) },
  { name: 'User accounts', href: '/admin/users', icon: UserGroupIcon, active: (path: string) => path.startsWith('/admin/users') },
  { name: 'Audit log', href: '/admin/settings/security-audit-log', icon: DocumentTextIcon, active: (path: string) => path.startsWith('/admin/settings/security-audit-log') },
];

const navClass = (active: boolean) => `flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A6A27] ${active ? 'bg-[#D4C1AB] font-semibold text-[#34150F] shadow-[inset_2px_2px_4px_rgba(0,0,0,0.12),inset_-2px_-2px_4px_rgba(255,255,255,0.65)]' : 'text-[#3E2A1E] hover:bg-[#E5D7C5]'}`;

export function AdminShell({ user, children }: { user: { id: string; email?: string; fullName: string }; children: ReactNode }) {
  useInactivityLogout();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen && !accountOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [mobileOpen, accountOpen]);

  const links = (mobile = false) => navigation.map(({ name, href, icon: Icon, active }) => {
    const selected = active(pathname);
    return <Link key={href} href={href} onClick={mobile ? () => setMobileOpen(false) : undefined} aria-current={selected ? 'page' : undefined} className={navClass(selected)}>
      <Icon className={`h-5 w-5 shrink-0 ${selected ? 'text-[#9A6A27]' : 'text-[#5C4535]'}`} /><span>{name}</span>
    </Link>;
  });
  const settingsActive = pathname === '/admin/settings' || pathname.startsWith('/admin/settings/admin-accounts');

  return <div className="flex h-dvh flex-col bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30">
    <header className="z-40 flex h-16 shrink-0 items-center justify-between border-b border-[#352219] bg-[#23150F] px-4 text-[#DED7CB] shadow-md sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="admin-mobile-navigation" onClick={() => setMobileOpen((open) => !open)} className="rounded-lg p-2 hover:text-[#C58B3C] focus-visible:outline-2 focus-visible:outline-[#C58B3C] md:hidden">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
        </button>
        <Link href="/admin/dashboard" className="truncate rounded-sm font-cinzel text-sm tracking-[0.16em] hover:text-[#C58B3C] focus-visible:outline-2 focus-visible:outline-[#C58B3C] sm:text-base">JUSTICIA <span className="text-[#C58B3C]">ADMIN</span></Link>
      </div>
      <div className="relative">
        <button type="button" aria-label="Account menu" aria-expanded={accountOpen} aria-controls="admin-account-menu" onClick={() => setAccountOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[#352219] focus-visible:outline-2 focus-visible:outline-[#C58B3C]">
          <span className="hidden max-w-40 truncate text-xs sm:block">{user.fullName}</span><UserCircleIcon className="h-7 w-7 text-[#C58B3C]" />
        </button>
        {accountOpen && <div id="admin-account-menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#493226] bg-[#2A1810] p-2 text-xs shadow-xl">
          <div className="border-b border-[#493226] px-3 py-2"><p className="truncate font-semibold">{user.fullName}</p><p className="truncate text-[#A69584]">{user.email}</p></div>
          <Link href="/admin/settings" onClick={() => setAccountOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[#3E271D] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><GearIcon className="h-4 w-4 text-[#C58B3C]" />Settings</Link>
          <form action={signOutAction} className="border-t border-[#493226] pt-1"><button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#3E271D] focus-visible:outline-2 focus-visible:outline-[#C58B3C]"><LogoutIcon className="h-4 w-4 text-[#C58B3C]" />Sign out</button></form>
        </div>}
      </div>
    </header>
    <div className="relative flex min-h-0 flex-1">
      <aside aria-label="Admin navigation" className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-[#D1BEA8] bg-[#DECEB8] p-5 md:flex">
        <nav aria-label="Main navigation" className="space-y-2">{links()}</nav>
        <div className="space-y-2 border-t border-[#C8B59E] pt-4">
          <Link href="/admin/settings" aria-current={settingsActive ? 'page' : undefined} className={navClass(settingsActive)}><GearIcon className="h-5 w-5 text-[#5C4535]" />Settings</Link>
          <form action={signOutAction}><button type="submit" className={`${navClass(false)} text-left hover:text-[#99431E]`}><LogoutIcon className="h-5 w-5 text-[#5C4535]" />Sign out</button></form>
        </div>
      </aside>
      {mobileOpen && <div id="admin-mobile-navigation" className="fixed inset-0 z-50 md:hidden">
        <button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 w-full bg-black/55" />
        <aside aria-label="Mobile admin navigation" className="relative flex h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto border-r border-[#D1BEA8] bg-[#DECEB8] p-5 shadow-2xl">
          <div><div className="mb-5 flex items-center justify-between border-b border-[#C8B59E] pb-4"><span className="font-cinzel text-sm font-semibold tracking-wider">JUSTICIA ADMIN</span><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 focus-visible:outline-2 focus-visible:outline-[#9A6A27]">×</button></div><nav aria-label="Main navigation" className="space-y-2">{links(true)}</nav></div>
          <div className="space-y-2 border-t border-[#C8B59E] pt-4"><Link href="/admin/settings" onClick={() => setMobileOpen(false)} aria-current={settingsActive ? 'page' : undefined} className={navClass(settingsActive)}><GearIcon className="h-5 w-5 text-[#5C4535]" />Settings</Link><form action={signOutAction}><button type="submit" className={`${navClass(false)} text-left`}><LogoutIcon className="h-5 w-5 text-[#5C4535]" />Sign out</button></form></div>
        </aside>
      </div>}
      <main id="admin-main-content" className="min-w-0 flex-1 overflow-y-auto bg-[#EFE5D8]"><div key={pathname} className="client-view-enter">{children}</div></main>
    </div>
  </div>;
}

export default AdminShell;
