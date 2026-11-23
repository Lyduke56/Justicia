'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAdminReportEvidenceAction, getAdminReportsData, moderateReportAction, type ModerationDecisionInput } from '@/app/actions/reportActions';
import { DEFAULT_SUSPENSION_DAYS, MAX_SUSPENSIONS, SUSPENSION_DAY_OPTIONS } from '@/lib/moderation/constants';
import type { AdminReportEvidence, AdminReportItem } from '@/types/admin';
import { FlagIcon } from '@/components/admin/AdminIcons';

type StatusFilter = 'open' | 'resolved' | 'dismissed' | 'all';
const cardClass = 'admin-surface';
const inputClass = 'admin-field px-3 py-2 text-sm';

const isOpen = (r: AdminReportItem) => r.status === 'open' || r.status === 'under_review';
const matchesFilter = (r: AdminReportItem, f: StatusFilter) =>
  f === 'all' || (f === 'open' ? isOpen(r) : f === 'resolved' ? r.status === 'resolved' : r.status === 'dismissed');

const formatDate = (iso: string) => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

const STATUS_BADGE: Record<AdminReportItem['status'], { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  under_review: { label: 'In review', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  resolved: { label: 'Action taken', className: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  dismissed: { label: 'Dismissed', className: 'bg-stone-100 text-stone-700 border-stone-300' },
  appealed: { label: 'Appealed', className: 'bg-sky-50 text-sky-900 border-sky-300' },
};

const ACCOUNT_BADGE: Record<AdminReportItem['target']['accountStatus'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  suspended: { label: 'Suspended', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  terminated: { label: 'Terminated', className: 'bg-rose-50 text-rose-900 border-rose-300' },
  pending_deletion: { label: 'Pending deletion', className: 'bg-stone-100 text-stone-700 border-stone-300' },
};

const ACTION_LABEL: Record<string, string> = {
  suspension: 'Account suspended',
  termination: 'Account terminated',
  no_action: 'Dismissed — no violation',
  warning: 'Warning issued',
  content_removed: 'Content removed',
};

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>{label}</span>;
}

/** Compact offense meter: one dot per suspension used, then the termination step. */
function OffenseMeter({ count, terminated }: { count: number; terminated: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={terminated ? 'Terminated' : `${count} of ${MAX_SUSPENSIONS} suspensions used`}>
      {Array.from({ length: MAX_SUSPENSIONS }).map((_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < count ? 'bg-[#C58B3C]' : 'bg-[#D8CAAD]'}`} />
      ))}
      <span className={`ml-0.5 h-2.5 w-2.5 rotate-45 ${terminated ? 'bg-rose-700' : 'border border-[#C8B59E]'}`} />
      <span className="ml-1.5 text-xs text-[#705C49]">{terminated ? 'Terminated' : `${count}/${MAX_SUSPENSIONS}`}</span>
    </span>
  );
}

export function AdminReportsView({
  initialReports = [],
  initialSelectedId = null,
  initialFilter = 'open',
}: {
  initialReports?: AdminReportItem[];
  initialSelectedId?: string | null;
  initialFilter?: StatusFilter;
}) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<StatusFilter>(initialFilter);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return reports.filter(
      (r) =>
        matchesFilter(r, filter) &&
        (!term ||
          [r.target.name, r.target.email, r.reporter.name, r.reporter.email, r.reasonLabel, r.details].some((v) => v.toLowerCase().includes(term)))
    );
  }, [reports, filter, query]);

  const counts = useMemo(
    () => ({
      open: reports.filter(isOpen).length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      dismissed: reports.filter((r) => r.status === 'dismissed').length,
      all: reports.length,
    }),
    [reports]
  );

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      setReports(await getAdminReportsData());
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  const filters: Array<{ key: StatusFilter; label: string }> = [
    { key: 'open', label: 'Needs review' },
    { key: 'resolved', label: 'Action taken' },
    { key: 'dismissed', label: 'Dismissed' },
    { key: 'all', label: 'All reports' },
  ];

  return (
    <div className="admin-page">
      <h1 className="sr-only">Reports</h1>
      <div className="admin-filters">
        {filters.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} className="admin-filter">
            <span className="text-xs font-semibold text-[#705C49]">{f.label}</span>
            <span className="font-inter text-sm font-semibold">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <label htmlFor="report-search" className="sr-only">
            Search reports
          </label>
          <input
            id="report-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reported account, reporter, or reason"
            className="admin-field w-full px-4 py-3"
          />
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="admin-control px-4 py-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#946525] disabled:opacity-60"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <p className="w-full text-xs text-[#705C49]">
          Showing {filtered.length} of {reports.length} loaded reports · each account can be suspended {MAX_SUSPENSIONS} times; the next upheld
          report terminates it.
        </p>
      </div>

      {refreshError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          Could not refresh the reports. The records below are from the previous load.
        </p>
      )}

      <section className={`${cardClass} overflow-hidden`} aria-label="Reports">
        <div className="admin-table-well overflow-x-auto">
          <table className="admin-table w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs text-[#5C4535]">
              <tr>
                <th className="px-5 py-4 font-semibold">Reported account</th>
                <th className="px-5 py-4 font-semibold">Reason</th>
                <th className="px-5 py-4 font-semibold">Reported by</th>
                <th className="px-5 py-4 font-semibold">Offenses</th>
                <th className="px-5 py-4 font-semibold">Submitted</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#F5EDE2]">
                  <td className="px-5 py-4">
                    <span className="block font-semibold">{r.target.name}</span>
                    <span className="block text-xs text-[#7D6855]">{r.target.email}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold capitalize text-[#946525]">{r.target.role}</span>
                      {r.target.accountStatus !== 'active' && <Badge {...ACCOUNT_BADGE[r.target.accountStatus]} />}
                    </span>
                  </td>
                  <td className="max-w-56 px-5 py-4">
                    <span className="block font-medium">{r.reasonLabel}</span>
                    <span className="block truncate text-xs text-[#7D6855]">{r.details}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="block">{r.reporter.name}</span>
                    <span className="text-[11px] capitalize text-[#7D6855]">{r.reporter.role}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <OffenseMeter count={r.target.suspensionCount} terminated={r.target.accountStatus === 'terminated'} />
                    {r.target.openReportCount > 1 && (
                      <span className="mt-1 block text-[11px] text-[#7D6855]">{r.target.openReportCount} open reports</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-[#705C49]">{formatDate(r.createdAt)}</td>
                  <td className="px-5 py-4">
                    <Badge {...STATUS_BADGE[r.status]} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="admin-control px-2 py-1 text-xs font-semibold text-[#946525] hover:text-[#6B4517] focus-visible:outline-2 focus-visible:outline-[#946525]"
                    >
                      {isOpen(r) ? 'Review' : 'Details'}
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-[#7D6855]">
                    {reports.length
                      ? filter === 'open' && !query
                        ? 'No reports need review right now.'
                        : 'No reports match your filters.'
                      : 'No accounts have been reported yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <ReportDrawer
          key={selected.id}
          report={selected}
          onClose={() => setSelectedId(null)}
          onDecided={async (updated) => {
            if (updated) setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            // Account standing and other reports of the same account may have changed too.
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function ReportDrawer({
  report,
  onClose,
  onDecided,
}: {
  report: AdminReportItem;
  onClose: () => void;
  onDecided: (updated: AdminReportItem | null) => Promise<void>;
}) {
  const [evidence, setEvidence] = useState<AdminReportEvidence | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [decision, setDecision] = useState<ModerationDecisionInput>('suspend');
  const [days, setDays] = useState<number>(DEFAULT_SUSPENSION_DAYS);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const open = isOpen(report);
  const target = report.target;
  const terminated = target.accountStatus === 'terminated';
  const limitReached = target.suspensionCount >= MAX_SUSPENSIONS;
  const escalates = decision === 'suspend' && limitReached;

  useEffect(() => {
    let cancelled = false;
    getAdminReportEvidenceAction(report.id)
      .then((res) => {
        if (cancelled) return;
        if ('evidence' in res && res.evidence) setEvidence(res.evidence);
        else setEvidenceError(('error' in res && res.error) || 'The evidence could not be loaded.');
      })
      .catch(() => !cancelled && setEvidenceError('The evidence could not be loaded.'));
    return () => {
      cancelled = true;
    };
  }, [report.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async () => {
    const verb =
      decision === 'dismiss'
        ? 'Dismiss this report? No action will be taken on the account.'
        : decision === 'terminate' || escalates
          ? `Permanently terminate ${target.name}'s account? They will be signed out, blocked from signing in, and their active consultations will be cancelled.`
          : `Suspend ${target.name} for ${days} days? This will be suspension ${target.suspensionCount + 1} of ${MAX_SUSPENSIONS}. They will be signed out and consultations during the suspension will be cancelled.`;
    if (!window.confirm(verb)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await moderateReportAction(report.id, decision, { days, notes });
      if (!('success' in res) || !res.success) {
        setMessage({ tone: 'error', text: ('error' in res && res.error) || 'The decision could not be saved.' });
        return;
      }
      setMessage({
        tone: 'ok',
        text:
          res.outcome === 'dismissed'
            ? 'Report dismissed. The reporter was notified.'
            : res.outcome === 'suspended'
              ? `Account suspended until ${res.suspendedUntil ? formatDate(res.suspendedUntil) : 'the selected date'}. Both parties were notified.`
              : res.escalated
                ? `Suspension limit reached — the account was terminated. Other open reports about ${target.name} were closed.`
                : `Account terminated. Other open reports about ${target.name} were closed.`,
      });
      await onDecided(res.report);
    } catch {
      setMessage({ tone: 'error', text: 'The decision could not be saved. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const checklist = [
    ...Array.from({ length: MAX_SUSPENSIONS }).map((_, i) => ({
      label: `${['1st', '2nd', '3rd', '4th', '5th'][i] ?? `${i + 1}th`} offense — suspension`,
      done: i < target.suspensionCount,
    })),
    { label: `${['1st', '2nd', '3rd', '4th', '5th', '6th'][MAX_SUSPENSIONS] ?? `${MAX_SUSPENSIONS + 1}th`} offense — automatic termination`, done: terminated },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close report details" onClick={() => !busy && onClose()} className="absolute inset-0 w-full bg-black/55" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-report-title"
        className="admin-drawer relative z-10 flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-[#D8CAAD] bg-[#EFE5D8] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#D8CAAD] pb-5">
          <div className="min-w-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E5D7C5] text-[#946525]">
              <FlagIcon className="h-5 w-5" />
            </span>
            <h2 id="admin-report-title" className="mt-3 font-lora text-lg font-semibold">
              Report about {target.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#705C49]">
              <Badge {...STATUS_BADGE[report.status]} />
              <span>Submitted {formatDate(report.createdAt)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close report details"
            className="admin-control p-2 focus-visible:outline-2 focus-visible:outline-[#946525]"
          >
            ×
          </button>
        </div>

        {message && (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={`mt-5 rounded-xl border p-3 text-sm ${message.tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}
          >
            {message.text}
          </p>
        )}

        {/* Reported account & offense checklist */}
        <section className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#946525]">Reported account</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-[#7D6855]">Name</dt>
                <dd className="font-medium">{target.name}</dd>
              </div>
              <div>
                <dt className="text-[#7D6855]">Email</dt>
                <dd className="break-all font-medium">{target.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#7D6855]">Role</dt>
                <dd className="font-medium capitalize">{target.role}</dd>
              </div>
              <div>
                <dt className="text-[#7D6855]">Account status</dt>
                <dd className="flex flex-wrap items-center gap-2 font-medium">
                  <Badge {...ACCOUNT_BADGE[target.accountStatus]} />
                  {target.suspendedUntil && <span className="text-xs text-[#705C49]">until {formatDate(target.suspendedUntil)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[#7D6855]">Reports about this account</dt>
                <dd className="font-medium">
                  {target.totalReportCount} total · {target.openReportCount} open
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#946525]">Offense checklist</h3>
            <ul className="mt-3 space-y-2 text-sm" aria-label="Offense checklist">
              {checklist.map((item, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold ${
                      item.done
                        ? i === checklist.length - 1
                          ? 'border-rose-700 bg-rose-700 text-white'
                          : 'border-[#C58B3C] bg-[#C58B3C] text-white'
                        : 'border-[#C8B59E] bg-[#F5EDE2]'
                    }`}
                  >
                    {item.done ? '✓' : ''}
                  </span>
                  <span className={item.done ? 'font-medium' : 'text-[#705C49]'}>
                    {item.label}
                    <span className="sr-only">{item.done ? ' (recorded)' : ' (not reached)'}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[#7D6855]">
              {terminated
                ? 'This account is terminated.'
                : limitReached
                  ? `All ${MAX_SUSPENSIONS} suspensions have been used. Upholding this report terminates the account.`
                  : `${MAX_SUSPENSIONS - target.suspensionCount} suspension${MAX_SUSPENSIONS - target.suspensionCount === 1 ? '' : 's'} left before termination.`}
            </p>
          </div>
        </section>

        {/* The report */}
        <section className="mt-7 space-y-3 border-t border-[#D8CAAD] pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#946525]">Reason</h3>
          <p className="font-semibold">{report.reasonLabel}</p>
          <p className="whitespace-pre-line rounded-xl bg-[#F5EDE2] p-4 text-sm leading-relaxed">{report.details || 'No details were provided.'}</p>
          <p className="text-xs text-[#705C49]">
            Reported by <span className="font-semibold">{report.reporter.name}</span>
            {report.reporter.email && <> ({report.reporter.email})</>} · <span className="capitalize">{report.reporter.role}</span>
          </p>
        </section>

        {/* Evidence */}
        <section className="mt-7 space-y-3 border-t border-[#D8CAAD] pt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#946525]">Proof</h3>
          {evidenceError && <p className="text-sm text-rose-800">{evidenceError}</p>}
          {!evidence && !evidenceError && <p className="text-sm text-[#7D6855]">Loading evidence…</p>}
          {evidence && evidence.files.length === 0 && !evidence.conversation && (
            <p className="text-sm text-[#7D6855]">No files or conversation were attached to this report.</p>
          )}
          {evidence && evidence.files.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {evidence.files.map((file) => (
                <li key={file.path} className="overflow-hidden rounded-xl border border-[#D8CAAD] bg-[#F5EDE2]">
                  {file.kind === 'image' && file.url ? (
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="block">
                      {/* Signed, short-lived storage URL — next/image would need a remote pattern for it. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.url} alt={file.name} className="h-40 w-full object-cover" />
                    </a>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                    <span className="truncate font-medium">{file.name}</span>
                    {file.url ? (
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-[#946525] hover:text-[#6B4517]">
                        Open
                      </a>
                    ) : (
                      <span className="shrink-0 text-rose-800">Unavailable</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {evidence?.conversation && (
            <div className="rounded-xl border border-[#D8CAAD] bg-[#F5EDE2]">
              <p className="border-b border-[#D8CAAD] px-4 py-2 text-xs font-semibold text-[#5C4535]">
                Conversation captured with the report ({evidence.conversation.length} message{evidence.conversation.length === 1 ? '' : 's'})
              </p>
              <ol className="max-h-80 space-y-2 overflow-y-auto p-4 text-sm">
                {evidence.conversation.map((m) =>
                  m.from === 'system' ? (
                    <li key={m.id} className="text-center text-[11px] text-[#7D6855]">
                      {m.content}
                    </li>
                  ) : (
                    <li key={m.id} className={`flex flex-col ${m.from === 'reported' ? 'items-start' : 'items-end'}`}>
                      <span
                        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 ${
                          m.from === 'reported' ? 'border border-rose-200 bg-white text-[#34150F]' : 'bg-[#34150F] text-[#FAF6F0]'
                        }`}
                      >
                        {m.content}
                      </span>
                      <span className="mt-0.5 text-[10px] text-[#7D6855]">
                        {m.from === 'reported' ? target.name : report.reporter.name} · {formatDate(m.sentAt)}
                      </span>
                    </li>
                  )
                )}
                {evidence.conversation.length === 0 && <li className="text-[#7D6855]">The conversation was empty.</li>}
              </ol>
            </div>
          )}
        </section>

        {/* Decision */}
        {open ? (
          <section className="mt-7 space-y-4 border-t border-[#D8CAAD] pt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#946525]">Decision</h3>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Decision">
              {(
                [
                  { key: 'suspend', label: limitReached ? 'Suspend (terminates)' : 'Suspend', hint: limitReached ? '4th offense' : `${target.suspensionCount + 1} of ${MAX_SUSPENSIONS}` },
                  { key: 'terminate', label: 'Terminate', hint: 'Permanent' },
                  { key: 'dismiss', label: 'Dismiss', hint: 'No violation' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked={decision === opt.key}
                  disabled={busy || (terminated && opt.key !== 'dismiss')}
                  onClick={() => setDecision(opt.key)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ${
                    decision === opt.key ? 'border-[#C58B3C] bg-[#E5D7C5] font-semibold' : 'border-[#D8CAAD] bg-[#F5EDE2] hover:bg-[#E5D7C5]'
                  }`}
                >
                  <span className="block">{opt.label}</span>
                  <span className="block text-[11px] font-normal text-[#7D6855]">{opt.hint}</span>
                </button>
              ))}
            </div>

            {decision === 'suspend' && !limitReached && (
              <div>
                <label htmlFor="suspension-days" className="block text-xs font-semibold text-[#5C4535]">
                  Suspension length
                </label>
                <select
                  id="suspension-days"
                  value={days}
                  disabled={busy}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className={`mt-2 ${inputClass}`}
                >
                  {SUSPENSION_DAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} days
                    </option>
                  ))}
                </select>
                {target.accountStatus === 'suspended' && (
                  <p className="mt-2 text-xs text-[#7D6855]">The account is already suspended; the new suspension starts when the current one ends.</p>
                )}
              </div>
            )}
            {escalates && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {target.name} has already been suspended {target.suspensionCount} times. Upholding this report will permanently terminate the account.
              </p>
            )}

            <div>
              <label htmlFor="moderation-notes" className="block text-xs font-semibold text-[#5C4535]">
                {decision === 'dismiss' ? 'Note for the record' : 'Reason shown to the account owner'}
              </label>
              <textarea
                id="moderation-notes"
                rows={3}
                maxLength={1000}
                value={notes}
                disabled={busy}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  decision === 'dismiss'
                    ? 'e.g. The messages provided do not show a violation of the guidelines.'
                    : 'e.g. Repeated abusive language toward a client in Messages.'
                }
                className={`mt-2 w-full ${inputClass}`}
              />
            </div>

            <button
              type="button"
              disabled={busy || notes.trim().length < 10}
              onClick={submit}
              className={`admin-control w-full px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#946525] disabled:opacity-50 ${
                decision === 'dismiss' ? '' : decision === 'terminate' || escalates ? 'admin-danger' : 'admin-primary'
              }`}
            >
              {busy
                ? 'Saving…'
                : decision === 'dismiss'
                  ? 'Dismiss report'
                  : decision === 'terminate' || escalates
                    ? 'Terminate account'
                    : `Suspend for ${days} days`}
            </button>
            {notes.trim().length > 0 && notes.trim().length < 10 && <p className="text-xs text-rose-800">Please write at least 10 characters.</p>}
          </section>
        ) : (
          report.resolution && (
            <section className="mt-7 space-y-2 border-t border-[#D8CAAD] pt-6 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#946525]">Decision</h3>
              <p className="font-semibold">{ACTION_LABEL[report.resolution.action] ?? report.resolution.action}</p>
              <p className="whitespace-pre-line rounded-xl bg-[#F5EDE2] p-4 leading-relaxed">{report.resolution.notes || '—'}</p>
              <p className="text-xs text-[#705C49]">
                By {report.resolution.adminName}
                {report.resolution.resolvedAt && <> · {formatDate(report.resolution.resolvedAt)}</>}
              </p>
            </section>
          )
        )}
      </aside>
    </div>
  );
}
