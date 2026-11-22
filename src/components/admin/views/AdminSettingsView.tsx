import Link from 'next/link';
import { UserGroupIcon, DocumentTextIcon, GearIcon } from '@/components/admin/AdminIcons';
import { getPersonalAccountAction } from '@/app/actions/accountActions';
import { AccountSettings } from '@/components/account/AccountSettings';

const cardClass = 'admin-surface p-6';

export async function AdminSettingsView() {
  const account = await getPersonalAccountAction();
  return <div className="admin-page">
    <h1 className="sr-only">Settings</h1>
    {account.success ? <AccountSettings account={account.account} /> : <p role="alert" className="text-sm text-red-700">{account.error}</p>}

    <div className="grid gap-6 md:grid-cols-2">
      <section className={cardClass} aria-labelledby="account-tools-heading">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center admin-icon-well rounded-xl"><UserGroupIcon className="h-5 w-5" /></span><h2 id="account-tools-heading" className="admin-section-title">Account tools</h2></div>
        <p className="mt-3 text-sm leading-6 text-[#705C49]">Review registered accounts and manage their roles.</p>
        <Link href="/admin/users" className="admin-control mt-5 inline-flex text-sm font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">Open user accounts →</Link>
      </section>
      <section className={cardClass} aria-labelledby="audit-tools-heading">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center admin-icon-well rounded-xl"><DocumentTextIcon className="h-5 w-5" /></span><h2 id="audit-tools-heading" className="admin-section-title">Audit log</h2></div>
        <p className="mt-3 text-sm leading-6 text-[#705C49]">Inspect the administrative events currently recorded by the platform.</p>
        <Link href="/admin/settings/security-audit-log" className="admin-control mt-5 inline-flex text-sm font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525]">Open audit log →</Link>
      </section>
    </div>

    <section className={cardClass} aria-labelledby="platform-controls-heading">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center admin-icon-well rounded-xl"><GearIcon className="h-5 w-5" /></span><h2 id="platform-controls-heading" className="admin-section-title">Platform controls</h2></div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#705C49]">Settings for maintenance mode, security limits, and consultation fees are not connected to the application yet. They will appear here when changes can be saved and enforced.</p>
    </section>
  </div>;
}
