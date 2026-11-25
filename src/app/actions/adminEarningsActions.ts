'use server';

/**
 * Admin Earnings: the platform (convenience) fee on every consultation transaction. New code only;
 * it reads the same sales ledger the lawyer Earnings & Payouts tab uses (public.payments, written
 * when a lawyer confirms a payment), and counts a paid booking whose ledger row is missing from
 * the booking itself, the way the lawyer tab backfills it. Refunded payments (paid bookings that
 * were cancelled) are listed but earn no fee.
 */
import { guardMessage, requireRole } from '@/lib/auth/guards';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import type { AdminEarningsData, AdminEarningsTransaction } from '@/lib/admin/earnings';

const DEFAULT_PLATFORM_FEE = 50;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

type LedgerRow = {
  id: string;
  consultation_id: string;
  payer_id: string;
  payee_id: string;
  amount: number | string;
  platform_fee: number | string;
  status: 'paid' | 'refunded';
  payout_status: string | null;
  paid_at: string | null;
  created_at: string;
};

type ConsultationRow = {
  id: string;
  client_id: string;
  lawyer_id: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  concern_summary: string | null;
  updated_at: string | null;
  created_at: string;
};

const money = (n: number) => Math.round(n * 100) / 100;
/** "2026-11-25" in Manila. */
const manilaIso = (ms: number) => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10);
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMeta(text: string | null): Record<string, any> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function sessionMinutes(c: ConsultationRow): number {
  if (!c.scheduled_start || !c.scheduled_end) return 60;
  const minutes = (Date.parse(c.scheduled_end) - Date.parse(c.scheduled_start)) / 60000;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
}

