/**
 * Admin Earnings (platform fees): shared types and pure helpers (no React, browser + server safe).
 * The chart and month picker are the lawyer Earnings parts, fed through `chartData`.
 */
import type { LawyerEarningsData } from '@/app/actions/consultationActions';

export interface AdminEarningsTransaction {
  /** Ledger row id (or "booking-<consultation id>" for a paid booking without a ledger row). */
  id: string;
  consultationId: string;
  clientName: string;
  lawyerName: string;
  /** MM/DD/YYYY of the session (Manila). */
  sessionDate: string;
  /** MM/DD/YYYY the payment was confirmed (Manila). */
  paidDate: string;
  paidYear: number;
  /** 0-based month (Manila) the payment was confirmed. */
  paidMonth: number;
  paidMs: number;
  /** What the client paid: session fee + platform fee. */
  gross: number;
  platformFee: number;
  lawyerNet: number;
  /** refunded: a paid booking that was cancelled (no fee earned). */
  status: 'paid' | 'refunded';
  payoutStatus: string;
}

export interface AdminEarningsData {
  year: number;
  currentMonth: number;
  /** Platform fees per month of `year` (paid transactions, by the month they were confirmed). */
  monthlyFees: number[];
  /** What clients paid per month (session fee + platform fee). */
  monthlyGross: number[];
  /** Paid transactions per month. */
  monthlyTransactions: number[];
  /** Fees of December last year (January comparison). */
  previousDecemberFees: number;
  refundedCount: number;
  refundedFees: number;
  /** Lawyers' share of paid transactions whose payout is still pending. */
  owedToLawyers: number;
  /** Current platform fee per consultation (platform_settings.platform_fee_php). */
  platformFeeSetting: number;
  /** Transactions confirmed in `year`, newest first (paid and refunded). */
  transactions: AdminEarningsTransaction[];
}

/** The lawyer chart parts read year, currentMonth and the two monthly series. */
export function chartData(data: AdminEarningsData): LawyerEarningsData {
  return {
    year: data.year,
    currentMonth: data.currentMonth,
    monthlyEarnings: data.monthlyFees,
    previousDecemberEarnings: data.previousDecemberFees,
    monthlyConsultations: data.monthlyTransactions,
    todayScheduled: 0,
    pendingRequests: 0,
    pendingClients: 0,
    completedSessions: 0,
    reviewCount: 0,
    responseRate: null,
    transactions: [],
    inquiries: [],
  };
}

// ─── Transactions table ───────────────────────────────────────────────────────

export type EarningsTab = 'all' | 'paid' | 'refunded';
export type EarningsSort = 'newest' | 'oldest' | 'fee' | 'amount';

export const EARNINGS_TABS: Array<{ key: EarningsTab; label: string; heading: string; empty: string; hint: string }> = [
  { key: 'all', label: 'All Transactions', heading: 'All Transactions', empty: 'No transactions yet this year', hint: 'Payments appear here once a lawyer confirms them.' },
  { key: 'paid', label: 'Paid', heading: 'Paid Transactions', empty: 'No paid transactions yet', hint: 'Each confirmed payment earns the platform fee.' },
  { key: 'refunded', label: 'Refunded', heading: 'Refunded Transactions', empty: 'No refunds this year', hint: 'Paid consultations that were cancelled are refunded and earn no fee.' },
];

export const EARNINGS_SORTS: Array<{ key: EarningsSort; label: string }> = [
  { key: 'newest', label: 'Date paid: newest' },
  { key: 'oldest', label: 'Date paid: oldest' },
  { key: 'fee', label: 'Platform fee: highest' },
  { key: 'amount', label: 'Amount paid: highest' },
];

export const matchesEarningsTab = (t: AdminEarningsTransaction, tab: EarningsTab) => tab === 'all' || t.status === tab;

/** Transactions for a tab, client / attorney search and sort order. */
export function visibleTransactions(all: readonly AdminEarningsTransaction[], tab: EarningsTab, query: string, sort: EarningsSort): AdminEarningsTransaction[] {
  const q = query.trim().toLowerCase();
  const list = all.filter(
    (t) => matchesEarningsTab(t, tab) && (!q || t.clientName.toLowerCase().includes(q) || t.lawyerName.toLowerCase().includes(q))
  );
  const by: Record<EarningsSort, (a: AdminEarningsTransaction, b: AdminEarningsTransaction) => number> = {
    newest: (a, b) => b.paidMs - a.paidMs,
    oldest: (a, b) => a.paidMs - b.paidMs,
    fee: (a, b) => b.platformFee - a.platformFee || b.paidMs - a.paidMs,
    amount: (a, b) => b.gross - a.gross || b.paidMs - a.paidMs,
  };
  return [...list].sort(by[sort]);
}

