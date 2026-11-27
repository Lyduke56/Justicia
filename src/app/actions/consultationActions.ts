'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { emitLive, type LiveScope } from '@/lib/realtime/live';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkAccountAccess } from '@/lib/moderation/accountStatus';
import { accountPreferences } from '@/lib/account/preferences';
import { ensureConsultationReminders } from '@/lib/consultationReminders';
import { writeAuditLog } from '@/lib/notifications';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { FILE_CONTENT_MISMATCH, fileMatchesExtension } from '@/lib/security/fileType';
import { contactPreferenceLine } from '@/lib/account/profileExtras';
import { orderSoonestFirst } from '@/lib/lawyer/dashboardSchedule';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Constants ───────────────────────────────────────────────────────────────
// NOTE: The live Supabase schema (profiles, documents.storage_path,
// consultations.scheduled_start/scheduled_end, document_access_grants, …)
// differs from the generated `Database` type, so the client-booking code below
// talks to Supabase through an untyped client.

/** Private Supabase Storage bucket holding client-uploaded documents. */
const DOCUMENTS_BUCKET = 'case-documents';
/** Marker mime type for "folder" rows in public.documents. */
const FOLDER_MIME = 'application/x-justicia-folder';
const FOLDER_PREFIX = '[Folder] ';
/** Stay under next.config `serverActions.bodySizeLimit` (10mb) incl. multipart overhead. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'txt', 'mp4',
]);
/** Statuses that reserve a lawyer's time slot. */
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed', 'awaiting_client_confirmation'];
const MAX_SHARED_DOCUMENTS = 20;
const MAX_SUBJECT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const LAWYER_SUMMARY_COLUMNS =
  'user_id, full_name, roll_number, ibp_chapter, practice_areas, experience_years, fee_standard_60min, rating_avg, rating_count';
const CONSULTATION_COLUMNS =
  'id, client_id, lawyer_id, scheduled_start, scheduled_end, scheduled_time, method, status, concern_summary, meeting_url, created_at';

// ─── Public types ────────────────────────────────────────────────────────────

export type DocumentFileType = 'pdf' | 'doc' | 'excel' | 'csv' | 'jpg' | 'png' | 'txt' | 'mp4';

export interface DocumentFileItem {
  id: string;
  name: string;
  size: string;
  type: DocumentFileType;
  updatedAt: string;
}

export interface DocumentFolderItem {
  id: string;
  name: string;
  kind?: 'shared' | 'owned';
  isRecentlyCreated?: boolean;
  files: DocumentFileItem[];
}

/** A My Documents file shared with the lawyer as part of a booking. */
export interface SharedDocumentRef {
  documentId: string;
  name: string;
  size: string;
  mimeType: string | null;
}

export interface BookConsultationInput {
  lawyerId: string;
  dateStr: string; // e.g. "November 26, 2026"
  timeSlot: string; // e.g. "2:00 PM - 3:00 PM • PST, GMT+8"
  communicationMode: 'video' | 'audio';
  subject: string;
  description: string;
  /** IDs of rows in public.documents owned by the client (from My Documents). */
  documentIds: string[];
  /**
   * Idempotency key (a UUID made once per booking attempt in the browser). Submitting the same
   * booking twice (double click, retry after a timeout) returns the first booking instead of
   * creating a second one.
   */
  requestId?: string;
}

export type ClientConsultationStatusLabel =
  | 'PENDING CONFIRMATION'
  | 'CONFIRMED APPOINTMENT'
  | 'PENDING PAYMENT'
  | 'PAYMENT UNDER REVIEW'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED';

export interface ClientConsultation {
  id: string;
  rawStatus: string;
  status: ClientConsultationStatusLabel;
  /** Display date, e.g. "TODAY, NOVEMBER 26, 2026". */
  dateStr: string;
  day: number;
  /** 0-based month index. */
  month: number;
  year: number;
  timeSlot: string;
  scheduledStart: string | null;
  communicationMode: 'video' | 'audio';
  lawyerId: string;
  lawyerName: string;
  rollNumber: string;
  ibpChapter: string;
  practiceAreas: string[];
  rating: string;
  experienceYrs: number;
  ratePerHour: number;
  docket: string;
  caseTitle: string;
  caseDescription: string;
  meetingLink: string | null;
  attachedFiles: SharedDocumentRef[];
  /** Guidance shown in the Reminders card for this booking's date. */
  reminders: string[];
  /** Set when the lawyer declined the request. */
  declineReason: string | null;
  /** Set when the booking was cancelled with a reason (e.g. by the lawyer). */
  cancellationReason: string | null;
  /** e.g. "Thursday, October 15, 2026" */
  dateLong: string;
  /** e.g. "10:30 AM - 11:30 AM" */
  timeRange: string;
  /** e.g. "1 hour" */
  durationLabel: string;
  payment: PaymentDetails;
  /** Reschedule request state (confirmed appointments only). */
  reschedule: RescheduleInfo | null;
}

/** Manual (QR) payment state, stored in the consultation's concern_summary JSON. */
export type PaymentState = 'none' | 'submitted' | 'verified' | 'rejected';

export interface PaymentDetails {
  state: PaymentState;
  proofDocumentId: string | null;
  proofFileName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  sessionFee: number;
  platformFee: number;
  total: number;
}

export interface PaymentChannel {
  qrImageUrl: string | null;
  /** e.g. "GCash • Justicia Legal Services • 0917 000 0000" */
  caption: string | null;
}

/** A confirmed appointment's reschedule state, from the viewer's point of view. */
export interface RescheduleInfo {
  /** The open request waiting for an answer, if any. */
  pending: {
    requestedBy: 'client' | 'lawyer';
    /** True when the signed-in viewer sent the request. */
    byMe: boolean;
    requestedAt: string;
    reason: string;
    proposedStart: string;
    /** e.g. "Thursday, November 26, 2026" */
    proposedDateLong: string;
    /** e.g. "2:00 PM - 3:00 PM" */
    proposedTimeRange: string;
    /** e.g. "2:00 PM - 3:00 PM • PST, GMT+8" */
    proposedTimeSlot: string;
  } | null;
  /** The most recent request that was answered (accepted / declined / withdrawn / expired). */
  last: {
    status: 'accepted' | 'declined' | 'withdrawn' | 'expired';
    requestedBy: 'client' | 'lawyer';
    byMe: boolean;
    respondedAt: string;
    responseReason: string | null;
    /** e.g. "Thursday, November 26, 2026 · 2:00 PM - 3:00 PM" */
    proposedLabel: string;
    /** Answered within the last 3 days (worth showing as a notice). */
    recent: boolean;
  } | null;
  acceptedCount: number;
  /** Reschedules still allowed for this booking. */
  remaining: number;
  /** Whether the viewer can send a new request right now. */
  canRequest: boolean;
  /** Why a request is not possible (when canRequest is false and nothing is pending). */
  blockedReason: string | null;
}

export type BookConsultationResult =
  | { success: true; consultation: ClientConsultation; sharedDocumentCount: number; sharingComplete: boolean }
  | { success?: false; error: string };

// ─── Internal helpers: session & profiles ────────────────────────────────────

type Db = SupabaseClient;
type Role = 'client' | 'lawyer' | 'admin';

interface ProfileRow {
  user_id: string;
  email: string;
  full_name: string | null;
  role: Role;
  /** active | suspended | terminated | pending_deletion */
  account_status?: string | null;
}

interface LawyerSummaryRow {
  user_id: string;
  full_name: string;
  roll_number: string | null;
  ibp_chapter: string | null;
  practice_areas: string[] | null;
  experience_years: number | null;
  fee_standard_60min: number | string | null;
  rating_avg: number | string | null;
  rating_count: number | null;
}

interface ConsultationRow {
  id: string;
  client_id: string;
  lawyer_id: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_time: string | null;
  method: 'video' | 'audio';
  status: string;
  concern_summary: string | null;
  meeting_url: string | null;
  created_at: string;
}

async function getDb(): Promise<Db> {
  return (await createServiceClient()) as unknown as Db;
}

async function getAuthUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Most foreign keys in the live schema (consultations.client_id,
 * documents.owner_id, notifications.user_id, document_access_grants.*) point at
 * public.profiles. Older accounts only exist in public.user_accounts, so we
 * backfill a profiles row on demand.
 */
async function ensureProfile(
  db: Db,
  userId: string,
  fallback?: { email?: string | null; fullName?: string | null }
): Promise<ProfileRow | null> {
  const { data: existing } = await db
    .from('profiles')
    .select('user_id, email, full_name, role, account_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing as ProfileRow;

  const { data: account } = await db
    .from('user_accounts')
    .select('email, full_name, phone, role')
    .eq('id', userId)
    .maybeSingle();

  const email = account?.email ?? fallback?.email;
  if (!email) return null;

  const { data: created, error } = await db
    .from('profiles')
    .upsert(
      {
        user_id: userId,
        email,
        full_name: account?.full_name ?? fallback?.fullName ?? '',
        phone: account?.phone ?? null,
        // Never trust client-editable auth metadata for the role.
        role: (account?.role as Role | undefined) ?? 'client',
      },
      { onConflict: 'user_id' }
    )
    .select('user_id, email, full_name, role, account_status')
    .maybeSingle();

  if (error) {
    console.warn('[ensureProfile] could not create profile for', userId, error.message);
    return null;
  }
  return created as ProfileRow;
}

type Session = { db: Db; user: User; profile: ProfileRow };

async function requireSession(): Promise<Session | { error: string }> {
  const user = await getAuthUser();
  if (!user) return { error: 'Your session has expired. Please sign in again to continue.' };

  const db = await getDb();
  const profile = await ensureProfile(db, user.id, {
    email: user.email,
    fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
  });
  if (!profile) {
    return { error: 'We could not load your account profile. Please sign out and sign in again.' };
  }
  // Suspended / terminated accounts are also banned in Auth; this is defence in depth
  // (and lifts a suspension that has already ended).
  const blocked = await checkAccountAccess(db, user.id, profile.account_status ?? 'active');
  if (blocked) return { error: blocked };
  return { db, user, profile };
}

async function notifyUser(
  db: Db,
  userId: string,
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    if (!(await ensureProfile(db, userId))) return;
    const { error } = await db.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: payload,
      metadata: payload,
      channel: 'in_app',
      is_read: false,
    });
    if (error) console.warn('[notifyUser]', type, error.message);
    else signalLive([userId], ['notifications']);
  } catch (err) {
    console.warn('[notifyUser] unexpected', err);
  }
}

// ─── Internal helpers: dates & time slots (Asia/Manila, UTC+8, no DST) ───────

interface CalendarDate {
  year: number;
  monthIndex: number;
  day: number;
}

interface MinuteRange {
  startMinutes: number;
  endMinutes: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function parseDateStr(dateStr: unknown): CalendarDate | null {
  if (typeof dateStr !== 'string') return null;
  const match = dateStr.trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!match) return null;
  const monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (monthIndex < 0) return null;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  return { year, monthIndex, day };
}

function parseIsoDate(iso: string): CalendarDate {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { year: y, monthIndex: m - 1, day: d };
}

function toIsoDate(date: CalendarDate, offsetDays = 0): string {
  const d = new Date(Date.UTC(date.year, date.monthIndex, date.day + offsetDays));
  return d.toISOString().slice(0, 10);
}

function toManilaTimestamp(date: CalendarDate, minutes: number): string {
  return `${toIsoDate(date)}T${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}:00+08:00`;
}

