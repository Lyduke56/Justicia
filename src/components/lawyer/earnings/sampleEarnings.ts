import type { EarningsInquiry, EarningsInquiryStatus, EarningsTransaction, LawyerConsultation, LawyerEarningsData } from '@/app/actions/consultationActions';
import { isScheduled, parseIsoDate, todayInManila, toIsoDate } from '@/lib/lawyer/dashboardSchedule';
import { buildSampleConsultations } from '../sampleConsultations';

/**
 * Earnings for the signed-out demo preview, shaped exactly like the live data so the tab runs one
 * code path. This month and last month match the Dashboard's demo KPI (₱84.9k, up 18%).
 */

// Net earnings of the months before last, oldest first (the newest ones are used).
const EARLIER = [52400, 61800, 47200, 58600, 66300, 63100, 70400, 59800, 68700, 64500];
const EARLIER_SESSIONS = [36, 42, 32, 40, 45, 43, 48, 41, 47, 44];
const AREAS = ['Labor & Employment', 'Civil Law', 'Criminal Law', 'Corporate Law', 'Family Law'];
const CLIENTS = ['Clyde Justine Rosal', 'Maria Angela Reyes', 'Rafael Vincent Cruz', 'Elena Sofia Mendoza', 'Christopher John Rubio', 'Benideck Longakit'];
const SESSION_NET = 1450; // ₱1,500 fee less the ₱50 platform fee

function inquiryStatus(c: LawyerConsultation, now: number): EarningsInquiryStatus {
  switch (c.status) {
    case 'pending':
      return 'pendingApproval';
    case 'pending_payment':
    case 'payment_review':
      return 'pendingPayment';
    case 'confirmed':
      return Date.parse(c.scheduledStart ?? '') + 60 * 60_000 < now ? 'completed' : 'upcoming';
    case 'completed':
      return 'completed';
    default:
      return 'cancelled';
  }
}

const us = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

export function buildSampleEarnings(now: number = Date.now()): LawyerEarningsData {
  const today = todayInManila(now);
  const { year, month } = parseIsoDate(today)!;

  const monthlyEarnings = Array<number>(12).fill(0);
  const monthlyConsultations = Array<number>(12).fill(0);
  monthlyEarnings[month] = 84900;
  monthlyConsultations[month] = 58;
  if (month > 0) {
    monthlyEarnings[month - 1] = 71950;
    monthlyConsultations[month - 1] = 50;
  }
  for (let m = month - 2, k = EARLIER.length - 1; m >= 0; m--, k--) {
    monthlyEarnings[m] = EARLIER[k];
    monthlyConsultations[m] = EARLIER_SESSIONS[k];
  }

  // A few payments per month for the exports (newest first).
  const transactions: EarningsTransaction[] = [];
  for (let m = month; m >= 0; m--) {
    for (let i = 0; i < 3; i++) {
      const day = Math.max(1, Math.min(28, 24 - i * 7));
      const iso = toIsoDate(year, m, day);
      transactions.push({
        id: `demo-payment-${m}-${i}`,
        consultationId: `demo-${m}-${i}`,
        clientName: CLIENTS[(m + i) % CLIENTS.length],
        area: AREAS[(m + i) % AREAS.length],
        sessionDate: us(iso),
        paidDate: us(iso),
        paidMonth: m,
        paidMs: Date.UTC(year, m, day),
        gross: 1500,
        platformFee: 50,
        net: SESSION_NET,
        payoutStatus: m === month ? 'pending' : 'released',
      });
    }
  }

  const samples = buildSampleConsultations(now);
  const inquiries: EarningsInquiry[] = samples
    .map((c, i) => {
      const iso = toIsoDate(c.year, c.month, c.day);
      return {
        id: c.id,
        name: c.client.name,
        date: us(iso),
        area: AREAS[i % AREAS.length],
        status: inquiryStatus(c, now),
        startMs: Date.parse(c.scheduledStart ?? '') || 0,
      };
    })
    .sort((a, b) => b.startMs - a.startMs);

  return {
    year,
    currentMonth: month,
    monthlyEarnings,
    previousDecemberEarnings: 61200,
    monthlyConsultations,
    todayScheduled: samples.filter((c) => isScheduled(c) && toIsoDate(c.year, c.month, c.day) === today).length,
    pendingRequests: 13,
    pendingClients: 13,
    completedSessions: 49,
    reviewCount: 124,
    responseRate: 99,
    transactions,
    inquiries,
  };
}
