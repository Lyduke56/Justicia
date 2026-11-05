import Link from 'next/link';
import { UserGroupIcon, DocumentTextIcon, GearIcon } from '@/components/admin/AdminIcons';

const cardClass = 'rounded-3xl border border-[#E8DCCB] bg-[#EFE5D8] p-6 shadow-[6px_6px_16px_rgba(0,0,0,0.06),-6px_-6px_16px_rgba(255,255,255,0.85)]';

export function AdminSettingsView() {
  return <div className="mx-auto max-w-7xl space-y-8 p-6 sm:p-10 lg:p-12">
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#946525]">Administration</p>
      <h1 className="mt-1 font-cormorant text-4xl font-semibold leading-tight sm:text-5xl">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#705C49]">Manage available administration tools and review platform controls.</p>
    </div>

    <div className="grid gap-6 md:grid-cols-2">
      <section className={cardClass} aria-labelledby="account-tools-heading">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><UserGroupIcon className="h-5 w-5" /></span><h2 id="account-tools-heading" className="font-cormorant text-2xl font-bold">Account tools</h2></div>
        <p className="mt-3 text-sm leading-6 text-[#705C49]">Review registered accounts and manage their roles.</p>
        <Link href="/admin/users" className="mt-5 inline-flex rounded-lg text-sm font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">Open user accounts →</Link>
      </section>
      <section className={cardClass} aria-labelledby="audit-tools-heading">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><DocumentTextIcon className="h-5 w-5" /></span><h2 id="audit-tools-heading" className="font-cormorant text-2xl font-bold">Audit log</h2></div>
        <p className="mt-3 text-sm leading-6 text-[#705C49]">Inspect the administrative events currently recorded by the platform.</p>
        <Link href="/admin/settings/security-audit-log" className="mt-5 inline-flex rounded-lg text-sm font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">Open audit log →</Link>
      </section>
    </div>

    <section className={cardClass} aria-labelledby="platform-controls-heading">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]"><GearIcon className="h-5 w-5" /></span><h2 id="platform-controls-heading" className="font-cormorant text-2xl font-bold">Platform controls</h2></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#705C49]">Settings for maintenance mode, security limits, and consultation fees are not connected to the application yet. They will appear here when changes can be saved and enforced.</p>
    </section>
  </div>;
}