export async function getAdminEarningsData(): Promise<{ success: true; data: AdminEarningsData } | { success?: false; error: string }> {
  try {
    const { db } = await requireRole('admin');

    const [ledgerRes, paidRes, feeRes] = await Promise.all([
      db
        .from('payments')
        .select('id, consultation_id, payer_id, payee_id, amount, platform_fee, status, payout_status, paid_at, created_at')
        .in('status', ['paid', 'refunded']),
      db
        .from('consultations')
        .select('id, client_id, lawyer_id, status, scheduled_start, scheduled_end, concern_summary, updated_at, created_at')
        .in('status', ['confirmed', 'completed']),
      db.from('platform_settings').select('value').eq('key', 'platform_fee_php').maybeSingle(),
    ]);
    if (ledgerRes.error) throw new Error(ledgerRes.error.message);
    if (paidRes.error) throw new Error(paidRes.error.message);

    const ledger = (ledgerRes.data ?? []) as LedgerRow[];
    const settingFee = Number(feeRes.data?.value);
    const platformFeeSetting = Number.isFinite(settingFee) && settingFee >= 0 ? settingFee : DEFAULT_PLATFORM_FEE;

    // Bookings referenced by the ledger (any status) plus paid bookings without a ledger row.
    const consultations = new Map<string, ConsultationRow>();
    for (const c of (paidRes.data ?? []) as ConsultationRow[]) consultations.set(c.id, c);
    const missing = [...new Set(ledger.map((p) => p.consultation_id))].filter((id) => !consultations.has(id));
    for (let i = 0; i < missing.length; i += 200) {
      const { data } = await db
        .from('consultations')
        .select('id, client_id, lawyer_id, status, scheduled_start, scheduled_end, concern_summary, updated_at, created_at')
        .in('id', missing.slice(i, i + 200));
      for (const c of (data ?? []) as ConsultationRow[]) consultations.set(c.id, c);
    }

    const inLedger = new Set(ledger.map((p) => p.consultation_id));
    const unlogged = [...consultations.values()].filter((c) => {
      if (inLedger.has(c.id) || (c.status !== 'confirmed' && c.status !== 'completed')) return false;
      const proof = parseMeta(c.concern_summary).paymentProof;
      return !proof || proof.status === 'verified';
    });

    // Names: clients from profiles, attorneys from lawyer_profiles (falling back to profiles).
    const people = new Set<string>();
    for (const p of ledger) people.add(p.payer_id).add(p.payee_id);
    for (const c of unlogged) people.add(c.client_id).add(c.lawyer_id);
    const ids = [...people];
    const [profilesRes, lawyersRes] = ids.length
      ? await Promise.all([
          db.from('profiles').select('user_id, full_name, email').in('user_id', ids),
          db.from('lawyer_profiles').select('user_id, full_name, fee_standard_60min').in('user_id', ids),
        ])
      : [{ data: [] }, { data: [] }];
    const profile = new Map(((profilesRes.data ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null }>).map((p) => [p.user_id, p]));
    const lawyer = new Map(
      ((lawyersRes.data ?? []) as Array<{ user_id: string; full_name: string | null; fee_standard_60min: number | string | null }>).map((l) => [l.user_id, l])
    );
    const clientName = (id: string) => profile.get(id)?.full_name?.trim() || profile.get(id)?.email || 'Client';
    const lawyerName = (id: string) => {
      const name = lawyer.get(id)?.full_name?.trim() || profile.get(id)?.full_name?.trim();
      return name ? formatAttorneyName(name) : 'Attorney';
    };

    const sessionDate = (consultationId: string) => {
      const c = consultations.get(consultationId);
      return c?.scheduled_start ? usDate(manilaIso(Date.parse(c.scheduled_start))) : '—';
    };

    const rows: AdminEarningsTransaction[] = [];
    const push = (t: Omit<AdminEarningsTransaction, 'paidDate' | 'paidMonth' | 'paidYear' | 'lawyerNet'>) => {
      const iso = manilaIso(t.paidMs);
      rows.push({
        ...t,
        paidDate: usDate(iso),
        paidYear: Number(iso.slice(0, 4)),
        paidMonth: Number(iso.slice(5, 7)) - 1,
        lawyerNet: money(Math.max(0, t.gross - t.platformFee)),
      });
    };

    for (const p of ledger) {
      const paidMs = Date.parse(p.paid_at || p.created_at);
      if (!Number.isFinite(paidMs)) continue;
      push({
        id: p.id,
        consultationId: p.consultation_id,
        clientName: clientName(p.payer_id),
        lawyerName: lawyerName(p.payee_id),
        sessionDate: sessionDate(p.consultation_id),
        paidMs,
        gross: money(Number(p.amount) || 0),
        platformFee: money(Number(p.platform_fee) || 0),
        status: p.status,
        payoutStatus: p.payout_status || 'pending',
      });
    }

    for (const c of unlogged) {
      const meta = parseMeta(c.concern_summary);
      const hourly = Number(meta.fee ?? lawyer.get(c.lawyer_id)?.fee_standard_60min ?? 0) || 0;
      const fee = typeof meta.platformFee === 'number' ? meta.platformFee : platformFeeSetting;
      const paidMs = Date.parse(meta.paymentProof?.reviewedAt || meta.confirmedAt || c.updated_at || c.created_at);
      if (!Number.isFinite(paidMs)) continue;
      push({
        id: `booking-${c.id}`,
        consultationId: c.id,
        clientName: clientName(c.client_id),
        lawyerName: lawyerName(c.lawyer_id),
        sessionDate: sessionDate(c.id),
        paidMs,
        gross: money(hourly * (sessionMinutes(c) / 60) + fee),
        platformFee: money(fee),
        status: 'paid',
        payoutStatus: 'pending',
      });
    }

    // ── Figures for the current Manila year ──
    const today = manilaIso(Date.now());
    const year = Number(today.slice(0, 4));
    const currentMonth = Number(today.slice(5, 7)) - 1;
    const monthlyFees = Array<number>(12).fill(0);
    const monthlyTransactions = Array<number>(12).fill(0);
    const monthlyGross = Array<number>(12).fill(0);
    let previousDecemberFees = 0;
    let refundedCount = 0;
    let refundedFees = 0;
    let owedToLawyers = 0;

    for (const t of rows) {
      if (t.status === 'paid' && t.paidYear === year - 1 && t.paidMonth === 11) previousDecemberFees += t.platformFee;
      if (t.paidYear !== year) continue;
      if (t.status === 'refunded') {
        refundedCount += 1;
        refundedFees += t.platformFee;
        continue;
      }
      monthlyFees[t.paidMonth] += t.platformFee;
      monthlyGross[t.paidMonth] += t.gross;
      monthlyTransactions[t.paidMonth] += 1;
      if (t.payoutStatus === 'pending') owedToLawyers += t.lawyerNet;
    }

    const transactions = rows.filter((t) => t.paidYear === year).sort((a, b) => b.paidMs - a.paidMs);
    return {
      success: true,
      data: {
        year,
        currentMonth,
        monthlyFees: monthlyFees.map(money),
        monthlyGross: monthlyGross.map(money),
        monthlyTransactions,
        previousDecemberFees: money(previousDecemberFees),
        refundedCount,
        refundedFees: money(refundedFees),
        owedToLawyers: money(owedToLawyers),
        platformFeeSetting,
        transactions,
      },
    };
  } catch (err) {
    console.error('[getAdminEarningsData]', err);
    return { error: guardMessage(err, 'The earnings could not be loaded. Please try again.') };
  }
}
