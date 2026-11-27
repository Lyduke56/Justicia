/**
 * Admin bell: notifications for administrators, built from events the app already records in
 * audit_log (no change to the actions that record them). When an admin's bell loads, events of
 * the last 30 days that this admin hasn't been notified about become notification rows for them
 * (one per event, or one per lawyer per day for document uploads). Each admin has their own
 * rows, so read / unread is per admin (notifications.is_read).
 *
 *  - report.submitted           → "New report filed"
 *  - lawyer.submitted           → "New lawyer application" / "Application resubmitted"
 *  - lawyer.document.uploaded / replaced (after the application was submitted)
 *                               → "Verification documents updated"
 *  - lawyer.profile.updated, lawyer.payment_qr.updated, lawyer.hours.updated
 *                               → "Lawyer profile updated"
 *  - account.deletion_requested → "Account deletion requested"
 *
 * Server only (service client).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { REPORT_REASONS } from '@/lib/moderation/constants';
import { VERIFICATION_DOCUMENTS } from '@/lib/lawyer/verification';
import { attorneyNameOr } from '@/lib/utils/attorneyName';

type Db = SupabaseClient;

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 300;

export const ADMIN_EVENT_ACTIONS = [
  'report.submitted',
  'lawyer.submitted',
  'lawyer.document.uploaded',
  'lawyer.document.replaced',
  'lawyer.profile.updated',
  'lawyer.payment_qr.updated',
  'lawyer.hours.updated',
  'account.deletion_requested',
] as const;

export type AdminNotificationType =
  | 'admin_report'
  | 'admin_lawyer_application'
  | 'admin_lawyer_documents'
  | 'admin_lawyer_update'
  | 'admin_account_deletion';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface Built {
  eventKey: string;
  type: AdminNotificationType;
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

const manilaDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3600 * 1000).toISOString().slice(0, 10);
const docLabel = (type: unknown) => VERIFICATION_DOCUMENTS.find((d) => d.type === type)?.label ?? 'a verification document';
const categoryLabel = (key: unknown, category: unknown) =>
  REPORT_REASONS.find((r) => r.key === key)?.label ??
  (typeof category === 'string' ? category.replace(/_/g, ' ') : 'a problem');

/** Names for people (lawyers get "Atty."). */
async function namesFor(db: Db, ids: string[]): Promise<Map<string, { name: string; role: string | null }>> {
  const out = new Map<string, { name: string; role: string | null }>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return out;
  const [{ data: profiles }, { data: accounts }, { data: lawyers }] = await Promise.all([
    db.from('profiles').select('user_id, full_name, email, role').in('user_id', unique),
    db.from('user_accounts').select('id, full_name, email, role').in('id', unique),
    db.from('lawyer_profiles').select('user_id, full_name').in('user_id', unique),
  ]);
  const lawyerName = new Map(((lawyers ?? []) as Array<{ user_id: string; full_name: string | null }>).map((l) => [l.user_id, l.full_name]));
  for (const a of (accounts ?? []) as Array<{ id: string; full_name: string | null; email: string | null; role: string | null }>) {
    out.set(a.id, { name: a.full_name?.trim() || a.email?.split('@')[0] || 'A user', role: a.role });
  }
  for (const p of (profiles ?? []) as Array<{ user_id: string; full_name: string | null; email: string | null; role: string | null }>) {
    const prev = out.get(p.user_id);
    out.set(p.user_id, { name: p.full_name?.trim() || prev?.name || p.email?.split('@')[0] || 'A user', role: p.role ?? prev?.role ?? null });
  }
  for (const id of unique) {
    const entry = out.get(id) ?? { name: 'A user', role: null };
    if (lawyerName.has(id) || entry.role === 'lawyer') {
      entry.name = attorneyNameOr(lawyerName.get(id) || entry.name, entry.name);
      entry.role = 'lawyer';
    }
    out.set(id, entry);
  }
  return out;
}