// ─── Exports (CSV and a printable page) ──────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sum = (values: readonly number[]) => values.reduce((total, n) => total + n, 0);
const peso = (n: number) => `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const STATUS_LABEL: Record<AdminEarningsTransaction['status'], string> = { paid: 'Paid', refunded: 'Refunded' };

export function buildAdminEarningsCsv(data: AdminEarningsData): string {
  const lines = [
    `Justicia Platform Earnings,${data.year}`,
    '',
    'Monthly Summary',
    'Month,Paid Consultations,Amount Paid by Clients (PHP),Platform Fees (PHP)',
    ...MONTHS.map((m, i) => [m, data.monthlyTransactions[i], data.monthlyGross[i].toFixed(2), data.monthlyFees[i].toFixed(2)].map(csvCell).join(',')),
    ['Total', sum(data.monthlyTransactions), sum(data.monthlyGross).toFixed(2), sum(data.monthlyFees).toFixed(2)].map(csvCell).join(','),
    '',
    'Transactions',
    'Date Paid,Client,Attorney,Session Date,Amount Paid (PHP),Platform Fee (PHP),Lawyer Share (PHP),Status',
    ...data.transactions.map((t) =>
      [t.paidDate, t.clientName, t.lawyerName, t.sessionDate, t.gross.toFixed(2), t.platformFee.toFixed(2), t.lawyerNet.toFixed(2), STATUS_LABEL[t.status]]
        .map(csvCell)
        .join(',')
    ),
  ];
  return '﻿' + lines.join('\r\n');
}

export function buildAdminEarningsHtml(data: AdminEarningsData, generated: string): string {
  const monthRows = MONTHS.map(
    (m, i) =>
      `<tr><td>${m}</td><td class="num">${data.monthlyTransactions[i]}</td><td class="num">${escapeHtml(peso(data.monthlyGross[i]))}</td><td class="num">${escapeHtml(peso(data.monthlyFees[i]))}</td></tr>`
  ).join('');
  const rows = data.transactions.length
    ? data.transactions
        .map(
          (t) =>
            `<tr><td>${escapeHtml(t.paidDate)}</td><td>${escapeHtml(t.clientName)}</td><td>${escapeHtml(t.lawyerName)}</td><td>${escapeHtml(t.sessionDate)}</td><td class="num">${escapeHtml(peso(t.gross))}</td><td class="num">${escapeHtml(peso(t.platformFee))}</td><td>${STATUS_LABEL[t.status]}</td></tr>`
        )
        .join('')
    : '<tr><td colspan="7" class="empty">No transactions yet this year.</td></tr>';
  return `<!doctype html><html><head><meta charset="utf-8"><title>justicia-platform-earnings-${data.year}</title>
<style>
  body{font-family:Georgia,serif;color:#341512;margin:32px;}
  h1{font-size:22px;margin:0 0 4px;} p{margin:0 0 20px;font-size:12px;color:#5b3b36;}
  h2{font-size:15px;margin:24px 0 8px;}
  table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;}
  th,td{border-bottom:1px solid #d9c8b8;padding:6px 8px;text-align:left;}
  th{background:#e5d8cb;} .num{text-align:right;} .empty{text-align:center;color:#8c7a6b;}
  tfoot td{font-weight:700;}
  @media print{body{margin:12mm;}}
</style></head><body>
<h1>Platform Earnings — ${data.year}</h1>
<p>Generated ${escapeHtml(generated)}. Platform fees are the convenience fee on each consultation payment a lawyer confirmed; refunded payments earn no fee.</p>
<h2>Monthly Summary</h2>
<table><thead><tr><th>Month</th><th class="num">Paid Consultations</th><th class="num">Amount Paid</th><th class="num">Platform Fees</th></tr></thead>
<tbody>${monthRows}</tbody>
<tfoot><tr><td>Total</td><td class="num">${sum(data.monthlyTransactions)}</td><td class="num">${escapeHtml(peso(sum(data.monthlyGross)))}</td><td class="num">${escapeHtml(peso(sum(data.monthlyFees)))}</td></tr></tfoot></table>
<h2>Transactions</h2>
<table><thead><tr><th>Date Paid</th><th>Client</th><th>Attorney</th><th>Session</th><th class="num">Amount Paid</th><th class="num">Platform Fee</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}
