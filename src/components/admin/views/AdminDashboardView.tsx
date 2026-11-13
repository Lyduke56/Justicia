import Link from 'next/link';
import { ShieldCheckIcon, ScaleIcon, UserGroupIcon, DocumentTextIcon } from '@/components/admin/AdminIcons';

type PendingLawyer = { user_id: string; full_name: string; roll_number: string; ibp_chapter: string | null };
type AuditEntry = { id: string; action: string; targetType?: string; timestamp: string };
type Props = {
  pendingLawyersCount: number;
  approvedLawyersCount: number;
  totalUsersCount: number;
  pendingLawyersPreview: PendingLawyer[];
  recentAuditEntries: AuditEntry[];
};

export function AdminDashboardView({ pendingLawyersCount, approvedLawyersCount, totalUsersCount, pendingLawyersPreview, recentAuditEntries }: Props) {
  const stats = [
    { label: 'Awaiting review', value: pendingLawyersCount, note: 'Lawyer applications', href: '/admin/lawyers/verification-queue', icon: ShieldCheckIcon },
    { label: 'Approved lawyers', value: approvedLawyersCount, note: 'Approved profiles', href: '/admin/lawyers', icon: ScaleIcon },
    { label: 'Registered users', value: totalUsersCount, note: 'Across all roles', href: '/admin/users', icon: UserGroupIcon },
  ];

  return (
    <div className="admin-page">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="admin-eyebrow">Administration / Overview</p><h1 className="mt-3">A clear view of Justicia.</h1><p className="admin-description">Review lawyer applications, manage accounts, and keep track of the people behind the platform.</p></div>
        <Link href="/admin/lawyers/verification-queue" className="admin-button admin-button-primary self-start shrink-0"><ShieldCheckIcon className="h-4 w-4" />Review applications</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {stats.map(({ label, value, note, href, icon: Icon }) => (
          <Link key={href} href={href} className="admin-card admin-filter block p-6">
            <div className="flex items-center justify-between gap-4"><h2 className="text-base">{label}</h2><span className="admin-plate admin-icon"><Icon className="h-5 w-5" /></span></div>
            <div className="admin-plate admin-metric-value"><strong>{value.toLocaleString('en-PH')}</strong><span>{note}</span></div>
            <span className="admin-text-link mt-5 flex items-center justify-between">View records <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="admin-card min-w-0 p-6 sm:p-7" aria-labelledby="pending-lawyers-heading">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="admin-eyebrow">Credential review</p><h2 id="pending-lawyers-heading" className="mt-2 text-xl">Applications to review</h2></div><span className="admin-inset px-3 py-2 text-xs">{pendingLawyersCount} pending</span></div>
          {pendingLawyersPreview.length ? <ul className="admin-inset admin-list">
            {pendingLawyersPreview.map((lawyer) => <li key={lawyer.user_id} className="flex items-center justify-between gap-4 py-5">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{lawyer.full_name}</p><p className="mt-1 truncate text-xs text-[#705744]">Roll {lawyer.roll_number}{lawyer.ibp_chapter ? ' · ' + lawyer.ibp_chapter : ''}</p></div>
              <Link href={'/admin/lawyers/' + lawyer.user_id} className="admin-button shrink-0">Review</Link>
            </li>)}
          </ul> : <div className="admin-inset admin-empty"><ShieldCheckIcon className="mx-auto mb-3 h-7 w-7" /><p className="font-semibold">The queue is clear.</p><p className="mt-1">New applications will appear here when submitted.</p></div>}
          <Link href="/admin/lawyers/verification-queue" className="admin-text-link mt-6 inline-flex py-2">Open verification queue <span aria-hidden="true" className="ml-2">→</span></Link>
        </section>
        <section className="admin-card min-w-0 p-6 sm:p-7" aria-labelledby="activity-heading">
          <div className="mb-6 flex items-center gap-4"><span className="admin-plate admin-icon"><DocumentTextIcon className="h-5 w-5" /></span><div><p className="admin-eyebrow">Audit trail</p><h2 id="activity-heading" className="mt-2 text-xl">Recent activity</h2></div></div>
          {recentAuditEntries.length ? <ul className="admin-inset admin-list">
            {recentAuditEntries.map((entry) => <li key={entry.id} className="flex items-start gap-3 py-5">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#9B6B38]" />
              <div className="min-w-0"><p className="text-sm font-medium">{entry.action.replaceAll('_', ' ').replaceAll('.', ' ')}</p><p className="mt-2 text-xs text-[#705744]">{new Date(entry.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
            </li>)}
          </ul> : <div className="admin-inset admin-empty"><p className="font-semibold">No activity recorded yet.</p><p className="mt-1">Recorded administrative actions will appear here.</p></div>}
          <Link href="/admin/settings/security-audit-log" className="admin-text-link mt-6 inline-flex py-2">View audit log <span aria-hidden="true" className="ml-2">→</span></Link>
        </section>
      </div>
    </div>
  );
}