const listJoin = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Turns audit events into notifications (pure; exported for tests). */
export function buildAdminNotifications(
  events: AuditRow[],
  names: Map<string, { name: string; role: string | null }>,
  submittedAt: Map<string, string | null>
): Built[] {
  const nameOf = (id: string | null | undefined) => (id ? names.get(id)?.name : null) ?? 'A user';
  const built = new Map<string, Built>();
  // Oldest first, so grouped entries keep the latest text and time.
  for (const e of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const d = e.details ?? {};
    switch (e.action) {
      case 'report.submitted': {
        built.set(`audit:${e.id}`, {
          eventKey: `audit:${e.id}`,
          type: 'admin_report',
          title: 'New report filed',
          body: `${nameOf(e.actor_id)} reported ${nameOf(d.targetId as string)} for ${categoryLabel(d.reason, d.category).toLowerCase()}.`,
          href: e.target_id ? `/admin/reports/${e.target_id}` : '/admin/reports',
          createdAt: e.created_at,
        });
        break;
      }
      case 'lawyer.submitted': {
        const lawyerId = e.target_id ?? e.actor_id;
        const again = ['needs_resubmission', 'rejected', 'more_info_requested', 'revoked'].includes(String(d.previous_status ?? ''));
        const roll = typeof d.roll_number === 'string' && d.roll_number ? ` (Roll No. ${d.roll_number})` : '';
        built.set(`audit:${e.id}`, {
          eventKey: `audit:${e.id}`,
          type: 'admin_lawyer_application',
          title: again ? 'Application resubmitted' : 'New lawyer application',
          body: `${attorneyNameOr(typeof d.full_name === 'string' ? d.full_name : null, nameOf(lawyerId))}${roll} ${
            again ? 'resubmitted their application' : 'applied'
          } for verification.`,
          href: '/admin/lawyers/verification-queue',
          createdAt: e.created_at,
        });
        break;
      }
      case 'lawyer.document.uploaded':
      case 'lawyer.document.replaced': {
        const lawyerId = e.target_id;
        // Uploads before the application is submitted belong to the application itself.
        const submitted = lawyerId ? submittedAt.get(lawyerId) : null;
        if (!lawyerId || e.actor_id !== lawyerId || !submitted || Date.parse(e.created_at) <= Date.parse(submitted) + 60_000) break;
        const key = `docs:${lawyerId}:${manilaDay(e.created_at)}`;
        const prev = built.get(key);
        const docs = [...new Set([...((prev as Built & { docs?: string[] })?.docs ?? []), docLabel(d.doc_type)])];
        built.set(key, Object.assign(
          {
            eventKey: key,
            type: 'admin_lawyer_documents' as const,
            title: 'Verification documents updated',
            body: `${nameOf(lawyerId)} uploaded ${listJoin(docs)}.`,
            href: `/admin/lawyers/${lawyerId}`,
            createdAt: e.created_at,
          },
          { docs }
        ));
        break;
      }
      case 'lawyer.profile.updated':
      case 'lawyer.payment_qr.updated':
      case 'lawyer.hours.updated': {
        const lawyerId = e.target_id ?? e.actor_id;
        if (!lawyerId) break;
        const what =
          e.action === 'lawyer.payment_qr.updated'
            ? 'updated their payment QR'
            : e.action === 'lawyer.hours.updated'
              ? 'changed their consultation hours'
              : Array.isArray(d.changed) && d.changed.length
                ? `changed their ${listJoin((d.changed as string[]).slice(0, 4))}`
                : 'updated their profile';
        built.set(`audit:${e.id}`, {
          eventKey: `audit:${e.id}`,
          type: 'admin_lawyer_update',
          title: 'Lawyer profile updated',
          body: `${nameOf(lawyerId)} ${what}.`,
          href: `/admin/lawyers/${lawyerId}`,
          createdAt: e.created_at,
        });
        break;
      }
      case 'account.deletion_requested': {
        const userId = e.target_id ?? e.actor_id;
        if (!userId) break;
        const due = typeof d.dueAt === 'string' ? new Date(d.dueAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric' }) : null;
        built.set(`audit:${e.id}`, {
          eventKey: `audit:${e.id}`,
          type: 'admin_account_deletion',
          title: 'Account deletion requested',
          body: `${nameOf(userId)} asked to delete their account${due ? `. It will be deleted on ${due} unless they cancel` : ''}.`,
          href: `/admin/users/${userId}`,
          createdAt: e.created_at,
        });
        break;
      }
    }
  }
  return [...built.values()];
}

/**
 * Creates this admin's notifications for recent events they haven't been told about. Grouped
 * entries that already exist (same lawyer, same day) are refreshed and marked unread again
 * when something new was added. Never throws.
 */
export async function ensureAdminNotifications(db: Db, adminId: string, now = Date.now()): Promise<void> {
  try {
    const since = new Date(now - LOOKBACK_MS).toISOString();
    const { data: rawEvents, error } = await db
      .from('audit_log')
      .select('id, actor_id, action, target_type, target_id, details, created_at')
      .in('action', [...ADMIN_EVENT_ACTIONS])
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(MAX_EVENTS);
    if (error) {
      console.warn('[adminNotifications] audit_log', error.message);
      return;
    }
    // Other admins' actions (e.g. uploads on someone's behalf) are not news for admins.
    const events = ((rawEvents ?? []) as AuditRow[]).filter((e) => e.actor_id !== adminId);
    if (events.length === 0) return;

    const people = events.flatMap((e) => [e.actor_id, e.target_id, typeof e.details?.targetId === 'string' ? (e.details.targetId as string) : null]);
    const names = await namesFor(db, people.filter((x): x is string => !!x));
    const actorIsAdmin = (e: AuditRow) => !!e.actor_id && names.get(e.actor_id)?.role === 'admin';

    const lawyerIds = [...new Set(events.filter((e) => e.action.startsWith('lawyer.document')).map((e) => e.target_id).filter((x): x is string => !!x))];
    const submittedAt = new Map<string, string | null>();
    if (lawyerIds.length) {
      const { data } = await db.from('lawyer_profiles').select('user_id, submitted_at').in('user_id', lawyerIds);
      for (const l of (data ?? []) as Array<{ user_id: string; submitted_at: string | null }>) submittedAt.set(l.user_id, l.submitted_at);
    }

    const built = buildAdminNotifications(events.filter((e) => !actorIsAdmin(e)), names, submittedAt);
    if (built.length === 0) return;

    const { data: existingRows } = await db
      .from('notifications')
      .select('id, metadata, body')
      .eq('user_id', adminId)
      .like('type', 'admin_%')
      .gte('created_at', new Date(now - LOOKBACK_MS - 2 * 24 * 3600 * 1000).toISOString());
    const existing = new Map(
      ((existingRows ?? []) as Array<{ id: string; metadata: { eventKey?: string } | null; body: string | null }>)
        .filter((r) => typeof r.metadata?.eventKey === 'string')
        .map((r) => [r.metadata!.eventKey as string, r])
    );

    const inserts = [];
    for (const b of built) {
      const metadata = { eventKey: b.eventKey, href: b.href };
      const row = existing.get(b.eventKey);
      if (!row) {
        inserts.push({ user_id: adminId, type: b.type, title: b.title, body: b.body, data: metadata, metadata, channel: 'in_app', is_read: false, created_at: b.createdAt });
      } else if (b.eventKey.startsWith('docs:') && row.body !== b.body) {
        await db.from('notifications').update({ body: b.body, is_read: false, created_at: b.createdAt }).eq('id', row.id);
      }
    }
    if (inserts.length) {
      const { error: insertErr } = await db.from('notifications').insert(inserts);
      if (insertErr) console.warn('[adminNotifications] insert', insertErr.message);
    }
  } catch (err) {
    console.warn('[adminNotifications]', err);
  }
}
