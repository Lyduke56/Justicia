/**
 * Account reports & moderation — shared constants (safe for client and server).
 *
 * Stored in the live schema:
 *  - public.reports            one row per report (reason, evidence_paths, status)
 *  - public.moderation_actions the admin decision on a report (suspension / termination / no_action)
 *  - public.profiles.account_status  active | suspended | terminated
 *  - Supabase Auth ban (banned_until) blocks sign-in and existing sessions while suspended/terminated.
 */

/** Suspensions an account may receive. The next upheld report terminates the account. */
export const MAX_SUSPENSIONS = 3;

/** Suspension lengths an administrator can choose from (days). */
export const SUSPENSION_DAY_OPTIONS = [3, 7, 14, 30] as const;
export type SuspensionDays = (typeof SUSPENSION_DAY_OPTIONS)[number];
export const DEFAULT_SUSPENSION_DAYS: SuspensionDays = 7;

/** public.report_category enum values used by account reports. */
export type ReportCategory = 'misconduct' | 'spam' | 'fee_dispute' | 'other';

export interface ReportReasonOption {
  key: string;
  label: string;
  description: string;
  category: ReportCategory;
}

/** Options shown when reporting someone from Messages. */
export const REPORT_REASONS: readonly ReportReasonOption[] = [
  {
    key: 'harassment',
    label: 'Harassment or abusive language',
    description: 'Threats, insults, discrimination or repeated unwanted contact.',
    category: 'misconduct',
  },
  {
    key: 'unprofessional',
    label: 'Unprofessional or unethical conduct',
    description: 'Behaviour that breaks professional or ethical standards.',
    category: 'misconduct',
  },
  {
    key: 'fraud',
    label: 'Scam, fraud or off-platform payment request',
    description: 'Asking for money outside Justicia, fake receipts or deceptive offers.',
    category: 'misconduct',
  },
  {
    key: 'fee_dispute',
    label: 'Payment or fee dispute',
    description: 'Overcharging, unpaid fees or a refund that was not honoured.',
    category: 'fee_dispute',
  },
  {
    key: 'no_show',
    label: 'Missed or abandoned consultation',
    description: 'Did not attend, or left a confirmed consultation without notice.',
    category: 'misconduct',
  },
  {
    key: 'impersonation',
    label: 'Fake identity or impersonation',
    description: 'Pretending to be someone else or misrepresenting credentials.',
    category: 'misconduct',
  },
  {
    key: 'inappropriate',
    label: 'Inappropriate or explicit content',
    description: 'Sexual, violent or otherwise offensive messages or files.',
    category: 'misconduct',
  },
  {
    key: 'spam',
    label: 'Spam or unsolicited promotion',
    description: 'Advertising, repeated irrelevant messages or links.',
    category: 'spam',
  },
  {
    key: 'other',
    label: 'Something else',
    description: 'Describe the problem in the details below.',
    category: 'other',
  },
];

export const REPORT_DETAILS_MIN = 20;
export const REPORT_DETAILS_MAX = 2000;
export const REPORT_MAX_FILES = 5;
/** Per file. The whole form must stay under next.config serverActions.bodySizeLimit (10 MB). */
export const REPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const REPORT_MAX_TOTAL_BYTES = 8 * 1024 * 1024;
export const REPORT_FILE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'pdf'] as const;
/** A reporter may file at most this many reports per rolling 24 hours. */
export const REPORT_DAILY_LIMIT = 5;

export type AccountStatus = 'active' | 'suspended' | 'terminated' | 'pending_deletion';

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed' | 'appealed';

/** Splits the stored `reports.reason` text back into the chosen option and the details. */
export function parseReportReason(reason: string | null | undefined): { label: string; details: string } {
  const text = (reason ?? '').trim();
  const [first, ...rest] = text.split('\n');
  const option = REPORT_REASONS.find((r) => r.label === first.trim());
  if (option) return { label: option.label, details: rest.join('\n').trim() };
  return { label: 'Other', details: text };
}