/** Splits a timestamp into its Manila calendar date and minutes-from-midnight. */
function toManilaParts(timestamp: string): { isoDate: string; minutes: number } {
  const shifted = new Date(new Date(timestamp).getTime() + 8 * 60 * 60 * 1000);
  return {
    isoDate: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function parseSlotRange(timeSlot: unknown): MinuteRange | null {
  if (typeof timeSlot !== 'string') return null;
  const matches = [...timeSlot.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (matches.length === 0) return null;
  const toMinutes = (m: RegExpMatchArray) => {
    let hour = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') hour += 12;
    return hour * 60 + (m[2] ? Number(m[2]) : 0);
  };
  const startMinutes = toMinutes(matches[0]);
  const endMinutes = matches[1] ? toMinutes(matches[1]) : startMinutes + 60;
  if (endMinutes <= startMinutes || startMinutes > 23 * 60 + 59) return null;
  return { startMinutes, endMinutes };
}

function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad2(minutes % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

function formatSlotLabel(range: MinuteRange): string {
  return `${formatClock(range.startMinutes)} - ${formatClock(range.endMinutes)} • PST, GMT+8`;
}

function rangesOverlap(a: MinuteRange, b: MinuteRange): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function todayInManila(): string {
  return toManilaParts(new Date().toISOString()).isoDate;
}

// ─── Internal helpers: misc ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMeta(concernSummary: string | null | undefined): Record<string, any> {
  if (!concernSummary) return {};
  try {
    const parsed = JSON.parse(concernSummary);
    return parsed && typeof parsed === 'object' ? parsed : { description: concernSummary };
  } catch {
    return { description: concernSummary };
  }
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function fileTypeFromName(name: string): DocumentFileType {
  switch (fileExtension(name)) {
    case 'doc':
    case 'docx':
      return 'doc';
    case 'xls':
    case 'xlsx':
      return 'excel';
    case 'csv':
      return 'csv';
    case 'png':
      return 'png';
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'txt':
      return 'txt';
    case 'mp4':
      return 'mp4';
    default:
      return 'pdf';
  }
}

function isFolderRow(row: { filename: string; mime_type?: string | null }): boolean {
  return row.mime_type === FOLDER_MIME || row.filename.startsWith(FOLDER_PREFIX);
}

/** Storage layout: `{ownerId}/folders/{folderId}/…` or `{ownerId}/vault/…`. */
function folderIdFromStoragePath(path: string | null): string | null {
  const match = path?.match(/^[^/]+\/folders\/([0-9a-f-]{36})\//i);
  return match ? match[1] : null;
}

function sharedDocsFromMeta(meta: Record<string, unknown>): SharedDocumentRef[] {
  const raw = Array.isArray(meta.attachedFiles) ? meta.attachedFiles : [];
  return raw
    .filter(
      (f): f is SharedDocumentRef =>
        !!f && typeof f === 'object' && typeof (f as SharedDocumentRef).documentId === 'string'
    )
    .map((f) => ({
      documentId: f.documentId,
      name: String(f.name ?? 'Document'),
      size: String(f.size ?? '—'),
      mimeType: f.mimeType ?? null,
    }));
}

// ─── Internal helpers: bookings ──────────────────────────────────────────────

interface ActiveBooking extends MinuteRange {
  id: string;
  label: string;
}

/**
 * Returns active (pending / confirmed) bookings of a lawyer or client on a
 * Manila calendar date. Handles both new rows (scheduled_start) and legacy rows
 * that only stored the slot inside the concern_summary JSON.
 */
async function findActiveBookingsOnDate(
  db: Db,
  column: 'lawyer_id' | 'client_id',
  userId: string,
  date: CalendarDate
): Promise<ActiveBooking[]> {
  const target = toIsoDate(date);
  const { data, error } = await db
    .from('consultations')
    .select('id, scheduled_start, scheduled_end, scheduled_time, concern_summary')
    .eq(column, userId)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .gte('scheduled_time', toIsoDate(date, -1))
    .lte('scheduled_time', toIsoDate(date, 1));

  if (error || !data) {
    if (error) console.warn('[findActiveBookingsOnDate]', error.message);
    return [];
  }

  const bookings: ActiveBooking[] = [];
  for (const row of data as ConsultationRow[]) {
    const meta = parseMeta(row.concern_summary);
    let rowDate: string | null = null;
    let range: MinuteRange | null = null;

    if (row.scheduled_start) {
      const start = toManilaParts(row.scheduled_start);
      rowDate = start.isoDate;
      const end = row.scheduled_end ? toManilaParts(row.scheduled_end).minutes : start.minutes + 60;
      range = { startMinutes: start.minutes, endMinutes: end > start.minutes ? end : start.minutes + 60 };
    } else {
      const legacyDate = parseDateStr(meta.dateStr);
      if (legacyDate) rowDate = toIsoDate(legacyDate);
      range = parseSlotRange(meta.timeSlot);
    }

    if (rowDate !== target || !range) continue;
    bookings.push({
      id: row.id,
      ...range,
      label: typeof meta.timeSlot === 'string' ? meta.timeSlot : formatSlotLabel(range),
    });
  }
  return bookings;
}

/**
 * Blocks the lawyer set on a Manila date (lawyer_unavailability, migration 0008).
 * 'all-day' for whole-day blocks. Returns [] if the table hasn't been created yet.
 */
async function findUnavailabilityOnDate(
  db: Db,
  lawyerId: string,
  date: CalendarDate
): Promise<Array<MinuteRange | 'all-day'>> {
  const { data, error } = await db
    .from('lawyer_unavailability')
    .select('start_minutes, end_minutes')
    .eq('lawyer_id', lawyerId)
    .eq('unavailable_date', toIsoDate(date));
  if (error) {
    if (error.code !== 'PGRST205' && error.code !== '42P01') {
      console.warn('[findUnavailabilityOnDate]', error.message);
    }
    return [];
  }
  return ((data ?? []) as Array<{ start_minutes: number | null; end_minutes: number | null }>).map((r) =>
    r.start_minutes === null || r.end_minutes === null
      ? 'all-day'
      : { startMinutes: r.start_minutes, endMinutes: r.end_minutes }
  );
}

function statusLabel(status: string, paymentState: PaymentState = 'none'): ClientConsultationStatusLabel {
  switch (status) {
    case 'confirmed':
      return 'CONFIRMED APPOINTMENT';
    // Approved by the lawyer; the client still has to pay. The live enum has no
    // dedicated value, so `awaiting_client_confirmation` represents "pending payment".
    case 'awaiting_client_confirmation':
      return paymentState === 'submitted' ? 'PAYMENT UNDER REVIEW' : 'PENDING PAYMENT';
    case 'completed':
      return 'COMPLETED';
    case 'declined':
      return 'DECLINED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'PENDING CONFIRMATION';
  }
}

// ─── Internal helpers: payment ───────────────────────────────────────────────

const DEFAULT_PLATFORM_FEE = 50;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Any Google Meet link: must start with https://meet.google.com; whatever follows is accepted. */
const GOOGLE_MEET_REGEX = /^https:\/\/meet\.google\.com(?:[/?#]\S*)?$/i;
const PAYMENT_PROOF_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'pdf']);

/** Flat platform fee from platform_settings (key: platform_fee_php). */
async function getPlatformFee(db: Db): Promise<number> {
  const { data } = await db.from('platform_settings').select('value').eq('key', 'platform_fee_php').maybeSingle();
  const fee = Number(data?.value);
  return Number.isFinite(fee) && fee >= 0 ? fee : DEFAULT_PLATFORM_FEE;
}

function paymentOf(
  row: ConsultationRow,
  meta: ReturnType<typeof parseMeta>,
  range: MinuteRange | null,
  hourlyFeeFallback: number,
  platformFeeFallback: number
): PaymentDetails {
  const proof = meta.paymentProof && typeof meta.paymentProof === 'object' ? meta.paymentProof : null;
  const hourly = Number(meta.fee ?? hourlyFeeFallback) || 0;
  const minutes = range ? range.endMinutes - range.startMinutes : 60;
  const sessionFee = Math.round(hourly * (minutes / 60) * 100) / 100;
  const platformFee = typeof meta.platformFee === 'number' ? meta.platformFee : platformFeeFallback;

  let state: PaymentState = 'none';
  if (proof && ['submitted', 'verified', 'rejected'].includes(proof.status)) state = proof.status;
  else if (row.status === 'confirmed' || row.status === 'completed') state = 'verified';

  return {
    state,
    proofDocumentId: typeof proof?.documentId === 'string' ? proof.documentId : null,
    proofFileName: typeof proof?.fileName === 'string' ? proof.fileName : null,
    submittedAt: proof?.submittedAt ?? null,
    reviewedAt: proof?.reviewedAt ?? null,
    rejectionReason: typeof proof?.rejectionReason === 'string' ? proof.rejectionReason : null,
    sessionFee,
    platformFee,
    total: Math.round((sessionFee + platformFee) * 100) / 100,
  };
}

function summaryOf(date: CalendarDate, range: MinuteRange | null) {
  const weekday = WEEKDAY_NAMES[new Date(Date.UTC(date.year, date.monthIndex, date.day)).getUTCDay()];
  const minutes = range ? range.endMinutes - range.startMinutes : 60;
  const hours = minutes / 60;
  return {
    dateLong: `${weekday}, ${MONTH_NAMES[date.monthIndex]} ${date.day}, ${date.year}`,
    timeRange: range ? `${formatClock(range.startMinutes)} - ${formatClock(range.endMinutes)}` : 'Time to be confirmed',
    durationLabel:
      minutes % 60 === 0 ? `${hours} hour${hours === 1 ? '' : 's'}` : `${minutes} minutes`,
  };
}

type LedgerStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Mirrors the manual payment into public.payments — one ledger row per
 * consultation. A confirmed ("paid") payment becomes a lawyer sale with
 * payout_status "pending"; the Earnings & Payouts tab reads from this table.
 * Returns false when the row could not be written (the earnings loader
 * re-syncs missing paid rows, so a transient failure is self-healing).
 */
async function syncPaymentLedger(
  db: Db,
  consultation: ConsultationRow,
  payment: PaymentDetails,
  status: LedgerStatus,
  paidAtOverride?: string | null
): Promise<boolean> {
  try {
    // payer / payee must have profile rows (FK targets).
    if (!(await ensureProfile(db, consultation.lawyer_id))) return false;
    if (!(await ensureProfile(db, consultation.client_id))) return false;

    const { data: existingRows } = await db
      .from('payments')
      .select('id, status, payout_status, paid_at')
      .eq('consultation_id', consultation.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const existing = (existingRows?.[0] ?? null) as
      | { id: string; status: LedgerStatus; payout_status: string | null; paid_at: string | null }
      | null;

    const nowIso = new Date().toISOString();
    const keepPaidAt = status === 'paid' && existing?.status === 'paid' && existing.paid_at;
    const payoutStatus =
      status === 'paid'
        ? existing?.status === 'paid' && existing.payout_status && existing.payout_status !== 'not_applicable'
          ? existing.payout_status // never downgrade a released payout
          : 'pending'
        : 'not_applicable';

    const fields = {
      consultation_id: consultation.id,
      payer_id: consultation.client_id,
      payee_id: consultation.lawyer_id,
      amount: payment.total,
      platform_fee: payment.platformFee,
      currency: 'PHP',
      status,
      payout_status: payoutStatus,
      provider: 'manual_qr',
      provider_payment_id: payment.proofDocumentId,
      paid_at:
        status === 'paid'
          ? keepPaidAt
            ? existing!.paid_at
            : paidAtOverride || nowIso
          : status === 'refunded'
            ? existing?.paid_at ?? null
            : null,
      updated_at: nowIso,
    };
    const { error } = existing
      ? await db.from('payments').update(fields).eq('id', existing.id)
      : await db.from('payments').insert(fields);
    if (error) {
      console.error('[syncPaymentLedger]', status, consultation.id, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[syncPaymentLedger] unexpected', err);
    return false;
  }
}

/** Marks a consultation's paid ledger row as refunded (booking cancelled after payment). */
async function markLedgerRefunded(db: Db, consultationId: string): Promise<void> {
  try {
    const { error } = await db
      .from('payments')
      .update({ status: 'refunded', payout_status: 'not_applicable', updated_at: new Date().toISOString() })
      .eq('consultation_id', consultationId)
      .eq('status', 'paid');
    if (error) console.error('[markLedgerRefunded]', consultationId, error.message);
  } catch (err) {
    console.error('[markLedgerRefunded] unexpected', err);
  }
}

/** Resolves a consultation's Manila date and slot (new rows and legacy JSON-only rows). */
function scheduleOf(row: ConsultationRow): {
  meta: ReturnType<typeof parseMeta>;
  date: CalendarDate;
  range: MinuteRange | null;
  displayDate: string;
  timeSlot: string;
  /** Epoch ms of the start (or the date at midnight Manila when the slot is unknown). */
  startMs: number;
} {
  const meta = parseMeta(row.concern_summary);

  let date: CalendarDate | null = null;
  let range: MinuteRange | null = null;
  if (row.scheduled_start) {
    const start = toManilaParts(row.scheduled_start);
    date = parseIsoDate(start.isoDate);
    const end = row.scheduled_end ? toManilaParts(row.scheduled_end).minutes : start.minutes + 60;
    range = { startMinutes: start.minutes, endMinutes: end > start.minutes ? end : start.minutes + 60 };
  } else {
    date = parseDateStr(meta.dateStr) ?? (row.scheduled_time ? parseIsoDate(row.scheduled_time) : null);
    range = parseSlotRange(meta.timeSlot);
  }
  date ??= parseIsoDate(row.created_at);

  const longDate = `${MONTH_NAMES[date.monthIndex]} ${date.day}, ${date.year}`.toUpperCase();
  const isToday = toIsoDate(date) === todayInManila();
  return {
    meta,
    date,
    range,
    displayDate: isToday ? `TODAY, ${longDate}` : longDate,
    timeSlot: range ? formatSlotLabel(range) : String(meta.timeSlot ?? 'Scheduled Session'),
    startMs: row.scheduled_start
      ? new Date(row.scheduled_start).getTime()
      : new Date(toManilaTimestamp(date, range?.startMinutes ?? 0)).getTime(),
  };
}

interface ReminderContext {
  status: string;
  method: 'video' | 'audio';
  hasFiles: boolean;
  paymentState: PaymentState;
  lawyerName: string;
  dateLong: string;
  timeRange: string;
  durationLabel: string;
  totalFee: number;
  hasMeetingLink: boolean;
}

const pesoText = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Reminders shown in the client's Consultations tab. "Pending Confirmation", "Pending Payment"
 * and "Confirmed Appointment" are written around the booking's own details (attorney, schedule,
 * fee) and the rules the system enforces (proof upload limit, reschedule limits).
 */
function remindersFor({
  status,
  method,
  hasFiles,
  paymentState,
  lawyerName,
  dateLong,
  timeRange,
  durationLabel,
  totalFee,
  hasMeetingLink,
}: ReminderContext): string[] {
  const meet = method === 'video' ? 'video consultation' : 'audio call';
  const when = `${dateLong}, ${timeRange}`;
  const fee = totalFee > 0 ? pesoText(totalFee) : 'the consultation fee';
  if (status === 'awaiting_client_confirmation' && paymentState === 'submitted') {
    return [
      'Your proof of payment was submitted and is being reviewed by the attorney.',
      'You will be notified once the payment is confirmed.',
      `The Google Meet link for your ${meet} will appear here after confirmation.`,
      'Your time slot stays reserved while the payment is under review.',
    ];
  }
  if (status === 'awaiting_client_confirmation' && paymentState === 'rejected') {
    return [
      'The attorney could not verify your last proof of payment. See View Details for the reason.',
      'Please pay using the QR code and upload a clear screenshot or receipt again.',
      'You can message the attorney from the Messages tab if you have questions.',
    ];
  }
  switch (status) {
    // PENDING CONFIRMATION: waiting on the attorney.
    case 'pending':
      return [
        `${lawyerName} is reviewing your request for ${when}. You will be notified once they accept or decline.`,
        'Nothing to pay yet. Payment is only requested after the attorney accepts.',
        `Once accepted, you will pay ${fee} (session fee plus platform fee) by QR code to lock in the slot.`,
        hasFiles
          ? 'The attorney can already see the documents you shared, so they can prepare while reviewing.'
          : 'Sharing supporting documents from My Documents helps the attorney assess your concern faster.',
        'Changed your mind? You can cancel this request from this page at no cost.',
      ];
    // PENDING PAYMENT: accepted by the attorney, waiting on the client's payment.
    case 'awaiting_client_confirmation':
      return [
        `${lawyerName} accepted your request. Pay ${fee} to confirm your ${meet} on ${when}.`,
        'Open View Details to scan the QR code, then upload your proof of payment there.',
        `Upload a clear screenshot or receipt (PNG, JPG or PDF, up to ${formatBytes(MAX_UPLOAD_BYTES)}) showing the amount and reference number.`,
        'The attorney verifies the payment, and the Google Meet link appears here once it is confirmed.',
        'Questions about the payment? Message the attorney from the Messages tab.',
      ];
    // CONFIRMED APPOINTMENT: paid and scheduled.
    case 'confirmed':
      return [
        `Payment confirmed. Your ${meet} with ${lawyerName} is on ${when} (${durationLabel}).`,
        hasMeetingLink
          ? 'Use the Join Meet button a few minutes early so you start on time.'
          : 'The Google Meet link will appear here once the attorney adds it.',
        method === 'video'
          ? 'Find a quiet, private room and test your camera and microphone beforehand.'
          : 'Find a quiet, private room and test your microphone and speakers beforehand.',
        'Write down your questions and keep related documents within reach.',
        `Need a different time? You can request a reschedule until ${RESCHEDULE_CUTOFF_MS / 3_600_000} hour before the session (up to ${MAX_RESCHEDULES} per booking).`,
        'Everything you discuss is protected by attorney-client privilege.',
      ];
    case 'completed':
      return [
        'This consultation has been completed.',
        'You can continue the conversation with your attorney in the Messages tab.',
        'Consider leaving a review to help other clients.',
      ];
    case 'declined':
      return [
        'The attorney declined this request. See View Details for the reason.',
        'You can book another available slot or consult a different attorney.',
      ];
    default:
      return [];
  }
}

function toClientConsultation(
  row: ConsultationRow,
  lawyer: LawyerSummaryRow | null,
  platformFee: number = DEFAULT_PLATFORM_FEE
): ClientConsultation {
  const { meta, date, range, displayDate, timeSlot } = scheduleOf(row);
  const payment = paymentOf(row, meta, range, Number(lawyer?.fee_standard_60min ?? 0), platformFee);
  const summary = summaryOf(date, range);
  const lawyerName = lawyer?.full_name || meta.lawyerName || 'Assigned Counsel';
  const sharedDocs = sharedDocsFromMeta(meta);

  const ratingAvg = Number(lawyer?.rating_avg ?? 0);
  const ratingCount = Number(lawyer?.rating_count ?? 0);
  const rating =
    ratingCount > 0
      ? `${ratingAvg.toFixed(1)} (${ratingCount} Review${ratingCount === 1 ? '' : 's'})`
      : 'New (No reviews yet)';

  return {
    id: row.id,
    rawStatus: row.status,
    status: statusLabel(row.status, payment.state),
    dateStr: displayDate,
    day: date.day,
    month: date.monthIndex,
    year: date.year,
    timeSlot,
    scheduledStart: row.scheduled_start,
    communicationMode: row.method === 'audio' ? 'audio' : 'video',
    lawyerId: row.lawyer_id,
    lawyerName,
    rollNumber: lawyer?.roll_number || '—',
    ibpChapter: (lawyer?.ibp_chapter || '—').toUpperCase(),
    practiceAreas: lawyer?.practice_areas?.length ? lawyer.practice_areas : ['General Practice'],
    rating,
    experienceYrs: lawyer?.experience_years ?? 0,
    ratePerHour: Number(lawyer?.fee_standard_60min ?? meta.fee ?? 0) || 0,
    docket: 'SUBJECT MATTER & CASE DOCKET',
    caseTitle: meta.subject || 'Legal Consultation',
    caseDescription: meta.description || 'No additional details were provided for this consultation.',
    meetingLink: row.meeting_url ?? null,
    attachedFiles: sharedDocs,
    reminders: remindersFor({
      status: row.status,
      method: row.method === 'audio' ? 'audio' : 'video',
      hasFiles: sharedDocs.length > 0,
      paymentState: payment.state,
      lawyerName,
      dateLong: summary.dateLong,
      timeRange: summary.timeRange,
      durationLabel: summary.durationLabel,
      totalFee: payment.total,
      hasMeetingLink: Boolean(row.meeting_url),
    }),
    declineReason: typeof meta.declineReason === 'string' ? meta.declineReason : null,
    cancellationReason: typeof meta.cancellationReason === 'string' ? meta.cancellationReason : null,
    ...summary,
    payment,
    reschedule: rescheduleInfoOf(row, meta, 'client'),
  };
}

/**
 * Revokes the lawyer's access to documents shared for a consultation, unless
 * another active booking between the same client and lawyer still shares them.
 */
async function revokeSharedDocuments(db: Db, consultation: ConsultationRow): Promise<void> {
  const sharedIds = sharedDocsFromMeta(parseMeta(consultation.concern_summary)).map((d) => d.documentId);
  if (sharedIds.length === 0) return;

  const { data: others } = await db
    .from('consultations')
    .select('id, concern_summary')
    .eq('client_id', consultation.client_id)
    .eq('lawyer_id', consultation.lawyer_id)
    .in('status', ACTIVE_BOOKING_STATUSES)
    .neq('id', consultation.id);
  const stillShared = new Set(
    (others ?? []).flatMap((o: { concern_summary: string | null }) =>
      sharedDocsFromMeta(parseMeta(o.concern_summary)).map((d) => d.documentId)
    )
  );
  const toRevoke = sharedIds.filter((id) => !stillShared.has(id));
  if (toRevoke.length === 0) return;

  const { error } = await db
    .from('document_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('grantee_id', consultation.lawyer_id)
    .eq('granted_by', consultation.client_id)
    .is('revoked_at', null)
    .in('document_id', toRevoke);
  if (error) console.warn('[revokeSharedDocuments]', error.message);
}

/** Grants the lawyer view access to the client's documents (idempotent). */
async function grantDocumentAccess(
  db: Db,
  documentIds: string[],
  granteeId: string,
  grantorId: string
): Promise<boolean> {
  if (documentIds.length === 0) return true;
  if (!(await ensureProfile(db, granteeId))) {
    console.warn('[grantDocumentAccess] grantee has no profile row:', granteeId);
    return false;
  }

  const { data: existing, error: existingErr } = await db
    .from('document_access_grants')
    .select('document_id')
    .eq('grantee_id', granteeId)
    .is('revoked_at', null)
    .in('document_id', documentIds);
  if (existingErr) {
    console.warn('[grantDocumentAccess] lookup failed:', existingErr.message);
    return false;
  }

  const alreadyGranted = new Set((existing ?? []).map((r: { document_id: string }) => r.document_id));
  const rows = documentIds
    .filter((id) => !alreadyGranted.has(id))
    .map((id) => ({ document_id: id, grantee_id: granteeId, granted_by: grantorId, level: 'view' }));
  if (rows.length === 0) return true;

  const { error } = await db.from('document_access_grants').insert(rows);
  if (error) {
    console.warn('[grantDocumentAccess] insert failed:', error.message);
    return false;
  }
  return true;
}

/**
 * Tells the affected users' open tabs to re-fetch `scopes` (Supabase Realtime
 * broadcast). Sent after the response so it never slows the action down.
 */
function signalLive(userIds: Array<string | null | undefined>, scopes: LiveScope[]): void {
  try {
    after(() => emitLive(userIds, scopes));
  } catch {
    // Outside a request scope (scripts / tests): send directly.
    void emitLive(userIds, scopes);
  }
}

function revalidateConsultationPaths() {
  try {
    revalidatePath('/client/consultations');
    revalidatePath('/lawyer/consultations');
    revalidatePath('/lawyer/earnings');
    revalidatePath('/client/documents');
  } catch {
    // revalidatePath is a no-op outside a request scope
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// CLIENT: CONSULTATION BOOKING
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Returns the time-slot labels already reserved (pending / confirmed) for a
 * lawyer on a given date ("November 26, 2026"). Public availability data only.
 */
export async function getBookedSlotsForLawyer(lawyerId: string, dateStr: string): Promise<string[]> {
  try {
    if (!UUID_REGEX.test(lawyerId ?? '')) return [];
    const date = parseDateStr(dateStr);
    if (!date) return [];
    const db = await getDb();
    const bookings = await findActiveBookingsOnDate(db, 'lawyer_id', lawyerId, date);
    return bookings.map((b) => b.label);
  } catch (err) {
    console.error('[getBookedSlotsForLawyer]', err);
    return [];
  }
}

/**
 * Books a consultation for the signed-in client:
 *  1. Validates the request (lawyer, date/slot in the future, subject, files).
 *  2. Rejects slots that overlap an active booking of the lawyer or the client.
 *  3. Inserts the consultation as `pending` (awaiting the lawyer's confirmation).
 *     The Google Meet link is attached later, when the lawyer confirms.
 *  4. Shares the selected My Documents files with the lawyer
 *     (document_access_grants, view-only).
 *  5. Notifies the lawyer in-app.
 */
export async function bookConsultationAction(input: BookConsultationInput): Promise<BookConsultationResult> {
  try {
    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user, profile } = session;
    const requestId = typeof input?.requestId === 'string' && UUID_REGEX.test(input.requestId) ? input.requestId.toLowerCase() : null;

    // A repeated submission of the same booking returns the booking that was already made.
    const findRepeat = async () => {
      if (!requestId) return null;
      const { data: repeat } = await db
        .from('consultations')
        .select(`${CONSULTATION_COLUMNS}, lawyer_profiles(${LAWYER_SUMMARY_COLUMNS})`)
        .eq('client_id', user.id)
        .like('concern_summary', `%"idempotencyKey":"${requestId}"%`)
        .limit(1)
        .maybeSingle();
      if (!repeat) return null;
      const row = repeat as unknown as ConsultationRow & { lawyer_profiles: LawyerSummaryRow | null };
      return {
        success: true as const,
        consultation: toClientConsultation(row, row.lawyer_profiles, await getPlatformFee(db)),
        sharedDocumentCount: sharedDocsFromMeta(parseMeta(row.concern_summary)).length,
        sharingComplete: true,
      };
    };
    const repeated = await findRepeat();
    if (repeated) return repeated;

    const limited = await checkRateLimit('booking', user.id);
    if (limited) return { error: limited };

    // ── 1. Validate input ──
    const lawyerId = typeof input?.lawyerId === 'string' ? input.lawyerId.trim() : '';
    if (!UUID_REGEX.test(lawyerId)) {
      return { error: 'Invalid attorney selected. Please reopen the lawyer profile and try again.' };
    }
    if (lawyerId === user.id) return { error: 'You cannot book a consultation with yourself.' };

    const method = input.communicationMode;
    if (method !== 'video' && method !== 'audio') {
      return { error: 'Please choose a mode of communication (video consultation or audio call).' };
    }

    const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    if (!subject) return { error: 'Please enter a consultation subject.' };
    if (subject.length > MAX_SUBJECT_LENGTH) {
      return { error: `The subject must be ${MAX_SUBJECT_LENGTH} characters or fewer.` };
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { error: `The subject description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.` };
    }

    const date = parseDateStr(input.dateStr);
    const range = parseSlotRange(input.timeSlot);
    if (!date || !range) return { error: 'Please select a valid consultation date and time slot.' };

    const scheduledStart = toManilaTimestamp(date, range.startMinutes);
    const scheduledEnd = toManilaTimestamp(date, range.endMinutes);
    if (new Date(scheduledStart).getTime() <= Date.now()) {
      return { error: 'The selected time slot has already passed. Please choose a future date and time.' };
    }

    const requestedDocIds = Array.isArray(input.documentIds) ? input.documentIds : [];
    if (requestedDocIds.some((id) => typeof id !== 'string' || !UUID_REGEX.test(id))) {
      return { error: 'One or more attached files are invalid. Please remove them and re-attach from My Documents.' };
    }
    const documentIds = Array.from(new Set(requestedDocIds));
    if (documentIds.length > MAX_SHARED_DOCUMENTS) {
      return { error: `You can share up to ${MAX_SHARED_DOCUMENTS} documents per consultation.` };
    }

    // ── 2. Lawyer must exist, be verified and accepting bookings ──
    const { data: lawyerRow, error: lawyerErr } = await db
      .from('lawyer_profiles')
      .select(`${LAWYER_SUMMARY_COLUMNS}, is_available, verification_status`)
      .eq('user_id', lawyerId)
      .maybeSingle();
    if (lawyerErr || !lawyerRow) return { error: 'This attorney could not be found.' };
    if (lawyerRow.verification_status !== 'approved') {
      return { error: 'This attorney has not been verified to accept consultations yet.' };
    }
    if (lawyerRow.is_available === false) {
      return { error: 'This attorney is not accepting new consultations right now.' };
    }
    const { data: lawyerAccount } = await db
      .from('profiles')
      .select('account_status')
      .eq('user_id', lawyerId)
      .maybeSingle();
    if (lawyerAccount?.account_status && lawyerAccount.account_status !== 'active') {
      return { error: 'This attorney is not accepting new consultations right now.' };
    }
    const lawyer = lawyerRow as unknown as LawyerSummaryRow;

    // ── 3. Attached documents must belong to the client ──
    let sharedDocs: SharedDocumentRef[] = [];
    if (documentIds.length > 0) {
      const { data: docs, error: docsErr } = await db
        .from('documents')
        .select('id, filename, mime_type, size_bytes')
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .in('id', documentIds);
      if (docsErr) return { error: 'We could not verify your attached files. Please try again.' };

      const byId = new Map(
        (docs ?? [])
          .filter((d: { filename: string; mime_type: string | null }) => !isFolderRow(d))
          .map((d: { id: string }) => [d.id, d])
      );
      if (byId.size !== documentIds.length) {
        return {
          error: 'Some attached files are no longer available in My Documents. Please remove them and re-attach.',
        };
      }
      sharedDocs = documentIds.map((id) => {
        const d = byId.get(id) as { id: string; filename: string; mime_type: string | null; size_bytes: number | null };
        return { documentId: d.id, name: d.filename, size: formatBytes(d.size_bytes), mimeType: d.mime_type };
      });
    }

    // ── 4. Slot conflicts (lawyer & client) ──
    const timeSlotLabel = formatSlotLabel(range);
    const lawyerBookings = await findActiveBookingsOnDate(db, 'lawyer_id', lawyerId, date);
    if (lawyerBookings.some((b) => rangesOverlap(b, range))) {
      return {
        error: `The ${timeSlotLabel} slot is already reserved for this attorney. Please choose another time slot.`,
      };
    }
    const blocked = await findUnavailabilityOnDate(db, lawyerId, date);
    if (blocked.some((b) => b === 'all-day' || rangesOverlap(b, range))) {
      return {
        error: blocked.includes('all-day')
          ? 'This attorney is unavailable on the selected date. Please choose another day.'
          : `This attorney is unavailable during ${timeSlotLabel}. Please choose another time slot.`,
      };
    }
    const clientBookings = await findActiveBookingsOnDate(db, 'client_id', user.id, date);
    if (clientBookings.some((b) => rangesOverlap(b, range))) {
      return { error: 'You already have another consultation scheduled at this time. Please choose a different slot.' };
    }

    // ── 5. Insert the pending consultation ──
    const dateLabel = `${MONTH_NAMES[date.monthIndex]} ${date.day}, ${date.year}`;
    const fee = Number(lawyer.fee_standard_60min ?? 0) || 0;
    const concernPayload = {
      subject,
      description,
      dateStr: dateLabel,
      timeSlot: timeSlotLabel,
      day: date.day,
      month: MONTH_NAMES[date.monthIndex],
      year: date.year,
      lawyerName: lawyer.full_name,
      communicationMode: method,
      fee,
      attachedFiles: sharedDocs,
      bookedAt: new Date().toISOString(),
      ...(requestId ? { idempotencyKey: requestId } : {}),
    };

    const { data: inserted, error: insertErr } = await db
      .from('consultations')
      .insert({
        client_id: user.id,
        lawyer_id: lawyerId,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        scheduled_time: toIsoDate(date),
        method,
        status: 'pending',
        concern_summary: JSON.stringify(concernPayload),
        meeting_url: null,
      })
      .select(CONSULTATION_COLUMNS)
      .single();

    if (insertErr || !inserted) {
      if (insertErr?.code === '23505' || insertErr?.code === '23P01') {
        // The same booking submitted twice at once: the other request created it.
        const raced = await findRepeat();
        if (raced) return raced;
        if (/client_overlap/.test(insertErr.message ?? '')) {
          return { error: 'You already have another consultation scheduled at this time. Please choose a different slot.' };
        }
        return {
          error: `The ${timeSlotLabel} slot was just reserved by another client. Please choose another time slot.`,
        };
      }
      // Database eligibility rule (supabase/manual/005): the lawyer or client can't book right now.
      if (insertErr?.code === 'P0001' && insertErr.message) {
        return { error: insertErr.message };
      }
      console.error('[bookConsultationAction] insert failed:', insertErr);
      return { error: 'We could not save your booking right now. Please try again in a moment.' };
    }

    // ── 6. Share documents with the lawyer & notify ──
    const sharingComplete = await grantDocumentAccess(
      db,
      sharedDocs.map((d) => d.documentId),
      lawyerId,
      user.id
    );

    // The client ⇄ lawyer conversation merges every booking between the pair, so record this
    // request there too. Otherwise the thread's latest status message can belong to an older
    // booking (e.g. a previous "approved" one) and contradict this pending request.
    if (await ensureUserAccount(db, profile)) {
      await postSystemMessage(
        db,
        inserted.id,
        user.id,
        `Consultation request sent for ${dateLabel.toUpperCase()} (${timeSlotLabel}) — "${subject}". ` +
          `Waiting for ${lawyer.full_name || 'the attorney'} to approve this booking.`
      );
    }

    await notifyUser(
      db,
      lawyerId,
      'consultation_request',
      'New Consultation Request',
      `${profile.full_name || 'A client'} requested a ${method === 'video' ? 'video consultation' : 'audio call'} on ${dateLabel} (${timeSlotLabel}).` +
        (sharedDocs.length > 0 ? ` ${sharedDocs.length} document(s) shared.` : ''),
      {
        consultationId: inserted.id,
        clientId: user.id,
        scheduledStart,
        method,
        sharedDocumentIds: sharedDocs.map((d) => d.documentId),
      }
    );

    revalidateConsultationPaths();
    signalLive([user.id, lawyerId], ['consultations', 'documents', 'messages']);

    return {
      success: true,
      consultation: toClientConsultation(inserted as ConsultationRow, lawyer, await getPlatformFee(db)),
      sharedDocumentCount: sharedDocs.length,
      sharingComplete,
    };
  } catch (err) {
    console.error('[bookConsultationAction] unexpected error:', err);
    return { error: 'Something went wrong while submitting your booking. Please try again.' };
  }
}

/** Client bookings that are still going ahead (they sort by date ahead of finished ones). */
const CLIENT_LIVE_STATUSES = new Set<ClientConsultationStatusLabel>([
  'PENDING CONFIRMATION',
  'PENDING PAYMENT',
  'PAYMENT UNDER REVIEW',
  'CONFIRMED APPOINTMENT',
]);

/**
 * Fetches the signed-in client's consultations (excluding cancelled ones),
 * soonest first.
 */
export async function getClientConsultationsAction(): Promise<ClientConsultation[]> {
  try {
    const session = await requireSession();
    if ('error' in session) return [];
    const { db, user } = session;

    const { data, error } = await db
      .from('consultations')
      .select(`${CONSULTATION_COLUMNS}, lawyer_profiles(${LAWYER_SUMMARY_COLUMNS})`)
      .eq('client_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getClientConsultationsAction]', error.message);
      return [];
    }

    // lawyer_id → lawyer_profiles.user_id is many-to-one, so PostgREST embeds a single object.
    const rows = (data ?? []) as unknown as Array<ConsultationRow & { lawyer_profiles: LawyerSummaryRow | null }>;

    const platformFee = await getPlatformFee(db);
    const items = rows.map((row) => toClientConsultation(row, row.lawyer_profiles, platformFee));
    // Soonest first: active bookings that haven't ended yet (including one in progress or later
    // today), earliest start first; then finished / declined ones, most recent first. The client
    // Consultations screen opens on the first one.
    return orderSoonestFirst(items, (c) => CLIENT_LIVE_STATUSES.has(c.status));
  } catch (err) {
    console.error('[getClientConsultationsAction] catch:', err);
    return [];
  }
}

/**
 * Lets the client cancel their own pending / confirmed consultation.
 * Revokes the lawyer's access to documents that were shared only for it.
 */
export async function cancelConsultationAction(
  consultationId: string
): Promise<{ success: true } | { success?: false; error: string }> {
  try {
    if (!UUID_REGEX.test(consultationId ?? '')) return { error: 'Consultation not found.' };

    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user, profile } = session;

    const { data: row, error: fetchErr } = await db
      .from('consultations')
      .select(CONSULTATION_COLUMNS)
      .eq('id', consultationId)
      .eq('client_id', user.id)
      .maybeSingle();
    if (fetchErr || !row) return { error: 'Consultation not found.' };

    const consultation = row as ConsultationRow;
    if (!ACTIVE_BOOKING_STATUSES.includes(consultation.status)) {
      return { error: 'This consultation can no longer be cancelled.' };
    }
    // Paid (confirmed) bookings need the attorney's approval: the client sends a cancellation
    // request instead (requestCancellationAction in consultationExtrasActions.ts).
    if (consultation.status === 'confirmed') {
      return {
        error: 'This consultation is already paid, so your attorney has to approve a cancellation. Send a cancellation request instead.',
      };
    }

    const summary = toClientConsultation(consultation, null);
    const wasPaid = summary.payment.state === 'verified';
    const meta = {
      ...parseMeta(consultation.concern_summary),
      cancelledBy: 'client',
      cancelledAt: new Date().toISOString(),
      ...(wasPaid ? { refundStatus: 'pending' } : {}),
    };

    const { data: updated, error: updateErr } = await db
      .from('consultations')
      .update({
        status: 'cancelled',
        cancelled_by: user.id,
        concern_summary: JSON.stringify(meta),
        updated_at: new Date().toISOString(),
      })
      .eq('id', consultationId)
      .eq('client_id', user.id)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .select('id');
    if (updateErr || !updated || updated.length === 0) {
      if (updateErr) console.error('[cancelConsultationAction] update failed:', updateErr.message);
      return { error: 'We could not cancel this consultation. Please refresh and try again.' };
    }

    // A paid booking that is cancelled is owed back to the client — remove it from the lawyer's sales.
    if (wasPaid) await markLedgerRefunded(db, consultationId);

    // Revoke document access unless another active booking with the same lawyer still shares the file.
    await revokeSharedDocuments(db, consultation);

    // Close this booking out in the shared conversation so its earlier status messages
    // (e.g. "approved") aren't read as current.
    if (await ensureUserAccount(db, profile)) {
      await postSystemMessage(
        db,
        consultationId,
        user.id,
        `${profile.full_name || 'The client'} cancelled the consultation for ${summary.dateStr.replace('TODAY, ', '')} (${summary.timeSlot}).` +
          (wasPaid ? ' A refund is pending.' : '')
      );
    }

    await notifyUser(
      db,
      consultation.lawyer_id,
      'consultation_cancelled',
      'Consultation Cancelled by Client',
      `${profile.full_name || 'The client'} cancelled the consultation scheduled on ${summary.dateStr.replace('TODAY, ', '')} (${summary.timeSlot}).` +
        (wasPaid ? ' The client has already paid, so a refund is pending.' : ''),
      { consultationId, clientId: user.id, refundPending: wasPaid }
    );

    revalidateConsultationPaths();
    signalLive([user.id, consultation.lawyer_id], ['consultations', 'payments', 'documents', 'messages']);
    return { success: true };
  } catch (err) {
    console.error('[cancelConsultationAction] unexpected error:', err);
    return { error: 'Something went wrong while cancelling. Please try again.' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MY DOCUMENTS (client vault; files live in the private `case-documents` bucket)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Creates a folder in My Documents. Folders are marker rows in
 * public.documents; files reference them through their storage path.
 */
export async function createDocumentFolderAction(
  folderName: string
): Promise<{ success: true; folder: DocumentFolderItem } | { success?: false; error: string }> {
  try {
    const name = typeof folderName === 'string' ? folderName.trim() : '';
    if (!name) return { error: 'Please enter a folder name.' };
    if (name.length > 100) return { error: 'Folder names must be 100 characters or fewer.' };

    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const folderId = randomUUID();
    const { error } = await db.from('documents').insert({
      id: folderId,
      owner_id: user.id,
      filename: `${FOLDER_PREFIX}${name}`,
      storage_path: `${user.id}/folders/${folderId}/.folder`,
      mime_type: FOLDER_MIME,
      size_bytes: 0,
      visibility_scope: 'private',
    });
    if (error) {
      console.error('[createDocumentFolderAction] insert failed:', error.message);
      return { error: 'We could not create the folder. Please try again.' };
    }

    revalidatePath('/client/documents');
    revalidatePath('/lawyer/documents');
    signalLive([user.id], ['documents']);
    return {
      success: true,
      folder: { id: folderId, name, kind: 'owned', isRecentlyCreated: true, files: [] },
    };
  } catch (err) {
    console.error('[createDocumentFolderAction] error:', err);
    return { error: 'We could not create the folder. Please try again.' };
  }
}

/**
 * Uploads a file to My Documents.
 * FormData fields: `file` (required), `folderId` (optional), `displayName` (optional).
 */
export async function uploadDocumentFileAction(
  formData: FormData
): Promise<{ success: true; file: DocumentFileItem } | { success?: false; error: string }> {
  try {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file to upload.' };
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `"${file.name}" is larger than ${formatBytes(MAX_UPLOAD_BYTES)}. Please upload a smaller file.` };
    }

    const requestedName = String(formData.get('displayName') ?? '').trim();
    let displayName = (requestedName || file.name).replace(/[\\/]/g, '_').slice(0, 180);
    const originalExt = fileExtension(file.name);
    if (!fileExtension(displayName) && originalExt) displayName = `${displayName}.${originalExt}`;
    const ext = fileExtension(displayName) || originalExt;
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return { error: 'Unsupported file type. Upload PDF, Word, Excel, CSV, image, text or MP4 files.' };
    }

    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;
    const uploadLimited = await checkRateLimit('upload', user.id);
    if (uploadLimited) return { error: uploadLimited };
    if (!(await fileMatchesExtension(file, ext))) return { error: FILE_CONTENT_MISMATCH };

    // Only accept folders the user actually owns.
    const requestedFolderId = String(formData.get('folderId') ?? '');
    let folderId: string | null = null;
    if (UUID_REGEX.test(requestedFolderId)) {
      const { data: folder } = await db
        .from('documents')
        .select('id, filename, mime_type')
        .eq('id', requestedFolderId)
        .eq('owner_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();
      if (folder && isFolderRow(folder)) folderId = folder.id;
    }

    const safeName = displayName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const storagePath = folderId
      ? `${user.id}/folders/${folderId}/${randomUUID()}-${safeName}`
      : `${user.id}/vault/${randomUUID()}-${safeName}`;
    const mimeType = file.type || 'application/octet-stream';

    const { error: uploadErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, { contentType: mimeType, upsert: false });
    if (uploadErr) {
      console.error('[uploadDocumentFileAction] storage upload failed:', uploadErr.message);
      return { error: 'We could not upload the file. Please try again.' };
    }

    const { data: doc, error: insertErr } = await db
      .from('documents')
      .insert({
        owner_id: user.id,
        filename: displayName,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        visibility_scope: 'private',
      })
      .select('id, filename, size_bytes, uploaded_at')
      .single();
    if (insertErr || !doc) {
      console.error('[uploadDocumentFileAction] insert failed:', insertErr?.message);
      await db.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      return { error: 'We could not save the file to My Documents. Please try again.' };
    }

    revalidatePath('/client/documents');
    revalidatePath('/lawyer/documents');
    signalLive([user.id], ['documents']);
    return {
      success: true,
      file: {
        id: doc.id,
        name: doc.filename,
        size: formatBytes(doc.size_bytes),
        type: fileTypeFromName(doc.filename),
        updatedAt: 'Just now',
      },
    };
  } catch (err) {
    console.error('[uploadDocumentFileAction] error:', err);
    return { error: 'We could not upload the file. Please try again.' };
  }
}

/**
 * Deletes a document file owned by the current user.
 */
export async function deleteDocumentFileAction(
  documentId: string
): Promise<{ success: true } | { success?: false; error: string }> {
  try {
    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const { error } = await db
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', documentId)
      .eq('owner_id', user.id);

    if (error) {
      console.error('[deleteDocumentFileAction] update failed:', error.message);
      return { error: 'Failed to delete the document.' };
    }

    revalidatePath('/client/documents');
    revalidatePath('/lawyer/documents');
    signalLive([user.id], ['documents']);
    return { success: true };
  } catch (err) {
    console.error('[deleteDocumentFileAction] error:', err);
    return { error: 'Failed to delete the document.' };
  }
}

/**
 * Deletes a folder owned by the current user and soft-deletes files inside it.
 */
export async function deleteDocumentFolderAction(
  folderId: string
): Promise<{ success: true } | { success?: false; error: string }> {
  try {
    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const now = new Date().toISOString();
    const { error: folderErr } = await db
      .from('documents')
      .update({ deleted_at: now })
      .eq('id', folderId)
      .eq('owner_id', user.id);

    if (folderErr) {
      console.error('[deleteDocumentFolderAction] folder delete failed:', folderErr.message);
      return { error: 'Failed to delete folder.' };
    }

    // Also soft-delete files associated with this folder path
    await db
      .from('documents')
      .update({ deleted_at: now })
      .eq('owner_id', user.id)
      .like('storage_path', `%/${folderId}/%`);

    revalidatePath('/client/documents');
    revalidatePath('/lawyer/documents');
    signalLive([user.id], ['documents']);
    return { success: true };
  } catch (err) {
    console.error('[deleteDocumentFolderAction] error:', err);
    return { error: 'Failed to delete folder.' };
  }
}

/**
 * Renames a folder owned by the current user.
 */
export async function renameDocumentFolderAction(
  folderId: string,
  newName: string
): Promise<{ success: true; newName: string } | { success?: false; error: string }> {
  try {
    const trimmed = (newName ?? '').trim();
    if (!trimmed) return { error: 'Folder name cannot be empty.' };
    if (trimmed.length > 100) return { error: 'Folder name must be 100 characters or fewer.' };

    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const { error } = await db
      .from('documents')
      .update({ filename: `${FOLDER_PREFIX}${trimmed}` })
      .eq('id', folderId)
      .eq('owner_id', user.id);

    if (error) {
      console.error('[renameDocumentFolderAction] update failed:', error.message);
      return { error: 'Failed to rename folder.' };
    }

    revalidatePath('/client/documents');
    revalidatePath('/lawyer/documents');
    signalLive([user.id], ['documents']);
    return { success: true, newName: trimmed };
  } catch (err) {
    console.error('[renameDocumentFolderAction] error:', err);
    return { error: 'Failed to rename folder.' };
  }
}

/**
 * Returns the signed-in user's My Documents folders:
 *  - "Client Vault & Uploaded Records" (files not in a folder)
 *  - user-created folders
 *  - one shared folder per consultation, listing the documents shared with counsel
 * File IDs are public.documents IDs, so they can be attached to a booking.
 */
export async function getUserDocumentsDataAction(
  role: 'client' | 'lawyer' = 'client'
): Promise<DocumentFolderItem[]> {
  try {
    const session = await requireSession();
    if ('error' in session) return [];
    const { db, user } = session;

    const { data: docs, error: docsErr } = await db
      .from('documents')
      .select('id, filename, storage_path, mime_type, size_bytes, uploaded_at')
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      .order('uploaded_at', { ascending: false });
    if (docsErr) console.warn('[getUserDocumentsDataAction] documents:', docsErr.message);

    type DocRow = {
      id: string;
      filename: string;
      storage_path: string | null;
      mime_type: string | null;
      size_bytes: number | null;
      uploaded_at: string;
    };
    const rows = (docs ?? []) as DocRow[];

    const customFolders = new Map<string, DocumentFolderItem>();
    for (const d of rows) {
      if (!isFolderRow(d)) continue;
      customFolders.set(d.id, {
        id: d.id,
        name: d.filename.replace(FOLDER_PREFIX, ''),
        kind: 'owned',
        isRecentlyCreated: true,
        files: [],
      });
    }

    const generalFiles: DocumentFileItem[] = [];
    for (const d of rows) {
      if (isFolderRow(d)) continue;
      const item: DocumentFileItem = {
        id: d.id,
        name: d.filename,
        size: formatBytes(d.size_bytes),
        type: fileTypeFromName(d.filename),
        updatedAt: new Date(d.uploaded_at).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
      };
      const folderId = folderIdFromStoragePath(d.storage_path);
      const folder = folderId ? customFolders.get(folderId) : undefined;
      if (folder) folder.files.push(item);
      else generalFiles.push(item);
    }

    const folders: DocumentFolderItem[] = [];
    if (generalFiles.length > 0) {
      folders.push({
        id: 'uploaded-records',
        name: 'Client Vault & Uploaded Records',
        kind: 'owned',
        isRecentlyCreated: false,
        files: generalFiles,
      });
    }
    customFolders.forEach((f) => folders.push(f));

    // Consultation folders (documents shared with / by counsel).
    const column = role === 'lawyer' ? 'lawyer_id' : 'client_id';
    const { data: consultations } = await db
      .from('consultations')
      .select('id, status, concern_summary, created_at')
      .eq(column, user.id)
      .not('status', 'in', '(cancelled,declined)')
      .order('created_at', { ascending: false });

    const ownedById = new Map(rows.map((d) => [d.id, d]));
    for (const c of (consultations ?? []) as Array<{ id: string; status: string; concern_summary: string | null; created_at: string }>) {
      const meta = parseMeta(c.concern_summary);
      const updatedAt = typeof meta.dateStr === 'string' ? meta.dateStr : 'Recent';
      let files: DocumentFileItem[];

      if (role === 'client') {
        // Only list documents that still exist in the client's vault.
        files = sharedDocsFromMeta(meta)
          .filter((ref) => ownedById.has(ref.documentId))
          .map((ref) => ({
            id: ref.documentId,
            name: ref.name,
            size: ref.size,
            type: fileTypeFromName(ref.name),
            updatedAt,
          }));
      } else {
        const raw: unknown[] = Array.isArray(meta.attachedFiles) ? meta.attachedFiles : [];
        files = raw.map((f, idx) => {
          const ref = (typeof f === 'string' ? { name: f } : f) as Partial<SharedDocumentRef> & { name?: string };
          const name = String(ref?.name ?? 'Document');
          return {
            id: ref?.documentId ?? `${c.id}-f-${idx}`,
            name,
            size: String(ref?.size ?? '—'),
            type: fileTypeFromName(name),
            updatedAt,
          };
        });
      }

      folders.push({
        id: c.id,
        name: meta.subject || 'Consultation Intake Documents',
        kind: 'shared',
        isRecentlyCreated: c.status === 'pending',
        files,
      });
    }

    return folders;
  } catch (err) {
    console.error('[getUserDocumentsDataAction] catch:', err);
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LAWYER: CONSULTATION REQUESTS
// ═════════════════════════════════════════════════════════════════════════════

export type LawyerConsultationStatus =
  | 'pending'
  | 'pending_payment'
  | 'payment_review'
  | 'confirmed'
  | 'completed'
  | 'declined'
  | 'cancelled';

export interface LawyerConsultation {
  id: string;
  rawStatus: string;
  status: LawyerConsultationStatus;
  statusLabel: string;
  /** e.g. "TODAY, NOVEMBER 26, 2026" */
  dateTag: string;
  timeTag: string;
  day: number;
  month: number;
  year: number;
  scheduledStart: string | null;
  communicationMode: 'video' | 'audio';
  clientId: string;
  client: {
    name: string;
    age: number | null;
    sex: string | null;
    address: string | null;
    email: string;
    phone: string | null;
    /** How, when and in which language the client prefers to be reached (from their profile). */
    contactPreference?: string | null;
  };
  subjectCategory: string;
  subjectTitle: string;
  caseDescription: string;
  fee: number;
  attachedFiles: SharedDocumentRef[];
  meetingLink: string | null;
  declineReason: string | null;
  cancellationReason: string | null;
  /** e.g. "Thursday, October 15, 2026" */
  dateLong: string;
  timeRange: string;
  durationLabel: string;
  /** The signed-in lawyer's own details for the booking / payment summary card. */
  lawyerSummary: { name: string; rollNumber: string; ibpChapter: string };
  /** Manual QR payment state and fee breakdown. */
  paymentDetails: PaymentDetails;
  /** Reschedule request state (confirmed appointments only). */
  reschedule?: RescheduleInfo | null;
}

const LAWYER_STATUS_LABELS: Record<LawyerConsultationStatus, string> = {
  pending: 'PENDING YOUR APPROVAL',
  pending_payment: 'PENDING PAYMENT',
  payment_review: 'PAYMENT FOR REVIEW',
  confirmed: 'CONFIRMED APPOINTMENT',
  completed: 'COMPLETED',
  declined: 'DECLINED',
  cancelled: 'CANCELLED',
};

function toLawyerStatus(raw: string, paymentState: PaymentState = 'none'): LawyerConsultationStatus {
  switch (raw) {
    case 'awaiting_client_confirmation':
      return paymentState === 'submitted' ? 'payment_review' : 'pending_payment';
    case 'confirmed':
    case 'completed':
    case 'declined':
    case 'cancelled':
      return raw;
    default:
      return 'pending';
  }
}

interface ClientProfileEmbed {
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface LawyerSelfRow {
  full_name: string;
  roll_number: string | null;
  ibp_chapter: string | null;
  fee_standard_60min: number | string | null;
}

function toLawyerConsultation(
  row: ConsultationRow,
  client: ClientProfileEmbed | null,
  lawyer: LawyerSelfRow | null = null,
  platformFee: number = DEFAULT_PLATFORM_FEE
): LawyerConsultation {
  const { meta, date, range, displayDate, timeSlot } = scheduleOf(row);
  const paymentDetails = paymentOf(row, meta, range, Number(lawyer?.fee_standard_60min ?? 0), platformFee);
  const status = toLawyerStatus(row.status, paymentDetails.state);
  const legacyPayment = meta.payment && typeof meta.payment === 'object' ? meta.payment : null;

  return {
    id: row.id,
    rawStatus: row.status,
    status,
    statusLabel: LAWYER_STATUS_LABELS[status],
    dateTag: displayDate,
    timeTag: timeSlot,
    day: date.day,
    month: date.monthIndex,
    year: date.year,
    scheduledStart: row.scheduled_start,
    communicationMode: row.method === 'audio' ? 'audio' : 'video',
    clientId: row.client_id,
    client: {
      name: client?.full_name?.trim() || legacyPayment?.payerName || client?.email || 'Client',
      age: null,
      sex: null,
      address: null,
      email: client?.email || '—',
      phone: client?.phone || null,
    },
    subjectCategory: 'SUBJECT MATTER & CASE DOCKET',
    subjectTitle: meta.subject || 'Legal Consultation',
    caseDescription: meta.description || 'No additional details were provided for this consultation.',
    fee: Number(meta.fee ?? 0) || 0,
    attachedFiles: sharedDocsFromMeta(meta),
    meetingLink: row.meeting_url ?? null,
    declineReason: typeof meta.declineReason === 'string' ? meta.declineReason : null,
    cancellationReason: typeof meta.cancellationReason === 'string' ? meta.cancellationReason : null,
    ...summaryOf(date, range),
    lawyerSummary: {
      name: lawyer?.full_name || meta.lawyerName || 'Attorney',
      rollNumber: lawyer?.roll_number || '—',
      ibpChapter: lawyer?.ibp_chapter || '—',
    },
    paymentDetails,
    reschedule: rescheduleInfoOf(row, meta, 'lawyer'),
  };
}

/** Session for a signed-in lawyer (must own a lawyer_profiles row). */
/**
 * Adds each client's city/province and contact preference (profile fields the client chose to
 * share) to the lawyer's consultations. Only clients the lawyer has a consultation with are read.
 * Skipped silently before supabase/manual/007_profile_fields.sql has been run.
 */
async function attachClientPreferences(db: Db, items: LawyerConsultation[]): Promise<void> {
  const ids = [...new Set(items.map((i) => i.clientId).filter(Boolean))];
  if (ids.length === 0) return;
  const { data, error } = await db
    .from('profiles')
    .select('user_id, city_province, contact_method, contact_time, consultation_language')
    .in('user_id', ids);
  if (error) return;
  const byId = new Map(
    ((data ?? []) as Array<{ user_id: string; city_province: string | null; contact_method: string | null; contact_time: string | null; consultation_language: string | null }>).map((p) => [p.user_id, p])
  );
  for (const item of items) {
    const p = byId.get(item.clientId);
    if (!p) continue;
    const line = [
      p.city_province,
      contactPreferenceLine({ contactMethod: p.contact_method as never, contactTime: p.contact_time as never, preferredLanguage: p.consultation_language }),
    ].filter(Boolean).join('  |  ');
    item.client.contactPreference = line || null;
  }
}

async function requireLawyerSession(): Promise<(Session & { lawyerName: string }) | { error: string }> {
  const session = await requireSession();
  if ('error' in session) return session;
  const { data: lawyer } = await session.db
    .from('lawyer_profiles')
    .select('user_id, full_name')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!lawyer) return { error: 'Only registered attorneys can manage consultation requests.' };
  return { ...session, lawyerName: lawyer.full_name || session.profile.full_name || 'Your attorney' };
}

const CLIENT_EMBED = 'client:profiles!consultations_client_id_fkey(full_name, email, phone)';

/**
 * All consultations booked with the signed-in lawyer.
 * Order: pending requests first (soonest first), then upcoming approved ones,
 * then everything else (most recent first).
 */
export async function getLawyerConsultationsAction(): Promise<LawyerConsultation[]> {
  try {
    const session = await requireLawyerSession();
    if ('error' in session) return [];
    const { db, user } = session;

    const { data, error } = await db
      .from('consultations')
      .select(`${CONSULTATION_COLUMNS}, ${CLIENT_EMBED}`)
      .eq('lawyer_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[getLawyerConsultationsAction]', error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<ConsultationRow & { client: ClientProfileEmbed | null }>;
    const { data: self } = await db
      .from('lawyer_profiles')
      .select('full_name, roll_number, ibp_chapter, fee_standard_60min')
      .eq('user_id', user.id)
      .maybeSingle();
    const platformFee = await getPlatformFee(db);
    const now = Date.now();
    const items = rows.map((row) => ({
      item: toLawyerConsultation(row, row.client, self as LawyerSelfRow | null, platformFee),
      startMs: scheduleOf(row).startMs,
    }));
    await attachClientPreferences(db, items.map((i) => i.item));

    const rank = ({ item, startMs }: { item: LawyerConsultation; startMs: number }) => {
      if (item.status === 'pending') return 0;
      if (item.status === 'payment_review') return 0;
      if ((item.status === 'pending_payment' || item.status === 'confirmed') && startMs >= now) return 1;
      return 2;
    };
    items.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return ra === 2 ? b.startMs - a.startMs : a.startMs - b.startMs;
    });
    return items.map((i) => i.item);
  } catch (err) {
    console.error('[getLawyerConsultationsAction] catch:', err);
    return [];
  }
}

/**
 * Lawyer approves or declines a pending consultation request.
 *  - approved → status "pending payment" (awaiting_client_confirmation); the
 *    client is notified and a private message thread is opened.
 *  - rejected → status "declined" with the lawyer's reason; the client is
 *    notified with the reason and access to shared documents is revoked.
 */
export async function respondToConsultationAction(
  consultationId: string,
  response: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<{ success: true; newStatus: LawyerConsultationStatus } | { success?: false; error: string }> {
  try {
    if (!UUID_REGEX.test(consultationId ?? '')) return { error: 'Consultation not found.' };
    if (response !== 'approved' && response !== 'rejected') return { error: 'Invalid response.' };

    const reason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
    if (response === 'rejected') {
      if (reason.length < 5) return { error: 'Please provide a reason for declining (at least 5 characters).' };
      if (reason.length > 1000) return { error: 'The reason must be 1000 characters or fewer.' };
    }

    const session = await requireLawyerSession();
    if ('error' in session) return { error: session.error };
    const { db, user, lawyerName } = session;

    const { data: found, error: fetchErr } = await db
      .from('consultations')
      .select(CONSULTATION_COLUMNS)
      .eq('id', consultationId)
      .eq('lawyer_id', user.id)
      .maybeSingle();
    if (fetchErr || !found) return { error: 'Consultation not found.' };

    const consultation = found as ConsultationRow;
    if (consultation.status !== 'pending') {
      return { error: 'This consultation is no longer awaiting your approval. Please refresh the page.' };
    }

    const schedule = scheduleOf(consultation);
    const when = `${schedule.displayDate.replace('TODAY, ', '')} (${schedule.timeSlot})`;
    const meta = { ...schedule.meta };
    const nowIso = new Date().toISOString();

    if (response === 'approved') {
      if (schedule.startMs <= Date.now()) {
        return { error: 'The scheduled time for this request has already passed. Please decline it instead.' };
      }
      meta.approvedAt = nowIso;
    } else {
      meta.declineReason = reason;
      meta.declinedAt = nowIso;
    }

    const newRawStatus = response === 'approved' ? 'awaiting_client_confirmation' : 'declined';
    const { data: updated, error: updateErr } = await db
      .from('consultations')
      .update({ status: newRawStatus, concern_summary: JSON.stringify(meta), updated_at: nowIso })
      .eq('id', consultationId)
      .eq('lawyer_id', user.id)
      .eq('status', 'pending')
      .select('id');
    if (updateErr || !updated || updated.length === 0) {
      if (updateErr) console.error('[respondToConsultationAction] update failed:', updateErr.message);
      return { error: 'We could not update this consultation. Please refresh and try again.' };
    }

    if (response === 'approved') {
      await postSystemMessage(
        db,
        consultationId,
        user.id,
        `${lawyerName} approved this consultation for ${when}. Please complete the payment to confirm your booking. You can exchange messages here.`
      );
      await notifyUser(
        db,
        consultation.client_id,
        'consultation_approved',
        'Consultation Approved — Pending Payment',
        `${lawyerName} approved your consultation on ${when}. Please complete the payment to confirm your booking. You can now message the attorney in the Messages tab.`,
        { consultationId, lawyerId: user.id, status: 'pending_payment' }
      );
    } else {
      await revokeSharedDocuments(db, consultation);
      await notifyUser(
        db,
        consultation.client_id,
        'consultation_declined',
        'Consultation Request Declined',
        `${lawyerName} declined your consultation request for ${when}. Reason: ${reason}`,
        { consultationId, lawyerId: user.id, status: 'declined', reason }
      );
    }

    revalidateConsultationPaths();
    revalidatePath('/client/messages');
    revalidatePath('/lawyer/messages');
    signalLive([user.id, consultation.client_id], ['consultations', 'messages', 'documents']);
    return { success: true, newStatus: response === 'approved' ? 'pending_payment' : 'declined' };
  } catch (err) {
    console.error('[respondToConsultationAction] error:', err);
    return { error: 'Something went wrong while updating the consultation. Please try again.' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGING (client ⇄ lawyer)
// Each consultation is one private thread: messages.conversation_or_thread_id
// = consultations.id, and participants are that consultation's client & lawyer.
// ═════════════════════════════════════════════════════════════════════════════

/** Statuses during which the client and lawyer may exchange messages. */
const MESSAGING_STATUSES = ['pending', 'awaiting_client_confirmation', 'confirmed', 'completed'];
const MAX_MESSAGE_LENGTH = 4000;

/**
 * One conversation per client ⇄ lawyer pair (not per booking).
 * `id` is the other participant's user id; `consultationIds` are every consultation between
 * the two, so deep links that still carry a consultation id (?thread=<consultationId>) resolve.
 */
export interface MessageThreadItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  consultationIds?: string[];
}

export interface ThreadMessage {
  id: string;
  sender: 'me' | 'them' | 'system';
  content: string;
  time: string;
}

interface MessageRow {
  id: string;
  conversation_or_thread_id: string;
  sender_id: string;
  role: string | null;
  content: string;
  sent_at: string;
}

function formatMessageTime(iso: string, withDate = false): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Manila' });
  if (!withDate) return time;
  const sameDay = toManilaParts(iso).isoDate === todayInManila();
  return sameDay ? time : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}

function toThreadMessage(m: MessageRow, currentUserId: string): ThreadMessage {
  return {
    id: m.id,
    sender: m.role === 'system' ? 'system' : m.sender_id === currentUserId ? 'me' : 'them',
    content: m.content,
    time: formatMessageTime(m.sent_at),
  };
}

/** messages.sender_id references user_accounts; backfill it for newer accounts. */
async function ensureUserAccount(db: Db, profile: ProfileRow): Promise<boolean> {
  const { data } = await db.from('user_accounts').select('id').eq('id', profile.user_id).maybeSingle();
  if (data) return true;
  const { error } = await db.from('user_accounts').upsert(
    { id: profile.user_id, email: profile.email, full_name: profile.full_name, role: profile.role },
    { onConflict: 'id' }
  );
  if (error) console.warn('[ensureUserAccount]', error.message);
  return !error;
}

interface PairThread {
  otherId: string;
  /** Every consultation between the two users, oldest first. */
  consultations: ConsultationRow[];
}

/**
 * Resolves a conversation for the signed-in user. `threadId` may be the other participant's
 * user id (pair thread) or any consultation id between them (legacy / deep links).
 */
async function getPairThread(db: Db, threadId: string, userId: string): Promise<PairThread | null> {
  if (!UUID_REGEX.test(threadId ?? '')) return null;

  let otherId = threadId;
  const { data: byConsultation } = await db
    .from('consultations')
    .select('id, client_id, lawyer_id')
    .eq('id', threadId)
    .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
    .maybeSingle();
  if (byConsultation) {
    otherId = byConsultation.client_id === userId ? byConsultation.lawyer_id : byConsultation.client_id;
  }
  if (!UUID_REGEX.test(otherId) || otherId === userId) return null;

  const { data, error } = await db
    .from('consultations')
    .select(CONSULTATION_COLUMNS)
    .or(`and(client_id.eq.${userId},lawyer_id.eq.${otherId}),and(client_id.eq.${otherId},lawyer_id.eq.${userId})`)
    .order('created_at', { ascending: true });
  if (error || !data || data.length === 0) return null;
  return { otherId, consultations: data as ConsultationRow[] };
}

/** The consultation new messages are filed under: the latest active one, else the latest messageable one. */
function messageTargetConsultation(pair: PairThread): ConsultationRow | null {
  const byNewest = [...pair.consultations].reverse();
  return (
    byNewest.find((c) => ACTIVE_BOOKING_STATUSES.includes(c.status)) ??
    byNewest.find((c) => MESSAGING_STATUSES.includes(c.status)) ??
    null
  );
}

async function postSystemMessage(db: Db, threadId: string, senderId: string, content: string): Promise<void> {
  const { error } = await db.from('messages').insert({
    conversation_or_thread_id: threadId,
    sender_id: senderId,
    role: 'system',
    content,
    attachment_ids: [],
    citations: null,
  });
  if (error) console.warn('[postSystemMessage]', error.message);
}

/**
 * Conversations for the signed-in user (client or lawyer): one per client ⇄ lawyer pair,
 * combining every consultation between them. A pair is listed while at least one of their
 * consultations is active or completed (from pending onward). Status updates posted as system
 * messages on any of those consultations appear in the single conversation.
 */
export async function getMessageThreadsAction(): Promise<MessageThreadItem[]> {
  try {
    const session = await requireSession();
    if ('error' in session) return [];
    const { db, user } = session;

    const { data, error } = await db
      .from('consultations')
      .select(`${CONSULTATION_COLUMNS}, lawyer_profiles(full_name), ${CLIENT_EMBED}`)
      .or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[getMessageThreadsAction]', error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<
      ConsultationRow & { lawyer_profiles: { full_name: string } | null; client: ClientProfileEmbed | null }
    >;
    if (rows.length === 0) return [];

    // Group consultations by the other participant.
    const pairs = new Map<string, { name: string; rows: typeof rows; messageable: boolean }>();
    for (const r of rows) {
      const isLawyer = r.lawyer_id === user.id;
      const otherId = isLawyer ? r.client_id : r.lawyer_id;
      if (!otherId || otherId === user.id) continue;
      const name = isLawyer
        ? r.client?.full_name?.trim() || r.client?.email || 'Client'
        : r.lawyer_profiles?.full_name || 'Attorney';
      const pair = pairs.get(otherId) ?? { name, rows: [], messageable: false };
      pair.rows.push(r);
      pair.messageable ||= MESSAGING_STATUSES.includes(r.status);
      pairs.set(otherId, pair);
    }
    const visible = [...pairs.entries()].filter(([, p]) => p.messageable);
    if (visible.length === 0) return [];

    const consultationToPair = new Map<string, string>();
    for (const [otherId, p] of visible) for (const r of p.rows) consultationToPair.set(r.id, otherId);

    const { data: msgs } = await db
      .from('messages')
      .select('id, conversation_or_thread_id, sender_id, role, content, sent_at')
      .in('conversation_or_thread_id', [...consultationToPair.keys()])
      .order('sent_at', { ascending: false })
      .limit(2000);
    const latest = new Map<string, MessageRow>();
    for (const m of (msgs ?? []) as MessageRow[]) {
      const otherId = consultationToPair.get(m.conversation_or_thread_id);
      if (otherId && !latest.has(otherId)) latest.set(otherId, m);
    }

    return visible
      .map(([otherId, p]) => {
        const newest = p.rows[0]; // rows are newest-first
        const last = latest.get(otherId);
        return {
          sortKey: last ? new Date(last.sent_at).getTime() : new Date(newest.created_at).getTime(),
          item: {
            id: otherId,
            name: p.name,
            lastMessage: last
              ? `${last.role !== 'system' && last.sender_id === user.id ? 'You: ' : ''}${last.content}`
              : `${scheduleOf(newest).meta.subject || 'Consultation'} — no messages yet`,
            time: last ? formatMessageTime(last.sent_at, true) : 'New',
            consultationIds: p.rows.map((r) => r.id),
          },
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey)
      .map((t) => t.item);
  } catch (err) {
    console.error('[getMessageThreadsAction] catch:', err);
    return [];
  }
}

/** All messages between the signed-in user and the other participant, across all their consultations. */
export async function getMessagesForThreadAction(threadId: string): Promise<ThreadMessage[]> {
  try {
    const session = await requireSession();
    if ('error' in session) return [];
    const { db, user } = session;

    const pair = await getPairThread(db, threadId, user.id);
    if (!pair) return [];

    const { data, error } = await db
      .from('messages')
      .select('id, conversation_or_thread_id, sender_id, role, content, sent_at')
      .in('conversation_or_thread_id', pair.consultations.map((c) => c.id))
      .order('sent_at', { ascending: true });
    if (error || !data) return [];
    return (data as MessageRow[]).map((m) => toThreadMessage(m, user.id));
  } catch (err) {
    console.error('[getMessagesForThreadAction] error:', err);
    return [];
  }
}

/** Sends a private message from the signed-in client or lawyer. */
export async function sendDirectMessageAction(
  threadId: string,
  content: string
): Promise<{ success: true; message: ThreadMessage } | { success?: false; error: string }> {
  try {
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) return { error: 'Message cannot be empty.' };
    if (text.length > MAX_MESSAGE_LENGTH) {
      return { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` };
    }

    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user, profile } = session;
    const messageLimited = await checkRateLimit('message_send', user.id);
    if (messageLimited) return { error: messageLimited };

    const pair = await getPairThread(db, threadId, user.id);
    if (!pair) return { error: 'Conversation not found.' };
    const target = messageTargetConsultation(pair);
    if (!target) {
      return { error: 'This consultation is closed, so new messages can no longer be sent.' };
    }
    const thread = { consultation: target, role: (target.lawyer_id === user.id ? 'lawyer' : 'client') as 'lawyer' | 'client' };
    if (!(await ensureUserAccount(db, profile))) {
      return { error: 'We could not verify your account for messaging. Please sign in again.' };
    }

    const { data, error } = await db
      .from('messages')
      .insert({
        // Messages are filed under a consultation; the conversation view merges all of the pair's consultations.
        conversation_or_thread_id: target.id,
        sender_id: user.id,
        // messages.role is constrained to user | assistant | system; the sender is identified by sender_id.
        role: 'user',
        content: text,
        attachment_ids: [],
        citations: null,
      })
      .select('id, conversation_or_thread_id, sender_id, role, content, sent_at')
      .single();
    if (error || !data) {
      console.error('[sendDirectMessageAction] insert failed:', error?.message);
      return { error: 'Your message could not be sent. Please try again.' };
    }

    // Notify the other participant, at most one unread message notification per thread.
    const recipientId = thread.role === 'lawyer' ? thread.consultation.client_id : thread.consultation.lawyer_id;
    const { data: unread } = await db
      .from('notifications')
      .select('id')
      .eq('user_id', recipientId)
      .eq('type', 'new_message')
      .eq('is_read', false)
      // From the recipient's side, the conversation id is the sender's user id.
      .eq('metadata->>threadId', user.id)
      .limit(1);
    if (!unread || unread.length === 0) {
      await notifyUser(
        db,
        recipientId,
        'new_message',
        `New message from ${profile.full_name || (thread.role === 'lawyer' ? 'your attorney' : 'your client')}`,
        text.length > 140 ? `${text.slice(0, 137)}...` : text,
        { threadId: user.id, consultationId: target.id, senderId: user.id }
      );
    }

    revalidatePath('/client/messages');
    revalidatePath('/lawyer/messages');
    signalLive([user.id, recipientId], ['messages']);
    return { success: true, message: toThreadMessage(data as MessageRow, user.id) };
  } catch (err) {
    console.error('[sendDirectMessageAction] error:', err);
    return { error: 'Your message could not be sent. Please try again.' };
  }
}

// ─── Conversation banners: upcoming meeting & rate-your-lawyer prompt ─────────

/** The meeting announcement appears this long before the scheduled start (and stays until it ends). */
const MEETING_LEAD_MS = 15 * 60 * 1000;

export interface ThreadMeetingAnnouncement {
  consultationId: string;
  startsAt: string;
  endsAt: string;
  /** e.g. "Today · 2:00 PM - 3:00 PM" */
  scheduleLabel: string;
  method: 'video' | 'audio';
  meetingUrl: string | null;
  subject: string;
}

export interface ThreadRatePrompt {
  consultationId: string;
  lawyerName: string;
  dateLabel: string;
}

export interface ThreadContext {
  meeting: ThreadMeetingAnnouncement | null;
  ratePrompt: ThreadRatePrompt | null;
}

function consultationWindow(row: ConsultationRow): { start: number; end: number } | null {
  if (!row.scheduled_start) return null;
  const start = new Date(row.scheduled_start).getTime();
  const end = row.scheduled_end ? new Date(row.scheduled_end).getTime() : start + 60 * 60 * 1000;
  return Number.isFinite(start) ? { start, end: end > start ? end : start + 60 * 60 * 1000 } : null;
}

const isMeetingWindow = (w: { start: number; end: number }, now: number) =>
  now >= w.start - MEETING_LEAD_MS && now < w.end;

/**
 * Creates a one-time "meeting starting soon" bell notification for each of the user's confirmed
 * consultations that start within 15 minutes (or are in progress). Runs lazily whenever the
 * user's notifications or conversations are loaded, so no scheduler is required.
 */
async function ensureMeetingNotifications(db: Db, userId: string): Promise<void> {
  try {
    const now = Date.now();
    const { data } = await db
      .from('consultations')
      .select(`${CONSULTATION_COLUMNS}, lawyer_profiles(full_name), ${CLIENT_EMBED}`)
      .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
      .eq('status', 'confirmed')
      .gte('scheduled_start', new Date(now - 6 * 60 * 60 * 1000).toISOString())
      .lte('scheduled_start', new Date(now + MEETING_LEAD_MS).toISOString());
    const due = ((data ?? []) as unknown as Array<
      ConsultationRow & { lawyer_profiles: { full_name: string } | null; client: ClientProfileEmbed | null }
    >).filter((r) => {
      const w = consultationWindow(r);
      return !!w && isMeetingWindow(w, now);
    });
    if (due.length === 0) return;

    const { data: existing } = await db
      .from('notifications')
      .select('metadata')
      .eq('user_id', userId)
      .eq('type', 'meeting_starting')
      .in('metadata->>consultationId', due.map((r) => r.id));
    // Keyed by start time too, so a rescheduled session gets its own reminder.
    const notifiedKeys = new Set(
      ((existing ?? []) as Array<{ metadata: { consultationId?: string; scheduledStart?: string } | null }>).map(
        (n) => `${n.metadata?.consultationId}|${n.metadata?.scheduledStart ? new Date(n.metadata.scheduledStart).getTime() : 'any'}`
      )
    );

    for (const r of due) {
      const startKey = new Date(r.scheduled_start!).getTime();
      if (notifiedKeys.has(`${r.id}|any`) && !scheduleOf(r).meta.rescheduledAt) continue;
      if (notifiedKeys.has(`${r.id}|${startKey}`)) continue;
      const isLawyer = r.lawyer_id === userId;
      const other = isLawyer
        ? r.client?.full_name?.trim() || 'your client'
        : r.lawyer_profiles?.full_name || 'your attorney';
      const w = consultationWindow(r)!;
      const minutes = Math.max(0, Math.round((w.start - now) / 60000));
      const when = minutes > 0 ? `starts in ${minutes} minute${minutes === 1 ? '' : 's'}` : 'has started';
      const otherId = isLawyer ? r.client_id : r.lawyer_id;
      const startLabel = formatClock(toManilaParts(r.scheduled_start!).minutes);
      const endLabel = formatClock(toManilaParts(new Date(w.end).toISOString()).minutes);
      await notifyUser(
        db,
        userId,
        'meeting_starting',
        'Consultation starting soon',
        `Your ${r.method === 'audio' ? 'audio call' : 'video consultation'} with ${other} ${when} (${startLabel} - ${endLabel}). Open Messages to join the meeting.`,
        { consultationId: r.id, threadId: otherId, meetingUrl: r.meeting_url, scheduledStart: r.scheduled_start }
      );
    }
  } catch (err) {
    console.warn('[ensureMeetingNotifications]', err);
  }
}

/**
 * Banners for a conversation:
 *  - meeting: a confirmed consultation between the pair that starts within 15 minutes or is in
 *    progress (with its Google Meet link to join);
 *  - ratePrompt (clients only): the latest finished consultation with this lawyer that the client
 *    hasn't rated yet.
 */
export async function getThreadContextAction(threadId: string): Promise<ThreadContext> {
  const empty: ThreadContext = { meeting: null, ratePrompt: null };
  try {
    const session = await requireSession();
    if ('error' in session) return empty;
    const { db, user } = session;

    const pair = await getPairThread(db, threadId, user.id);
    if (!pair) return empty;
    const now = Date.now();

    // ── Upcoming / live meeting ──
    let meeting: ThreadMeetingAnnouncement | null = null;
    const live = pair.consultations
      .filter((c) => c.status === 'confirmed')
      .map((c) => ({ c, w: consultationWindow(c) }))
      .filter((x): x is { c: ConsultationRow; w: { start: number; end: number } } => !!x.w && isMeetingWindow(x.w, now))
      .sort((a, b) => a.w.start - b.w.start)[0];
    if (live) {
      if (accountPreferences(user.user_metadata).notifications.reminders) await ensureMeetingNotifications(db, user.id);
      const schedule = scheduleOf(live.c);
      const startParts = toManilaParts(live.c.scheduled_start!);
      const endParts = toManilaParts(new Date(live.w.end).toISOString());
      const dayLabel = startParts.isoDate === todayInManila()
        ? 'Today'
        : `${MONTH_NAMES[schedule.date.monthIndex]} ${schedule.date.day}`;
      meeting = {
        consultationId: live.c.id,
        startsAt: new Date(live.w.start).toISOString(),
        endsAt: new Date(live.w.end).toISOString(),
        scheduleLabel: `${dayLabel} · ${formatClock(startParts.minutes)} - ${formatClock(endParts.minutes)}`,
        method: live.c.method === 'audio' ? 'audio' : 'video',
        meetingUrl: live.c.meeting_url || null,
        subject: schedule.meta.subject || 'Consultation',
      };
    }

    // ── Rate this lawyer (client side only) ──
    let ratePrompt: ThreadRatePrompt | null = null;
    const finished = pair.consultations
      .filter((c) => c.client_id === user.id)
      .filter((c) => {
        if (c.status === 'completed') return true;
        const w = consultationWindow(c);
        return c.status === 'confirmed' && !!w && w.end <= now;
      })
      .sort((a, b) => (consultationWindow(b)?.end ?? 0) - (consultationWindow(a)?.end ?? 0));
    if (finished.length > 0) {
      const { data: reviewed } = await db
        .from('reviews')
        .select('consultation_id')
        .eq('client_id', user.id)
        .in('consultation_id', finished.map((c) => c.id));
      const ratedIds = new Set(((reviewed ?? []) as Array<{ consultation_id: string }>).map((r) => r.consultation_id));
      const unrated = finished.find((c) => !ratedIds.has(c.id));
      if (unrated) {
        const { data: lawyer } = await db
          .from('lawyer_profiles')
          .select('full_name')
          .eq('user_id', unrated.lawyer_id)
          .maybeSingle();
        const schedule = scheduleOf(unrated);
        ratePrompt = {
          consultationId: unrated.id,
          lawyerName: lawyer?.full_name || 'your attorney',
          dateLabel: `${MONTH_NAMES[schedule.date.monthIndex]} ${schedule.date.day}, ${schedule.date.year}`,
        };
      }
    }

    return { meeting, ratePrompt };
  } catch (err) {
    console.error('[getThreadContextAction]', err);
    return empty;
  }
}

/** In-app notifications of the signed-in user only. */
export async function getUserNotificationsAction(
  // Kept for call-site compatibility; notifications are always scoped to the session user.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _role: 'client' | 'lawyer' = 'client'
) {
  try {
    const session = await requireSession();
    if ('error' in session) return [];
    const { db, user } = session;

    // Reminders on the bell: 24 hours and 1 hour before, and "starting soon" 15 minutes before a
    // confirmed meeting. Created lazily here, only when the user wants reminders.
    const { notifications: choices } = accountPreferences(user.user_metadata);
    if (choices.reminders) {
      await ensureConsultationReminders(db, user.id);
      await ensureMeetingNotifications(db, user.id);
    }

    let notificationQuery = db
      .from('notifications')
      .select('id, type, title, body, created_at, is_read, metadata')
      .eq('user_id', user.id);
    // Keep history intact, but respect the user's category choices before pagination.
    // Account, security, moderation and verification notices are never filtered out.
    if (!choices.consultations) notificationQuery = notificationQuery.not('type', 'like', 'consultation_%');
    if (!choices.payments) notificationQuery = notificationQuery.not('type', 'like', 'payment_%');
    if (!choices.messages) notificationQuery = notificationQuery.neq('type', 'new_message');
    if (!choices.reminders) notificationQuery = notificationQuery.neq('type', 'meeting_starting').not('type', 'like', 'reminder_%');
    const { data, error } = await notificationQuery
      .order('created_at', { ascending: false })
      .limit(15);
    if (error) {
      console.error('[getUserNotificationsAction]', error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[getUserNotificationsAction] catch:', err);
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PAYMENT (manual QR payment with proof of payment, verified by the lawyer)
//
// Flow: lawyer approves → PENDING PAYMENT → client uploads proof
//       → PAYMENT UNDER REVIEW (lawyer: "payment for review")
//       → lawyer confirms (adds Google Meet link) → CONFIRMED
//       → or lawyer declines the proof (with reason) → back to PENDING PAYMENT.
// The consultation row stays `awaiting_client_confirmation` until confirmed; the
// review state lives in concern_summary.paymentProof and is mirrored to
// public.payments (pending → paid / failed).
// ═════════════════════════════════════════════════════════════════════════════

/** QR code and account shown to clients on the payment modal (platform_settings key: payment_qr). */
export async function getPaymentChannelAction(): Promise<PaymentChannel> {
  try {
    const session = await requireSession();
    if ('error' in session) return { qrImageUrl: null, caption: null };
    const { data } = await session.db
      .from('platform_settings')
      .select('value')
      .eq('key', 'payment_qr')
      .maybeSingle();
    const value = (data?.value ?? null) as
      | { imageUrl?: string; channel?: string; accountName?: string; accountNumber?: string }
      | null;
    if (!value) return { qrImageUrl: null, caption: null };
    const caption = [value.channel, value.accountName, value.accountNumber].filter(Boolean).join(' • ');
    return {
      qrImageUrl: typeof value.imageUrl === 'string' && value.imageUrl ? value.imageUrl : null,
      caption: caption || null,
    };
  } catch (err) {
    console.error('[getPaymentChannelAction]', err);
    return { qrImageUrl: null, caption: null };
  }
}

/**
 * Client submits proof of payment for an approved (pending payment) booking.
 * FormData fields: `consultationId`, `file` (PNG, JPG or PDF).
 */
export async function submitPaymentProofAction(
  formData: FormData
): Promise<{ success: true; consultation: ClientConsultation } | { success?: false; error: string }> {
  try {
    const consultationId = String(formData.get('consultationId') ?? '');
    const file = formData.get('file');
    if (!UUID_REGEX.test(consultationId)) return { error: 'Consultation not found.' };
    if (!(file instanceof File) || file.size === 0) return { error: 'Please attach your proof of payment.' };
    if (file.size > MAX_UPLOAD_BYTES) {
      return { error: `The file is larger than ${formatBytes(MAX_UPLOAD_BYTES)}. Please upload a smaller screenshot or PDF.` };
    }
    const ext = fileExtension(file.name);
    if (!PAYMENT_PROOF_EXTENSIONS.has(ext)) {
      return { error: 'Proof of payment must be a PNG, JPG or PDF file.' };
    }

    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user, profile } = session;
    const proofLimited = await checkRateLimit('upload', user.id);
    if (proofLimited) return { error: proofLimited };
    if (!(await fileMatchesExtension(file, ext))) return { error: FILE_CONTENT_MISMATCH };

    const { data: found } = await db
      .from('consultations')
      .select(`${CONSULTATION_COLUMNS}, lawyer_profiles(${LAWYER_SUMMARY_COLUMNS})`)
      .eq('id', consultationId)
      .eq('client_id', user.id)
      .maybeSingle();
    if (!found) return { error: 'Consultation not found.' };
    const consultation = found as unknown as ConsultationRow & { lawyer_profiles: LawyerSummaryRow | null };

    if (consultation.status !== 'awaiting_client_confirmation') {
      return { error: 'Payment can only be submitted after the attorney approves your booking.' };
    }
    const platformFee = await getPlatformFee(db);
    const current = toClientConsultation(consultation, consultation.lawyer_profiles, platformFee);
    if (current.payment.state === 'submitted') {
      return { error: 'Your proof of payment is already under review by the attorney.' };
    }
    if (current.payment.state === 'verified') return { error: 'This booking is already paid.' };
    if (consultation.scheduled_start && new Date(consultation.scheduled_start).getTime() <= Date.now()) {
      return { error: 'The scheduled time for this booking has already passed. Please message the attorney.' };
    }

    // Store the proof privately in the client's vault and share it with the lawyer.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const storagePath = `${user.id}/payments/${consultationId}/${randomUUID()}-${safeName}`;
    const mimeType = file.type || 'application/octet-stream';
    const { error: uploadErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, { contentType: mimeType, upsert: false });
    if (uploadErr) {
      console.error('[submitPaymentProofAction] upload failed:', uploadErr.message);
      return { error: 'We could not upload your proof of payment. Please try again.' };
    }
    const { data: doc, error: docErr } = await db
      .from('documents')
      .insert({
        owner_id: user.id,
        filename: file.name.slice(0, 180),
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        visibility_scope: 'private',
      })
      .select('id')
      .single();
    if (docErr || !doc) {
      await db.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      console.error('[submitPaymentProofAction] document insert failed:', docErr?.message);
      return { error: 'We could not save your proof of payment. Please try again.' };
    }
    await grantDocumentAccess(db, [doc.id], consultation.lawyer_id, user.id);

    const meta = parseMeta(consultation.concern_summary);
    const previous = meta.paymentProof && typeof meta.paymentProof === 'object' ? meta.paymentProof : null;
    const nowIso = new Date().toISOString();
    const nextMeta = {
      ...meta,
      platformFee: typeof meta.platformFee === 'number' ? meta.platformFee : platformFee,
      paymentProof: {
        status: 'submitted',
        documentId: doc.id,
        fileName: file.name.slice(0, 180),
        mimeType,
        sizeBytes: file.size,
        submittedAt: nowIso,
      },
      paymentProofHistory: previous
        ? [...(Array.isArray(meta.paymentProofHistory) ? meta.paymentProofHistory : []), previous]
        : meta.paymentProofHistory,
    };

    const { data: updated, error: updateErr } = await db
      .from('consultations')
      .update({ concern_summary: JSON.stringify(nextMeta), updated_at: nowIso })
      .eq('id', consultationId)
      .eq('client_id', user.id)
      .eq('status', 'awaiting_client_confirmation')
      .select(CONSULTATION_COLUMNS)
      .single();
    if (updateErr || !updated) {
      console.error('[submitPaymentProofAction] update failed:', updateErr?.message);
      return { error: 'We could not record your payment. Please refresh and try again.' };
    }

    const result = toClientConsultation(updated as ConsultationRow, consultation.lawyer_profiles, platformFee);
    await syncPaymentLedger(db, updated as ConsultationRow, result.payment, 'pending');

    const when = `${result.dateStr.replace('TODAY, ', '')} (${result.timeSlot})`;
    await postSystemMessage(
      db,
      consultationId,
      user.id,
      `${profile.full_name || 'The client'} submitted a proof of payment (₱${result.payment.total.toLocaleString()}) for the consultation on ${when}. Awaiting the attorney's verification.`
    );
    await notifyUser(
      db,
      consultation.lawyer_id,
      'payment_submitted',
      'Payment Submitted for Review',
      `${profile.full_name || 'Your client'} submitted a proof of payment for the consultation on ${when}. Please review and confirm it.`,
      { consultationId, clientId: user.id, documentId: doc.id }
    );
    // Payment trail (append-only): who submitted which proof for which booking.
    await writeAuditLog({
      actorId: user.id,
      action: 'payment.proof_submitted',
      targetType: 'consultation',
      targetId: consultationId,
      details: { document_id: doc.id, size_bytes: file.size },
    });

    revalidateConsultationPaths();
    signalLive([user.id, consultation.lawyer_id], ['consultations', 'payments', 'documents', 'messages']);
    return { success: true, consultation: result };
  } catch (err) {
    console.error('[submitPaymentProofAction] error:', err);
    return { error: 'Something went wrong while submitting your payment. Please try again.' };
  }
}

/**
 * Lawyer reviews a submitted proof of payment.
 *  - confirm → booking CONFIRMED with the Google Meet link (required).
 *  - reject  → proof declined with a reason; the client may upload a new one.
 */
export async function reviewPaymentAction(
  consultationId: string,
  decision: 'confirm' | 'reject',
  input: { meetingLink?: string; reason?: string } = {}
): Promise<{ success: true; newStatus: LawyerConsultationStatus } | { success?: false; error: string }> {
  try {
    if (!UUID_REGEX.test(consultationId ?? '')) return { error: 'Consultation not found.' };
    if (decision !== 'confirm' && decision !== 'reject') return { error: 'Invalid decision.' };

    const meetingLink = typeof input.meetingLink === 'string' ? input.meetingLink.trim() : '';
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (decision === 'confirm' && !GOOGLE_MEET_REGEX.test(meetingLink)) {
      return { error: 'Please enter a Google Meet link that starts with https://meet.google.com' };
    }
    if (decision === 'reject') {
      if (reason.length < 5) return { error: 'Please provide a reason for declining (at least 5 characters).' };
      if (reason.length > 1000) return { error: 'The reason must be 1000 characters or fewer.' };
    }

    const session = await requireLawyerSession();
    if ('error' in session) return { error: session.error };
    const { db, user, lawyerName } = session;

    const { data: found } = await db
      .from('consultations')
      .select(CONSULTATION_COLUMNS)
      .eq('id', consultationId)
      .eq('lawyer_id', user.id)
      .maybeSingle();
    if (!found) return { error: 'Consultation not found.' };
    const consultation = found as ConsultationRow;

    const platformFee = await getPlatformFee(db);
    const schedule = scheduleOf(consultation);
    const payment = paymentOf(consultation, schedule.meta, schedule.range, 0, platformFee);
    if (consultation.status !== 'awaiting_client_confirmation' || payment.state !== 'submitted') {
      return { error: 'There is no payment waiting for your review. Please refresh the page.' };
    }

    const nowIso = new Date().toISOString();
    const when = `${schedule.displayDate.replace('TODAY, ', '')} (${schedule.timeSlot})`;
    const meta = {
      ...schedule.meta,
      paymentProof: {
        ...schedule.meta.paymentProof,
        status: decision === 'confirm' ? 'verified' : 'rejected',
        reviewedAt: nowIso,
        ...(decision === 'reject' ? { rejectionReason: reason } : {}),
      },
      ...(decision === 'confirm' ? { confirmedAt: nowIso } : {}),
    };

    const { data: updated, error: updateErr } = await db
      .from('consultations')
      .update({
        concern_summary: JSON.stringify(meta),
        updated_at: nowIso,
        ...(decision === 'confirm' ? { status: 'confirmed', meeting_url: meetingLink } : {}),
      })
      .eq('id', consultationId)
      .eq('lawyer_id', user.id)
      .eq('status', 'awaiting_client_confirmation')
      .select(CONSULTATION_COLUMNS)
      .single();
    if (updateErr || !updated) {
      console.error('[reviewPaymentAction] update failed:', updateErr?.message);
      if (updateErr?.code === '23505') {
        return { error: 'You already have another confirmed consultation at this time.' };
      }
      return { error: 'We could not update the payment. Please refresh and try again.' };
    }

    const updatedRow = updated as ConsultationRow;
    const updatedPayment = paymentOf(updatedRow, meta, schedule.range, 0, platformFee);
    // Record the sale (confirm) or the declined proof (reject) in the payments ledger.
    const recorded = await syncPaymentLedger(
      db,
      updatedRow,
      updatedPayment,
      decision === 'confirm' ? 'paid' : 'failed',
      nowIso
    );
    if (!recorded && decision === 'confirm') {
      console.error('[reviewPaymentAction] payment confirmed but ledger write failed; earnings loader will re-sync', consultationId);
    }
    await writeAuditLog({
      actorId: user.id,
      action: decision === 'confirm' ? 'payment.confirmed' : 'payment.rejected',
      targetType: 'consultation',
      targetId: consultationId,
      details: { ledger_recorded: recorded, ...(decision === 'reject' ? { reason } : {}) },
    });

    if (decision === 'confirm') {
      await postSystemMessage(
        db,
        consultationId,
        user.id,
        `Payment confirmed by ${lawyerName}. Your consultation on ${when} is confirmed. Google Meet link: ${meetingLink}`
      );
      await notifyUser(
        db,
        consultation.client_id,
        'payment_confirmed',
        'Payment Confirmed — Consultation Confirmed',
        `${lawyerName} confirmed your payment. Your consultation on ${when} is confirmed. Join via Google Meet: ${meetingLink}`,
        { consultationId, lawyerId: user.id, meetingLink }
      );
    } else {
      await postSystemMessage(
        db,
        consultationId,
        user.id,
        `${lawyerName} could not verify the proof of payment: ${reason}. Please upload a new proof of payment.`
      );
      await notifyUser(
        db,
        consultation.client_id,
        'payment_declined',
        'Proof of Payment Declined',
        `${lawyerName} declined your proof of payment for the consultation on ${when}. Reason: ${reason}. Please upload a new proof of payment.`,
        { consultationId, lawyerId: user.id, reason }
      );
    }

    revalidateConsultationPaths();
    revalidatePath('/client/messages');
    revalidatePath('/lawyer/messages');
    signalLive([user.id, consultation.client_id], ['consultations', 'payments', 'messages']);
    return { success: true, newStatus: decision === 'confirm' ? 'confirmed' : 'pending_payment' };
  } catch (err) {
    console.error('[reviewPaymentAction] error:', err);
    return { error: 'Something went wrong while reviewing the payment. Please try again.' };
  }
}

/**
 * Lawyer cancels an approved (pending payment / payment review / confirmed)
 * consultation with a reason. Paid bookings are flagged for refund.
 */
export async function lawyerCancelConsultationAction(
  consultationId: string,
  reason: string
): Promise<{ success: true } | { success?: false; error: string }> {
  try {
    if (!UUID_REGEX.test(consultationId ?? '')) return { error: 'Consultation not found.' };
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (text.length < 5) return { error: 'Please provide a reason for cancelling (at least 5 characters).' };
    if (text.length > 1000) return { error: 'The reason must be 1000 characters or fewer.' };

    const session = await requireLawyerSession();
    if ('error' in session) return { error: session.error };
    const { db, user, lawyerName } = session;

    const { data: found } = await db
      .from('consultations')
      .select(CONSULTATION_COLUMNS)
      .eq('id', consultationId)
      .eq('lawyer_id', user.id)
      .maybeSingle();
    if (!found) return { error: 'Consultation not found.' };
    const consultation = found as ConsultationRow;
    if (!['awaiting_client_confirmation', 'confirmed'].includes(consultation.status)) {
      return {
        error:
          consultation.status === 'pending'
            ? 'Use Decline for requests you have not approved yet.'
            : 'This consultation can no longer be cancelled.',
      };
    }

    const schedule = scheduleOf(consultation);
    const payment = paymentOf(consultation, schedule.meta, schedule.range, 0, DEFAULT_PLATFORM_FEE);
    const refundPending = payment.state === 'verified' || payment.state === 'submitted';
    const nowIso = new Date().toISOString();
    const meta = {
      ...schedule.meta,
      cancellationReason: text,
      cancelledBy: 'lawyer',
      cancelledAt: nowIso,
      ...(refundPending ? { refundStatus: 'pending' } : {}),
    };

    const { data: updated, error: updateErr } = await db
      .from('consultations')
      .update({ status: 'cancelled', cancelled_by: user.id, concern_summary: JSON.stringify(meta), updated_at: nowIso })
      .eq('id', consultationId)
      .eq('lawyer_id', user.id)
      .in('status', ['awaiting_client_confirmation', 'confirmed'])
      .select('id');
    if (updateErr || !updated || updated.length === 0) {
      if (updateErr) console.error('[lawyerCancelConsultationAction] update failed:', updateErr.message);
      return { error: 'We could not cancel this consultation. Please refresh and try again.' };
    }

    if (payment.state === 'verified') await markLedgerRefunded(db, consultationId);
    await revokeSharedDocuments(db, consultation);
    const when = `${schedule.displayDate.replace('TODAY, ', '')} (${schedule.timeSlot})`;
    await postSystemMessage(db, consultationId, user.id, `${lawyerName} cancelled this consultation. Reason: ${text}`);
    await notifyUser(
      db,
      consultation.client_id,
      'consultation_cancelled',
      'Consultation Cancelled by Attorney',
      `${lawyerName} cancelled your consultation on ${when}. Reason: ${text}.` +
        (refundPending ? ' Your payment will be refunded.' : ''),
      { consultationId, lawyerId: user.id, reason: text, refundPending }
    );

    revalidateConsultationPaths();
    signalLive([user.id, consultation.client_id], ['consultations', 'payments', 'documents', 'messages']);
    return { success: true };
  } catch (err) {
    console.error('[lawyerCancelConsultationAction] error:', err);
    return { error: 'Something went wrong while cancelling. Please try again.' };
  }
}

/**
 * Short-lived link to view a private document (owner, or a user it was shared
 * with through document_access_grants — e.g. a lawyer viewing a proof of payment).
 */
export async function getDocumentAccessUrlAction(
  documentId: string
): Promise<{ success: true; url: string; fileName: string } | { success?: false; error: string }> {
  try {
    if (!UUID_REGEX.test(documentId ?? '')) return { error: 'Document not found.' };
    const session = await requireSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const { data: doc } = await db
      .from('documents')
      .select('id, owner_id, filename, storage_path, mime_type')
      .eq('id', documentId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!doc || isFolderRow(doc)) return { error: 'Document not found.' };

    if (doc.owner_id !== user.id) {
      const { data: grant } = await db
        .from('document_access_grants')
        .select('id')
        .eq('document_id', documentId)
        .eq('grantee_id', user.id)
        .is('revoked_at', null)
        .maybeSingle();
      if (!grant) return { error: 'You do not have access to this document.' };
    }

    const { data: signed, error } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 120);
    if (error || !signed?.signedUrl) {
      console.error('[getDocumentAccessUrlAction]', error?.message);
      return { error: 'This file could not be opened. Please try again.' };
    }
    // Someone else's private file was opened through a grant: keep an access record.
    if (doc.owner_id !== user.id) {
      await writeAuditLog({
        actorId: user.id,
        action: 'document.accessed',
        targetType: 'document',
        targetId: documentId,
        details: { owner_id: doc.owner_id },
      });
    }
    return { success: true, url: signed.signedUrl, fileName: doc.filename };
  } catch (err) {
    console.error('[getDocumentAccessUrlAction] error:', err);
    return { error: 'This file could not be opened. Please try again.' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// LAWYER: EARNINGS & PAYOUTS (sales ledger = public.payments)
// ═════════════════════════════════════════════════════════════════════════════
//
// A sale is recorded when the lawyer confirms a client's proof of payment
// (PENDING PAYMENT → CONFIRMED, see reviewPaymentAction). The ledger row keeps
// the gross amount paid by the client and the platform fee; the lawyer's
// earnings are amount − platform_fee. Cancelled paid bookings are refunded and
// drop out of the totals.

export type EarningsInquiryStatus =
  | 'pendingApproval'
  | 'pendingPayment'
  | 'upcoming'
  | 'completed'
  | 'cancelled';

export interface EarningsInquiry {
  id: string;
  name: string;
  /** MM/DD/YYYY (Manila) */
  date: string;
  area: string;
  status: EarningsInquiryStatus;
  /** Epoch ms of the session start, for sorting. */
  startMs: number;
}

export interface EarningsTransaction {
  id: string;
  consultationId: string;
  clientName: string;
  area: string;
  /** MM/DD/YYYY of the consultation session (Manila). */
  sessionDate: string;
  /** MM/DD/YYYY the payment was confirmed (Manila). */
  paidDate: string;
  /** 0-based month (Manila) the payment was confirmed. */
  paidMonth: number;
  /** Epoch ms the payment was confirmed, for sorting. */
  paidMs: number;
  gross: number;
  platformFee: number;
  net: number;
  payoutStatus: string;
}

export interface LawyerEarningsData {
  year: number;
  /** 0-based current month in Manila. */
  currentMonth: number;
  /** Net earnings per month of `year` (index 0 = January). */
  monthlyEarnings: number[];
  /** Net earnings of December of the previous year (January comparison). */
  previousDecemberEarnings: number;
  /** Paid (confirmed / completed) consultations per session month of `year`. */
  monthlyConsultations: number[];
  todayScheduled: number;
  pendingRequests: number;
  pendingClients: number;
  completedSessions: number;
  reviewCount: number;
  /** 0–100, or null when there are no requests yet. */
  responseRate: number | null;
  /** Paid sales confirmed in `year`, newest first. */
  transactions: EarningsTransaction[];
  inquiries: EarningsInquiry[];
}

interface PaymentLedgerRow {
  id: string;
  consultation_id: string;
  amount: number | string;
  platform_fee: number | string;
  status: LedgerStatus;
  payout_status: string | null;
  paid_at: string | null;
  created_at: string;
}

function toUsDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/**
 * Everything the Earnings & Payouts tab needs for the signed-in lawyer.
 * Also backfills the sales ledger: every consultation whose payment was
 * confirmed gets a "paid" payments row, and paid rows of cancelled bookings
 * are marked refunded.
 */
export async function getLawyerEarningsAction(): Promise<
  { success: true; data: LawyerEarningsData } | { success?: false; error: string }
> {
  try {
    const session = await requireLawyerSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const [consultRes, selfRes, platformFee] = await Promise.all([
      db
        .from('consultations')
        .select(`${CONSULTATION_COLUMNS}, practice_area, updated_at, ${CLIENT_EMBED}`)
        .eq('lawyer_id', user.id),
      db
        .from('lawyer_profiles')
        .select('full_name, roll_number, ibp_chapter, fee_standard_60min, practice_areas, rating_count')
        .eq('user_id', user.id)
        .maybeSingle(),
      getPlatformFee(db),
    ]);
    if (consultRes.error) {
      console.error('[getLawyerEarningsAction] consultations', consultRes.error.message);
      return { error: 'We could not load your earnings right now. Please try again.' };
    }

    type Row = ConsultationRow & {
      practice_area: string | null;
      updated_at: string | null;
      client: ClientProfileEmbed | null;
    };
    const rows = (consultRes.data ?? []) as unknown as Row[];
    const self = selfRes.data as
      | (LawyerSelfRow & { practice_areas: string[] | null; rating_count: number | null })
      | null;
    const defaultArea = self?.practice_areas?.[0] || 'General Consultation';
    const byId = new Map(rows.map((r) => [r.id, r]));

    // ── 1. Read the ledger and backfill missing / stale rows ──
    const readLedger = async () => {
      const { data, error } = await db
        .from('payments')
        .select('id, consultation_id, amount, platform_fee, status, payout_status, paid_at, created_at')
        .eq('payee_id', user.id);
      if (error) throw new Error(error.message);
      return (data ?? []) as PaymentLedgerRow[];
    };

    let ledger = await readLedger();
    const paidIds = new Set(ledger.filter((p) => p.status === 'paid').map((p) => p.consultation_id));
    let changed = false;

    for (const row of rows) {
      const { meta, range } = scheduleOf(row);
      const payment = paymentOf(row, meta, range, Number(self?.fee_standard_60min ?? 0), platformFee);
      const isSale =
        (row.status === 'confirmed' || row.status === 'completed') && payment.state === 'verified';
      if (isSale && !paidIds.has(row.id)) {
        const paidAt =
          meta.paymentProof?.reviewedAt || meta.confirmedAt || row.updated_at || row.created_at;
        if (await syncPaymentLedger(db, row, payment, 'paid', paidAt)) changed = true;
      } else if ((row.status === 'cancelled' || row.status === 'declined') && paidIds.has(row.id)) {
        await markLedgerRefunded(db, row.id);
        changed = true;
      }
    }
    if (changed) ledger = await readLedger();

    // ── 2. Monthly sales ──
    const today = todayInManila();
    const year = Number(today.slice(0, 4));
    const currentMonth = Number(today.slice(5, 7)) - 1;
    const monthlyEarnings = Array<number>(12).fill(0);
    let previousDecemberEarnings = 0;
    const transactions: EarningsTransaction[] = [];

    for (const p of ledger) {
      if (p.status !== 'paid') continue;
      const paidTs = p.paid_at || p.created_at;
      const paidIso = toManilaParts(paidTs).isoDate;
      const paidYear = Number(paidIso.slice(0, 4));
      const paidMonth = Number(paidIso.slice(5, 7)) - 1;
      const gross = Number(p.amount) || 0;
      const fee = Number(p.platform_fee) || 0;
      const net = roundMoney(Math.max(0, gross - fee));

      if (paidYear === year - 1 && paidMonth === 11) previousDecemberEarnings += net;
      if (paidYear !== year) continue;
      monthlyEarnings[paidMonth] += net;

      const consultation = byId.get(p.consultation_id);
      const schedule = consultation ? scheduleOf(consultation) : null;
      transactions.push({
        id: p.id,
        consultationId: p.consultation_id,
        clientName: consultation?.client?.full_name?.trim() || consultation?.client?.email || 'Client',
        area: consultation?.practice_area || defaultArea,
        sessionDate: schedule ? toUsDate(toIsoDate(schedule.date)) : '—',
        paidDate: toUsDate(paidIso),
        paidMonth,
        paidMs: new Date(paidTs).getTime(),
        gross: roundMoney(gross),
        platformFee: roundMoney(fee),
        net,
        payoutStatus: p.payout_status || 'pending',
      });
    }
    transactions.sort((a, b) => b.paidMs - a.paidMs);

    // ── 3. Consultation metrics & inquiries ──
    const now = Date.now();
    const monthlyConsultations = Array<number>(12).fill(0);
    let todayScheduled = 0;
    let pendingRequests = 0;
    const pendingClientIds = new Set<string>();
    let completedSessions = 0;
    let responded = 0;
    let requestsConsidered = 0;
    const inquiries: EarningsInquiry[] = [];

    for (const row of rows) {
      const { meta, date, range, startMs } = scheduleOf(row);
      const isoDate = toIsoDate(date);
      const endMs = row.scheduled_end
        ? new Date(row.scheduled_end).getTime()
        : startMs + (range ? range.endMinutes - range.startMinutes : 60) * 60 * 1000;
      const paid = row.status === 'confirmed' || row.status === 'completed';
      const isDone = row.status === 'completed' || (row.status === 'confirmed' && endMs < now);

      if (paid && date.year === year) monthlyConsultations[date.monthIndex] += 1;
      if (paid && isoDate === today) todayScheduled += 1;
      if (row.status === 'pending') {
        pendingRequests += 1;
        pendingClientIds.add(row.client_id);
      }
      if (isDone) completedSessions += 1;

      // Response rate: requests the lawyer answered (approved or declined) out of
      // all requests that needed an answer. Ignored: requests the client withdrew
      // before any response, and pending requests whose session is still ahead
      // (the lawyer can still answer them). Pending requests whose time passed
      // without an answer count as missed.
      const answered =
        ['awaiting_client_confirmation', 'confirmed', 'completed', 'declined'].includes(row.status) ||
        !!meta.approvedAt ||
        !!meta.declinedAt;
      const withdrawnUnanswered = row.status === 'cancelled' && !answered;
      const stillOpen = row.status === 'pending' && startMs > now;
      if (!withdrawnUnanswered && !stillOpen) {
        requestsConsidered += 1;
        if (answered) responded += 1;
      }

      let status: EarningsInquiryStatus;
      switch (row.status) {
        case 'pending':
          status = 'pendingApproval';
          break;
        case 'awaiting_client_confirmation':
          status = 'pendingPayment';
          break;
        case 'confirmed':
          status = isDone ? 'completed' : 'upcoming';
          break;
        case 'completed':
          status = 'completed';
          break;
        default:
          status = 'cancelled';
      }
      inquiries.push({
        id: row.id,
        name: row.client?.full_name?.trim() || meta.payment?.payerName || row.client?.email || 'Client',
        date: toUsDate(isoDate),
        area: row.practice_area || defaultArea,
        status,
        startMs,
      });
    }
    inquiries.sort((a, b) => b.startMs - a.startMs);

    return {
      success: true,
      data: {
        year,
        currentMonth,
        monthlyEarnings: monthlyEarnings.map(roundMoney),
        previousDecemberEarnings: roundMoney(previousDecemberEarnings),
        monthlyConsultations,
        todayScheduled,
        pendingRequests,
        pendingClients: pendingClientIds.size,
        completedSessions,
        reviewCount: Number(self?.rating_count ?? 0) || 0,
        responseRate:
          requestsConsidered > 0 ? Math.round((responded / requestsConsidered) * 100) : null,
        transactions,
        inquiries,
      },
    };
  } catch (err) {
    console.error('[getLawyerEarningsAction] error:', err);
    return { error: 'We could not load your earnings right now. Please try again.' };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// RESCHEDULING (confirmed appointments; client ⇄ lawyer)
// ═════════════════════════════════════════════════════════════════════════════
//
// Either participant of a CONFIRMED (paid) appointment can propose a new date and time.
// The other participant accepts or declines; the requester can withdraw. While a request is
// open, consultations.proposed_start / proposed_end hold the proposal and the request details
// live in concern_summary.reschedule (history in concern_summary.rescheduleHistory).
// Accepting moves scheduled_start / scheduled_end; the fee, payment and Meet link stay as-is.

/** Accepted reschedules allowed per booking. */
const MAX_RESCHEDULES = 2;
/** A request can be sent until this long before the current session starts. */
const RESCHEDULE_CUTOFF_MS = 60 * 60 * 1000;
/** The proposed time must be at least this far in the future. */
const RESCHEDULE_MIN_NOTICE_MS = 2 * 60 * 60 * 1000;
/** An open request lapses when its proposed time is closer than this. */
const RESCHEDULE_ANSWER_BY_MS = 30 * 60 * 1000;
/** …and no further ahead than this. */
const RESCHEDULE_MAX_DAYS_AHEAD = 60;
/** Start times offered for a reschedule — the same slots as the booking calendar. */
const RESCHEDULE_SLOT_STARTS = [9 * 60, 10 * 60, 13 * 60, 14 * 60, 15 * 60, 16 * 60];
const RESCHEDULE_REASON_MIN = 5;
const RESCHEDULE_REASON_MAX = 500;

type RescheduleParty = 'client' | 'lawyer';
type RescheduleOutcome = 'accepted' | 'declined' | 'withdrawn' | 'expired';

interface StoredReschedule {
  status: 'pending';
  requestedBy: RescheduleParty;
  requestedById: string;
  requestedAt: string;
  reason: string;
  proposedStart: string;
  proposedEnd: string;
  fromStart: string | null;
  fromEnd: string | null;
}

interface StoredRescheduleHistory extends Omit<StoredReschedule, 'status'> {
  status: RescheduleOutcome;
  respondedAt: string;
  responseReason: string | null;
}

function storedReschedule(meta: Record<string, unknown>): StoredReschedule | null {
  const r = meta.reschedule as Partial<StoredReschedule> | undefined | null;
  if (!r || r.status !== 'pending' || typeof r.proposedStart !== 'string' || typeof r.proposedEnd !== 'string') return null;
  if (r.requestedBy !== 'client' && r.requestedBy !== 'lawyer') return null;
  return r as StoredReschedule;
}

function rescheduleHistory(meta: Record<string, unknown>): StoredRescheduleHistory[] {
  return Array.isArray(meta.rescheduleHistory) ? [...(meta.rescheduleHistory as StoredRescheduleHistory[])] : [];
}

/** Display pieces ("Thursday, November 26, 2026", "2:00 PM - 3:00 PM", slot label) for a start/end pair. */
function scheduleLabels(startIso: string, endIso: string) {
  const start = toManilaParts(startIso);
  const end = toManilaParts(endIso);
  const date = parseIsoDate(start.isoDate);
  const range = { startMinutes: start.minutes, endMinutes: end.minutes > start.minutes ? end.minutes : start.minutes + 60 };
  const { dateLong, timeRange } = summaryOf(date, range);
  return { dateLong, timeRange, timeSlot: formatSlotLabel(range) };
}

/** A pending request lapses once its proposed time is too close or the current session has started. */
function rescheduleExpired(pending: StoredReschedule, row: ConsultationRow, now = Date.now()): boolean {
  const currentStart = row.scheduled_start ? new Date(row.scheduled_start).getTime() : Infinity;
  return new Date(pending.proposedStart).getTime() <= now + RESCHEDULE_ANSWER_BY_MS || currentStart <= now;
}

function rescheduleInfoOf(
  row: ConsultationRow,
  meta: Record<string, unknown>,
  viewer: RescheduleParty
): RescheduleInfo | null {
  if (row.status !== 'confirmed') return null;
  const now = Date.now();
  const history = rescheduleHistory(meta);
  const acceptedCount = history.filter((h) => h.status === 'accepted').length;
  const remaining = Math.max(0, MAX_RESCHEDULES - acceptedCount);

  let pendingRaw = storedReschedule(meta);
  let lapsed: StoredRescheduleHistory | null = null;
  if (pendingRaw && rescheduleExpired(pendingRaw, row, now)) {
    lapsed = { ...pendingRaw, status: 'expired', respondedAt: pendingRaw.proposedStart, responseReason: null };
    pendingRaw = null;
  }

  const lastRaw = lapsed ?? history[history.length - 1] ?? null;
  const startMs = row.scheduled_start ? new Date(row.scheduled_start).getTime() : null;
  let blockedReason: string | null = null;
  if (startMs === null) blockedReason = 'This appointment has no scheduled time to move.';
  else if (startMs - now < RESCHEDULE_CUTOFF_MS) blockedReason = 'Appointments can only be rescheduled until 1 hour before they start.';
  else if (remaining === 0) blockedReason = `This appointment has already been rescheduled ${MAX_RESCHEDULES} times.`;

  let pending: RescheduleInfo['pending'] = null;
  if (pendingRaw) {
    const labels = scheduleLabels(pendingRaw.proposedStart, pendingRaw.proposedEnd);
    pending = {
      requestedBy: pendingRaw.requestedBy,
      byMe: pendingRaw.requestedBy === viewer,
      requestedAt: pendingRaw.requestedAt,
      reason: pendingRaw.reason,
      proposedStart: pendingRaw.proposedStart,
      proposedDateLong: labels.dateLong,
      proposedTimeRange: labels.timeRange,
      proposedTimeSlot: labels.timeSlot,
    };
  }

  let last: RescheduleInfo['last'] = null;
  if (lastRaw) {
    const labels = scheduleLabels(lastRaw.proposedStart, lastRaw.proposedEnd);
    last = {
      status: lastRaw.status,
      requestedBy: lastRaw.requestedBy,
      byMe: lastRaw.requestedBy === viewer,
      respondedAt: lastRaw.respondedAt,
      responseReason: lastRaw.responseReason ?? null,
      proposedLabel: `${labels.dateLong} · ${labels.timeRange}`,
      recent: now - new Date(lastRaw.respondedAt).getTime() < 3 * 24 * 60 * 60 * 1000,
    };
  }

  return {
    pending,
    last,
    acceptedCount,
    remaining,
    canRequest: !pending && !blockedReason,
    blockedReason: pending ? null : blockedReason,
  };
}

type RescheduleTarget = {
  db: Db;
  user: User;
  consultation: ConsultationRow;
  party: RescheduleParty;
  meta: ReturnType<typeof parseMeta>;
};

/** Loads a consultation the signed-in user takes part in (as client or lawyer). */
async function loadRescheduleTarget(consultationId: string): Promise<RescheduleTarget | { error: string }> {
  if (!UUID_REGEX.test(consultationId ?? '')) return { error: 'Consultation not found.' };
  const session = await requireSession();
  if ('error' in session) return { error: session.error };
  const { db, user } = session;
  const { data } = await db
    .from('consultations')
    .select(CONSULTATION_COLUMNS)
    .eq('id', consultationId)
    .or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`)
    .maybeSingle();
  if (!data) return { error: 'Consultation not found.' };
  const consultation = data as ConsultationRow;
  return {
    db,
    user,
    consultation,
    party: consultation.lawyer_id === user.id ? 'lawyer' : 'client',
    meta: parseMeta(consultation.concern_summary),
  };
}

function sessionMinutes(row: ConsultationRow): number {
  const range = scheduleOf(row).range;
  return range ? range.endMinutes - range.startMinutes : 60;
}

/** Checks a proposed slot against both participants' calendars. Returns an error message or null. */
async function rescheduleConflict(
  db: Db,
  row: ConsultationRow,
  date: CalendarDate,
  range: MinuteRange
): Promise<string | null> {
  const label = formatSlotLabel(range);
  const [lawyerBookings, blocked, clientBookings] = await Promise.all([
    findActiveBookingsOnDate(db, 'lawyer_id', row.lawyer_id, date),
    findUnavailabilityOnDate(db, row.lawyer_id, date),
    findActiveBookingsOnDate(db, 'client_id', row.client_id, date),
  ]);
  if (lawyerBookings.some((b) => b.id !== row.id && rangesOverlap(b, range))) {
    return `The attorney already has a consultation during ${label}. Please choose another time.`;
  }
  if (blocked.includes('all-day')) return 'The attorney is unavailable on that date. Please choose another day.';
  if (blocked.some((b) => b !== 'all-day' && rangesOverlap(b, range))) {
    return `The attorney is unavailable during ${label}. Please choose another time.`;
  }
  if (clientBookings.some((b) => b.id !== row.id && rangesOverlap(b, range))) {
    return `The client already has another consultation during ${label}. Please choose another time.`;
  }
  return null;
}

async function participantNames(db: Db, row: ConsultationRow): Promise<{ client: string; lawyer: string }> {
  const [{ data: client }, { data: lawyer }] = await Promise.all([
    db.from('profiles').select('full_name, email').eq('user_id', row.client_id).maybeSingle(),
    db.from('lawyer_profiles').select('full_name').eq('user_id', row.lawyer_id).maybeSingle(),
  ]);
  return {
    client: client?.full_name?.trim() || client?.email || 'The client',
    lawyer: lawyer?.full_name || 'The attorney',
  };
}

export interface RescheduleSlotOption {
  startMinutes: number;
  /** e.g. "2:00 PM - 3:00 PM • PST, GMT+8" */
  label: string;
  state: 'available' | 'booked' | 'unavailable' | 'past' | 'current';
}

export interface RescheduleOptions {
  /** YYYY-MM-DD (Asia/Manila) */
  date: string;
  slots: RescheduleSlotOption[];
  /** Days of that month (1–31) the attorney has blocked entirely. */
  blockedDays: number[];
  /** Earliest / latest selectable dates (YYYY-MM-DD). */
  minDate: string;
  maxDate: string;
  durationMinutes: number;
  currentStart: string | null;
}

/** Slot availability on a date for moving a confirmed appointment (both calendars are checked). */
export async function getRescheduleOptionsAction(
  consultationId: string,
  isoDate: string
): Promise<{ success: true; options: RescheduleOptions } | { success?: false; error: string }> {
  try {
    if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { error: 'Please choose a valid date.' };
    const date = parseIsoDate(isoDate);
    if (toIsoDate(date) !== isoDate) return { error: 'Please choose a valid date.' };

    const target = await loadRescheduleTarget(consultationId);
    if ('error' in target) return { error: target.error };
    const { db, consultation } = target;
    if (consultation.status !== 'confirmed') return { error: 'Only confirmed appointments can be rescheduled.' };

    const now = Date.now();
    const minDate = toManilaParts(new Date(now + RESCHEDULE_MIN_NOTICE_MS).toISOString()).isoDate;
    const maxDate = toIsoDate(parseIsoDate(todayInManila()), RESCHEDULE_MAX_DAYS_AHEAD);
    const duration = sessionMinutes(consultation);

    const [lawyerBookings, clientBookings, blocks] = await Promise.all([
      findActiveBookingsOnDate(db, 'lawyer_id', consultation.lawyer_id, date),
      findActiveBookingsOnDate(db, 'client_id', consultation.client_id, date),
      findUnavailabilityOnDate(db, consultation.lawyer_id, date),
    ]);
    const otherBookings = [...lawyerBookings, ...clientBookings].filter((b) => b.id !== consultation.id);
    const current = consultation.scheduled_start ? toManilaParts(consultation.scheduled_start) : null;

    const outOfRange = isoDate < minDate || isoDate > maxDate;
    const slots: RescheduleSlotOption[] = RESCHEDULE_SLOT_STARTS.map((start) => {
      const range = { startMinutes: start, endMinutes: start + duration };
      const startMs = new Date(toManilaTimestamp(date, start)).getTime();
      let state: RescheduleSlotOption['state'] = 'available';
      if (current && current.isoDate === isoDate && current.minutes === start) state = 'current';
      else if (outOfRange || startMs < now + RESCHEDULE_MIN_NOTICE_MS) state = 'past';
      else if (blocks.some((b) => b === 'all-day' || rangesOverlap(b, range))) state = 'unavailable';
      else if (otherBookings.some((b) => rangesOverlap(b, range))) state = 'booked';
      return { startMinutes: start, label: formatSlotLabel(range), state };
    });

    // Whole-day blocks for the month, so the calendar can grey those days out.
    const monthStart = `${date.year}-${pad2(date.monthIndex + 1)}-01`;
    const monthEnd = new Date(Date.UTC(date.year, date.monthIndex + 1, 0)).toISOString().slice(0, 10);
    const { data: monthBlocks, error: blocksError } = await db
      .from('lawyer_unavailability')
      .select('unavailable_date, start_minutes, end_minutes')
      .eq('lawyer_id', consultation.lawyer_id)
      .gte('unavailable_date', monthStart)
      .lte('unavailable_date', monthEnd);
    if (blocksError && blocksError.code !== 'PGRST205' && blocksError.code !== '42P01') {
      console.warn('[getRescheduleOptionsAction] blocks', blocksError.message);
    }
    const blockedDays = [
      ...new Set(
        ((monthBlocks ?? []) as Array<{ unavailable_date: string; start_minutes: number | null; end_minutes: number | null }>)
          .filter((b) => b.start_minutes === null || b.end_minutes === null)
          .map((b) => parseIsoDate(b.unavailable_date).day)
      ),
    ].sort((a, b) => a - b);

    return {
      success: true,
      options: {
        date: isoDate,
        slots,
        blockedDays,
        minDate,
        maxDate,
        durationMinutes: duration,
        currentStart: consultation.scheduled_start,
      },
    };
  } catch (err) {
    console.error('[getRescheduleOptionsAction] error:', err);
    return { error: 'Available times could not be loaded. Please try again.' };
  }
}

export type RescheduleActionResult = { success: true } | { success?: false; error: string };

function rescheduleRevalidate(row: ConsultationRow) {
  revalidateConsultationPaths();
  try {
    revalidatePath('/client/messages');
    revalidatePath('/lawyer/messages');
  } catch {
    // no request scope
  }
  signalLive([row.client_id, row.lawyer_id], ['consultations', 'messages']);
}

/** Proposes a new date/time for a confirmed appointment. */
export async function requestRescheduleAction(
  consultationId: string,
  input: { date: string; startMinutes: number; reason: string }
): Promise<RescheduleActionResult> {
  try {
    const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
    if (reason.length < RESCHEDULE_REASON_MIN) {
      return { error: `Please tell the other party why you need to reschedule (at least ${RESCHEDULE_REASON_MIN} characters).` };
    }
    if (reason.length > RESCHEDULE_REASON_MAX) return { error: `The reason must be ${RESCHEDULE_REASON_MAX} characters or fewer.` };
    if (typeof input?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: 'Please choose a new date.' };
    const startMinutes = Number(input.startMinutes);
    if (!RESCHEDULE_SLOT_STARTS.includes(startMinutes)) return { error: 'Please choose one of the available time slots.' };
    const date = parseIsoDate(input.date);
    if (toIsoDate(date) !== input.date) return { error: 'Please choose a new date.' };

    const target = await loadRescheduleTarget(consultationId);
    if ('error' in target) return { error: target.error };
    const rescheduleLimited = await checkRateLimit('reschedule', target.user.id);
    if (rescheduleLimited) return { error: rescheduleLimited };
    const { db, user, consultation, party, meta } = target;
    if (consultation.status !== 'confirmed') return { error: 'Only confirmed appointments can be rescheduled.' };

    const info = rescheduleInfoOf(consultation, meta, party)!;
    if (info.pending) {
      return {
        error: info.pending.byMe
          ? 'You already sent a reschedule request for this appointment. Withdraw it first to propose another time.'
          : 'The other party already proposed a new time. Please accept or decline it first.',
      };
    }
    if (info.blockedReason) return { error: info.blockedReason };

    const range = { startMinutes, endMinutes: startMinutes + sessionMinutes(consultation) };
    const proposedStart = toManilaTimestamp(date, range.startMinutes);
    const proposedEnd = toManilaTimestamp(date, range.endMinutes);
    const proposedMs = new Date(proposedStart).getTime();
    if (proposedMs < Date.now() + RESCHEDULE_MIN_NOTICE_MS) {
      return { error: 'Please choose a time at least 2 hours from now.' };
    }
    if (input.date > toIsoDate(parseIsoDate(todayInManila()), RESCHEDULE_MAX_DAYS_AHEAD)) {
      return { error: `Please choose a date within the next ${RESCHEDULE_MAX_DAYS_AHEAD} days.` };
    }
    if (consultation.scheduled_start && new Date(consultation.scheduled_start).getTime() === proposedMs) {
      return { error: 'That is the current schedule. Please choose a different date or time.' };
    }
    const conflict = await rescheduleConflict(db, consultation, date, range);
    if (conflict) return { error: conflict };

    const nowIso = new Date().toISOString();
    const request: StoredReschedule = {
      status: 'pending',
      requestedBy: party,
      requestedById: user.id,
      requestedAt: nowIso,
      reason,
      proposedStart,
      proposedEnd,
      fromStart: consultation.scheduled_start,
      fromEnd: consultation.scheduled_end,
    };
    // A lapsed request moves into the history before the new one is stored.
    const stale = storedReschedule(meta);
    const history = rescheduleHistory(meta);
    if (stale) history.push({ ...stale, status: 'expired', respondedAt: nowIso, responseReason: null });

    let query = db
      .from('consultations')
      .update({
        proposed_start: proposedStart,
        proposed_end: proposedEnd,
        concern_summary: JSON.stringify({ ...meta, reschedule: request, rescheduleHistory: history }),
        updated_at: nowIso,
      })
      .eq('id', consultation.id)
      .eq('status', 'confirmed');
    // Guards against a request sent by the other party at the same moment.
    query = stale ? query.eq('proposed_start', stale.proposedStart) : query.is('proposed_start', null);
    const { data: updated, error } = await query.select('id');
    if (error) {
      console.error('[requestRescheduleAction] update failed:', error.message);
      return { error: 'Your reschedule request could not be sent. Please try again.' };
    }
    if (!updated?.length) {
      return { error: 'This appointment changed while you were choosing a time. Please refresh and try again.' };
    }

    const names = await participantNames(db, consultation);
    const requester = party === 'lawyer' ? names.lawyer : names.client;
    const recipientId = party === 'lawyer' ? consultation.client_id : consultation.lawyer_id;
    const from = scheduleOf(consultation);
    const to = scheduleLabels(proposedStart, proposedEnd);
    const fromLabel = `${from.displayDate.replace('TODAY, ', '')} (${from.timeSlot})`;
    await postSystemMessage(
      db,
      consultation.id,
      user.id,
      `${requester} asked to reschedule the consultation on ${fromLabel} to ${to.dateLong}, ${to.timeRange}. Reason: ${reason}`
    );
    await notifyUser(
      db,
      recipientId,
      'consultation_reschedule_requested',
      'Reschedule Requested',
      `${requester} asked to move your consultation on ${fromLabel} to ${to.dateLong}, ${to.timeRange}. Open Consultations to accept or decline.`,
      { consultationId: consultation.id, proposedStart, requestedBy: party }
    );
    rescheduleRevalidate(consultation);
    return { success: true };
  } catch (err) {
    console.error('[requestRescheduleAction] error:', err);
    return { error: 'Your reschedule request could not be sent. Please try again.' };
  }
}

/** The other participant accepts or declines an open reschedule request. */
export async function respondToRescheduleAction(
  consultationId: string,
  response: 'accept' | 'decline',
  declineReason?: string
): Promise<RescheduleActionResult> {
  try {
    if (response !== 'accept' && response !== 'decline') return { error: 'Invalid response.' };
    const note = typeof declineReason === 'string' ? declineReason.trim() : '';
    if (response === 'decline' && note.length > RESCHEDULE_REASON_MAX) {
      return { error: `The reason must be ${RESCHEDULE_REASON_MAX} characters or fewer.` };
    }

    const target = await loadRescheduleTarget(consultationId);
    if ('error' in target) return { error: target.error };
    const { db, user, consultation, party, meta } = target;
    if (consultation.status !== 'confirmed') return { error: 'This appointment can no longer be rescheduled.' };
    const pending = storedReschedule(meta);
    if (!pending) return { error: 'There is no reschedule request waiting for an answer.' };
    if (pending.requestedBy === party) return { error: 'You sent this request. You can withdraw it instead.' };

    const nowIso = new Date().toISOString();
    const history = rescheduleHistory(meta);
    if (rescheduleExpired(pending, consultation)) {
      history.push({ ...pending, status: 'expired', respondedAt: nowIso, responseReason: null });
      await db
        .from('consultations')
        .update({
          proposed_start: null,
          proposed_end: null,
          concern_summary: JSON.stringify({ ...meta, reschedule: null, rescheduleHistory: history }),
          updated_at: nowIso,
        })
        .eq('id', consultation.id)
        .eq('proposed_start', pending.proposedStart);
      rescheduleRevalidate(consultation);
      return { error: 'This request has expired because the proposed time is too close. The original schedule stays.' };
    }

    const names = await participantNames(db, consultation);
    const responder = party === 'lawyer' ? names.lawyer : names.client;
    const to = scheduleLabels(pending.proposedStart, pending.proposedEnd);
    const nextMeta: Record<string, unknown> = { ...meta, reschedule: null };
    const update: Record<string, unknown> = { proposed_start: null, proposed_end: null, updated_at: nowIso };

    if (response === 'accept') {
      const start = toManilaParts(pending.proposedStart);
      const end = toManilaParts(pending.proposedEnd);
      const date = parseIsoDate(start.isoDate);
      const range = { startMinutes: start.minutes, endMinutes: end.minutes > start.minutes ? end.minutes : start.minutes + 60 };
      const conflict = await rescheduleConflict(db, consultation, date, range);
      if (conflict) {
        return {
          error: `${conflict.replace(/ Please choose another (time|day)\.$/, '')} This request can no longer be accepted — please decline it and agree on another time.`,
        };
      }

      history.push({ ...pending, status: 'accepted', respondedAt: nowIso, responseReason: null });
      Object.assign(nextMeta, {
        rescheduleHistory: history,
        rescheduledAt: nowIso,
        dateStr: `${MONTH_NAMES[date.monthIndex]} ${date.day}, ${date.year}`,
        timeSlot: formatSlotLabel(range),
        day: date.day,
        month: MONTH_NAMES[date.monthIndex],
        year: date.year,
      });
      Object.assign(update, {
        scheduled_start: pending.proposedStart,
        scheduled_end: pending.proposedEnd,
        scheduled_time: start.isoDate,
      });
    } else {
      history.push({ ...pending, status: 'declined', respondedAt: nowIso, responseReason: note || null });
      nextMeta.rescheduleHistory = history;
    }
    update.concern_summary = JSON.stringify(nextMeta);

    const { data: updated, error } = await db
      .from('consultations')
      .update(update)
      .eq('id', consultation.id)
      .eq('status', 'confirmed')
      .eq('proposed_start', pending.proposedStart)
      .select('id');
    if (error || !updated?.length) {
      if (error?.code === '23505' || error?.code === '23P01') {
        return { error: 'That time was just taken by another confirmed consultation. Please decline and agree on another time.' };
      }
      if (error) {
        console.error('[respondToRescheduleAction] update failed:', error.message);
        return { error: 'Your answer could not be saved. Please try again.' };
      }
      return { error: 'This request changed in the meantime. Please refresh and try again.' };
    }

    const newWhen = `${to.dateLong}, ${to.timeRange}`;
    if (response === 'accept') {
      await postSystemMessage(
        db,
        consultation.id,
        user.id,
        `${responder} accepted the new schedule: ${newWhen} (PST, GMT+8). The Google Meet link stays the same.`
      );
      await notifyUser(
        db,
        pending.requestedById,
        'consultation_rescheduled',
        'Reschedule Accepted',
        `${responder} accepted your request. Your consultation is now on ${newWhen}.`,
        { consultationId: consultation.id, scheduledStart: pending.proposedStart }
      );
    } else {
      const why = note ? ` Reason: ${note}` : '';
      await postSystemMessage(
        db,
        consultation.id,
        user.id,
        `${responder} declined the request to move the consultation to ${newWhen}. The original schedule stays.${why}`
      );
      await notifyUser(
        db,
        pending.requestedById,
        'consultation_reschedule_declined',
        'Reschedule Declined',
        `${responder} declined your request to move the consultation to ${newWhen}. The original schedule stays.${why}`,
        { consultationId: consultation.id }
      );
    }
    rescheduleRevalidate(consultation);
    return { success: true };
  } catch (err) {
    console.error('[respondToRescheduleAction] error:', err);
    return { error: 'Your answer could not be saved. Please try again.' };
  }
}

/** The requester withdraws their open reschedule request. */
export async function withdrawRescheduleAction(consultationId: string): Promise<RescheduleActionResult> {
  try {
    const target = await loadRescheduleTarget(consultationId);
    if ('error' in target) return { error: target.error };
    const { db, user, consultation, party, meta } = target;
    const pending = storedReschedule(meta);
    if (!pending) return { error: 'There is no reschedule request to withdraw.' };
    if (pending.requestedBy !== party) return { error: 'Only the person who sent the request can withdraw it.' };

    const nowIso = new Date().toISOString();
    const history = rescheduleHistory(meta);
    history.push({ ...pending, status: 'withdrawn', respondedAt: nowIso, responseReason: null });
    const { data: updated, error } = await db
      .from('consultations')
      .update({
        proposed_start: null,
        proposed_end: null,
        concern_summary: JSON.stringify({ ...meta, reschedule: null, rescheduleHistory: history }),
        updated_at: nowIso,
      })
      .eq('id', consultation.id)
      .eq('proposed_start', pending.proposedStart)
      .select('id');
    if (error || !updated?.length) {
      if (error) {
        console.error('[withdrawRescheduleAction] update failed:', error.message);
        return { error: 'The request could not be withdrawn. Please try again.' };
      }
      return { error: 'This request changed in the meantime. Please refresh and try again.' };
    }

    const names = await participantNames(db, consultation);
    const requester = party === 'lawyer' ? names.lawyer : names.client;
    const to = scheduleLabels(pending.proposedStart, pending.proposedEnd);
    await postSystemMessage(
      db,
      consultation.id,
      user.id,
      `${requester} withdrew the request to move the consultation to ${to.dateLong}, ${to.timeRange}.`
    );
    await notifyUser(
      db,
      party === 'lawyer' ? consultation.client_id : consultation.lawyer_id,
      'consultation_reschedule_withdrawn',
      'Reschedule Request Withdrawn',
      `${requester} withdrew the request to move your consultation to ${to.dateLong}, ${to.timeRange}. The original schedule stays.`,
      { consultationId: consultation.id }
    );
    rescheduleRevalidate(consultation);
    return { success: true };
  } catch (err) {
    console.error('[withdrawRescheduleAction] error:', err);
    return { error: 'The request could not be withdrawn. Please try again.' };
  }
}
