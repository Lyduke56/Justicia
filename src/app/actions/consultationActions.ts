'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';

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
    .select('user_id, email, full_name, role')
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
    .select('user_id, email, full_name, role')
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

/** Mirrors the manual payment into public.payments (best effort; the JSON is the source of truth). */
async function syncPaymentLedger(
  db: Db,
  consultation: ConsultationRow,
  payment: PaymentDetails,
  status: 'pending' | 'paid' | 'failed' | 'refunded'
): Promise<void> {
  try {
    if (!(await ensureProfile(db, consultation.lawyer_id))) return; // payee must have a profile row
    const fields = {
      consultation_id: consultation.id,
      payer_id: consultation.client_id,
      payee_id: consultation.lawyer_id,
      amount: payment.total,
      platform_fee: payment.platformFee,
      currency: 'PHP',
      status,
      provider: 'manual_qr',
      provider_payment_id: payment.proofDocumentId,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { data: existing } = await db
      .from('payments')
      .select('id')
      .eq('consultation_id', consultation.id)
      .maybeSingle();
    const { error } = existing
      ? await db.from('payments').update(fields).eq('id', existing.id)
      : await db.from('payments').insert(fields);
    if (error) console.warn('[syncPaymentLedger]', error.message);
  } catch (err) {
    console.warn('[syncPaymentLedger] unexpected', err);
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

function remindersFor(
  status: string,
  method: 'video' | 'audio',
  hasFiles: boolean,
  paymentState: PaymentState = 'none'
): string[] {
  const meet = method === 'video' ? 'video consultation' : 'audio call';
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
    case 'pending':
      return [
        'Your request is waiting for the attorney to review and approve it.',
        'You will be notified once the attorney approves or declines the booking.',
        `After approval you will be asked to settle the consultation fee before the ${meet} is confirmed.`,
        hasFiles
          ? 'The documents you shared are visible to the attorney while the request is active.'
          : 'You can share supporting documents from My Documents before the session.',
        'You may cancel this request anytime before the scheduled time.',
      ];
    case 'awaiting_client_confirmation':
      return [
        'The attorney approved your request. Please complete the payment to confirm your slot.',
        'Your time slot is held for you while payment is pending.',
        'You can now message the attorney from the Messages tab.',
        `Once paid, the Google Meet link for your ${meet} will appear here.`,
      ];
    case 'confirmed':
      return [
        `Join the Google Meet ${meet} a few minutes before the scheduled time.`,
        method === 'video'
          ? 'Use a quiet, private room and test your camera and microphone beforehand.'
          : 'Use a quiet, private room and test your microphone and speakers beforehand.',
        'Keep your documents and questions ready for the attorney.',
        'Everything discussed is protected by attorney-client privilege.',
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
    lawyerName: lawyer?.full_name || meta.lawyerName || 'Assigned Counsel',
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
    attachedFiles: sharedDocsFromMeta(meta),
    reminders: remindersFor(
      row.status,
      row.method === 'audio' ? 'audio' : 'video',
      sharedDocsFromMeta(meta).length > 0,
      payment.state
    ),
    declineReason: typeof meta.declineReason === 'string' ? meta.declineReason : null,
    cancellationReason: typeof meta.cancellationReason === 'string' ? meta.cancellationReason : null,
    ...summaryOf(date, range),
    payment,
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

function revalidateConsultationPaths() {
  try {
    revalidatePath('/client/consultations');
    revalidatePath('/lawyer/consultations');
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
        return {
          error: `The ${timeSlotLabel} slot was just reserved by another client. Please choose another time slot.`,
        };
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

/**
 * Fetches the signed-in client's consultations (excluding cancelled ones),
 * upcoming first.
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
    const now = Date.now();
    const sortKey = (c: ClientConsultation) =>
      c.scheduledStart ? new Date(c.scheduledStart).getTime() : Date.UTC(c.year, c.month, c.day);

    const platformFee = await getPlatformFee(db);
    const items = rows.map((row) => toClientConsultation(row, row.lawyer_profiles, platformFee));
    const upcoming = items.filter((c) => sortKey(c) >= now).sort((a, b) => sortKey(a) - sortKey(b));
    const past = items.filter((c) => sortKey(c) < now).sort((a, b) => sortKey(b) - sortKey(a));
    return [...upcoming, ...past];
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

    // Revoke document access unless another active booking with the same lawyer still shares the file.
    await revokeSharedDocuments(db, consultation);

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
  };
}

/** Session for a signed-in lawyer (must own a lawyer_profiles row). */
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

export interface MessageThreadItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
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

/** Returns the consultation behind a thread if the user participates in it. */
async function getThreadConsultation(
  db: Db,
  threadId: string,
  userId: string
): Promise<{ consultation: ConsultationRow; role: 'client' | 'lawyer' } | null> {
  if (!UUID_REGEX.test(threadId ?? '')) return null;
  const { data } = await db
    .from('consultations')
    .select(CONSULTATION_COLUMNS)
    .eq('id', threadId)
    .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
    .maybeSingle();
  if (!data) return null;
  const consultation = data as ConsultationRow;
  return { consultation, role: consultation.lawyer_id === userId ? 'lawyer' : 'client' };
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
 * Message threads for the signed-in user (client or lawyer).
 * Both participants see a thread for every active consultation (from pending onward),
 * so either side can message the other from View Details.
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
      .in('status', MESSAGING_STATUSES)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[getMessageThreadsAction]', error.message);
      return [];
    }

    const rows = (data ?? []) as unknown as Array<
      ConsultationRow & { lawyer_profiles: { full_name: string } | null; client: ClientProfileEmbed | null }
    >;
    if (rows.length === 0) return [];

    const { data: msgs } = await db
      .from('messages')
      .select('id, conversation_or_thread_id, sender_id, role, content, sent_at')
      .in('conversation_or_thread_id', rows.map((r) => r.id))
      .order('sent_at', { ascending: false })
      .limit(1000);
    const latest = new Map<string, MessageRow>();
    for (const m of (msgs ?? []) as MessageRow[]) {
      if (!latest.has(m.conversation_or_thread_id)) latest.set(m.conversation_or_thread_id, m);
    }

    return rows
      .map((r) => {
        const isLawyer = r.lawyer_id === user.id;
        const other = isLawyer
          ? r.client?.full_name?.trim() || r.client?.email || 'Client'
          : r.lawyer_profiles?.full_name || 'Attorney';
        const schedule = scheduleOf(r);
        const dateShort = `${MONTH_NAMES[schedule.date.monthIndex].slice(0, 3)} ${schedule.date.day}`;
        const last = latest.get(r.id);
        return {
          sortKey: last ? new Date(last.sent_at).getTime() : new Date(r.created_at).getTime(),
          item: {
            id: r.id,
            name: `${other} · ${dateShort}`,
            lastMessage: last
              ? `${last.role !== 'system' && last.sender_id === user.id ? 'You: ' : ''}${last.content}`
              : `${schedule.meta.subject || 'Consultation'} — no messages yet`,
            time: last ? formatMessageTime(last.sent_at, true) : 'New',
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

/** All messages of a thread the signed-in user participates in. */
export async function getMessagesForThreadAction(threadId: string): Promise<ThreadMessage[]> {
  try {
    const session = await requireSession();
    if ('error' in session) return [];
    const { db, user } = session;

    const thread = await getThreadConsultation(db, threadId, user.id);
    if (!thread) return [];

    const { data, error } = await db
      .from('messages')
      .select('id, conversation_or_thread_id, sender_id, role, content, sent_at')
      .eq('conversation_or_thread_id', threadId)
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

    const thread = await getThreadConsultation(db, threadId, user.id);
    if (!thread) return { error: 'Conversation not found.' };
    if (!MESSAGING_STATUSES.includes(thread.consultation.status)) {
      return { error: 'This consultation is closed, so new messages can no longer be sent.' };
    }
    if (!(await ensureUserAccount(db, profile))) {
      return { error: 'We could not verify your account for messaging. Please sign in again.' };
    }

    const { data, error } = await db
      .from('messages')
      .insert({
        conversation_or_thread_id: threadId,
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
      .eq('metadata->>threadId', threadId)
      .limit(1);
    if (!unread || unread.length === 0) {
      await notifyUser(
        db,
        recipientId,
        'new_message',
        `New message from ${profile.full_name || (thread.role === 'lawyer' ? 'your attorney' : 'your client')}`,
        text.length > 140 ? `${text.slice(0, 137)}...` : text,
        { threadId, consultationId: threadId, senderId: user.id }
      );
    }

    revalidatePath('/client/messages');
    revalidatePath('/lawyer/messages');
    return { success: true, message: toThreadMessage(data as MessageRow, user.id) };
  } catch (err) {
    console.error('[sendDirectMessageAction] error:', err);
    return { error: 'Your message could not be sent. Please try again.' };
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

    const { data, error } = await db
      .from('notifications')
      .select('id, type, title, body, created_at, is_read, metadata')
      .eq('user_id', user.id)
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

    revalidateConsultationPaths();
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
    await syncPaymentLedger(db, updatedRow, updatedPayment, decision === 'confirm' ? 'paid' : 'failed');

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
    return { success: true, url: signed.signedUrl, fileName: doc.filename };
  } catch (err) {
    console.error('[getDocumentAccessUrlAction] error:', err);
    return { error: 'This file could not be opened. Please try again.' };
  }
}
