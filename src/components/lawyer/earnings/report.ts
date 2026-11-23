import type { LawyerEarningsData } from '@/app/actions/consultationActions';
import { MONTHS_FULL, pesoExact, sum } from './model';

/** Earnings report exports: CSV download and a printable page ("Save as PDF"). */

export const PAYOUT_LABELS: Record<string, string> = {
  pending: 'Pending payout',
  released: 'Released',
  failed: 'Payout failed',
  not_applicable: '—',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const reportFileBase = (data: LawyerEarningsData) => `justicia-earnings-${data.year}`;

export function buildEarningsCsv(data: LawyerEarningsData): string {
  const lines: string[] = [
    `Justicia Earnings Report,${data.year}`,
    '',
    'Monthly Summary',
    'Month,Paid Consultations,Net Earnings (PHP)',
    ...MONTHS_FULL.map((month, i) => [month, data.monthlyConsultations[i], data.monthlyEarnings[i].toFixed(2)].map(csvCell).join(',')),
    ['Total', sum(data.monthlyConsultations), sum(data.monthlyEarnings).toFixed(2)].map(csvCell).join(','),
    '',
    'Payments',
    'Date Paid,Client Name,Session Date,Consultation Area,Amount Paid (PHP),Platform Fee (PHP),Net Earnings (PHP),Payout Status',
    ...data.transactions.map((t) =>
      [t.paidDate, t.clientName, t.sessionDate, t.area, t.gross.toFixed(2), t.platformFee.toFixed(2), t.net.toFixed(2), PAYOUT_LABELS[t.payoutStatus] ?? t.payoutStatus]
        .map(csvCell)
        .join(',')
    ),
  ];
  return '﻿' + lines.join('\r\n');
}

export function downloadEarningsCsv(data: LawyerEarningsData) {
  const blob = new Blob([buildEarningsCsv(data)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportFileBase(data)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildEarningsReportHtml(data: LawyerEarningsData, generated: string): string {
  const monthRows = MONTHS_FULL.map(
    (month, i) =>
      `<tr><td>${month}</td><td class="num">${data.monthlyConsultations[i]}</td><td class="num">${escapeHtml(pesoExact(data.monthlyEarnings[i]))}</td></tr>`
  ).join('');
  const paymentRows = data.transactions.length
    ? data.transactions
        .map(
          (t) =>
            `<tr><td>${escapeHtml(t.paidDate)}</td><td>${escapeHtml(t.clientName)}</td><td>${escapeHtml(t.sessionDate)}</td><td>${escapeHtml(t.area)}</td><td class="num">${escapeHtml(pesoExact(t.gross))}</td><td class="num">${escapeHtml(pesoExact(t.platformFee))}</td><td class="num">${escapeHtml(pesoExact(t.net))}</td><td>${escapeHtml(PAYOUT_LABELS[t.payoutStatus] ?? t.payoutStatus)}</td></tr>`
        )
        .join('')
    : `<tr><td colspan="8" class="empty">No confirmed payments yet this year.</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${reportFileBase(data)}</title>
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
<h1>Earnings Report — ${data.year}</h1>
<p>Generated ${escapeHtml(generated)}. Net earnings are payments you confirmed, less the platform fee.</p>
<h2>Monthly Summary</h2>
<table><thead><tr><th>Month</th><th class="num">Paid Consultations</th><th class="num">Net Earnings</th></tr></thead>
<tbody>${monthRows}</tbody>
<tfoot><tr><td>Total</td><td class="num">${sum(data.monthlyConsultations)}</td><td class="num">${escapeHtml(pesoExact(sum(data.monthlyEarnings)))}</td></tr></tfoot></table>
<h2>Payments</h2>
<table><thead><tr><th>Date Paid</th><th>Client</th><th>Session</th><th>Area</th><th class="num">Amount Paid</th><th class="num">Platform Fee</th><th class="num">Net</th><th>Payout</th></tr></thead>
<tbody>${paymentRows}</tbody></table>
</body></html>`;
}

/** Prints the report from a hidden iframe so the browser's "Save as PDF" captures only the report. */
export function printEarningsReport(data: LawyerEarningsData) {
  const generated = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const frameWindow = frame.contentWindow;
  const doc = frame.contentDocument;
  if (!doc || !frameWindow) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(buildEarningsReportHtml(data, generated));
  doc.close();
  frameWindow.focus();
  frameWindow.print();
  setTimeout(() => frame.remove(), 60_000);
}
