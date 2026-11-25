import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardStatus, guardMessage, requireActiveAccount } from '@/lib/auth/guards';
import { readDatabaseRole } from '@/lib/auth/roles';
import { accountPreferences } from '@/lib/account/preferences';

/**
 * GET /api/account/export — "Download my data" (Data Privacy Act, RA 10173, right to data
 * portability). Returns one JSON file with the signed-in user's own records: account and
 * profile, consultations, payments, their conversations, reviews, the list of their documents
 * (names and dates, not the files), notifications, reports they filed, consent records and past
 * requests. One export per 24 hours; each export is logged in data_requests.
 */
export const dynamic = 'force-dynamic';

const DAY_MS = 86_400_000;

function parseMeta(text: string | null): Record<string, unknown> {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : { description: text };
  } catch {
    return { description: text };
  }
}

async function rows<T = Record<string, unknown>>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.warn('[account export]', error.message);
    return [];
  }
  return (data ?? []) as T[];
}

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const { user, db: anyDb } = await requireActiveAccount();
    const db = anyDb as SupabaseClient;
    const userId = user.id;

    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { count: recent } = await db
      .from('data_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('request_type', 'access')
      .gte('created_at', since);
    if ((recent ?? 0) > 0) {
      return NextResponse.json(
        { error: 'You already downloaded your data in the last 24 hours. Please try again tomorrow.' },
        { status: 429, headers }
      );
    }

    const role = await readDatabaseRole(db, userId);
    const [account, profile, consultations, payments, reviewsWritten, reviewsReceived, documents, notifications, reports, consents, requests] =
      await Promise.all([
        db.from('user_accounts').select('email, full_name, phone, role, verification_status, created_at').eq('id', userId).maybeSingle(),
        db.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        rows<{ id: string; client_id: string; lawyer_id: string; concern_summary: string | null } & Record<string, unknown>>(
          db
            .from('consultations')
            .select('id, client_id, lawyer_id, scheduled_start, scheduled_end, method, status, practice_area, concern_summary, meeting_url, created_at, updated_at')
            .or(`client_id.eq.${userId},lawyer_id.eq.${userId}`)
            .order('created_at', { ascending: true })
        ),
        rows(
          db
            .from('payments')
            .select('id, consultation_id, payer_id, payee_id, amount, platform_fee, currency, status, payout_status, provider, paid_at, created_at')
            .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
        ),
        rows(db.from('reviews').select('id, consultation_id, lawyer_id, rating, comment, counsel_reply, created_at').eq('client_id', userId)),
        role === 'lawyer'
          ? rows(db.from('reviews').select('id, consultation_id, rating, comment, counsel_reply, counsel_replied_at, created_at').eq('lawyer_id', userId))
          : Promise.resolve([]),
        rows(db.from('documents').select('id, filename, mime_type, size_bytes, uploaded_at, deleted_at').eq('owner_id', userId)),
        rows(db.from('notifications').select('type, title, body, is_read, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(500)),
        rows(db.from('reports').select('id, target_type, category, reason, status, resolution_notes, created_at, resolved_at').eq('reporter_id', userId)),
        rows(db.from('consent_records').select('document_type, version, accepted_at').eq('user_id', userId)),
        rows(db.from('data_requests').select('request_type, status, created_at, completed_at').eq('user_id', userId)),
      ]);

    // Names of the people on the other side of each consultation.
    const otherIds = [...new Set(consultations.map((c) => (c.client_id === userId ? c.lawyer_id : c.client_id)))];
    const names = otherIds.length
      ? await rows<{ user_id: string; full_name: string | null }>(db.from('profiles').select('user_id, full_name').in('user_id', otherIds))
      : [];
    const nameOf = new Map(names.map((n) => [n.user_id, n.full_name ?? 'Justicia user']));

    // Messages in the user's own consultation conversations (both sides of each conversation).
    const consultationIds = consultations.map((c) => c.id as string);
    const messages = consultationIds.length
      ? await rows<{ conversation_or_thread_id: string; sender_id: string; content: string; role: string; sent_at: string }>(
          db
            .from('messages')
            .select('conversation_or_thread_id, sender_id, content, role, sent_at')
            .in('conversation_or_thread_id', consultationIds)
            .order('sent_at', { ascending: true })
            .limit(5000)
        )
      : [];

    let lawyer: Record<string, unknown> | null = null;
    if (role === 'lawyer') {
      const [{ data: lp }, docs, unavailability] = await Promise.all([
        db.from('lawyer_profiles').select('full_name, roll_number, ibp_chapter, bar_passer_year, about, practice_areas, languages, experience_years, fee_initial_30min, fee_standard_60min, fee_extended_120min, verification_status, submitted_at, reviewed_at, is_visible, is_available').eq('user_id', userId).maybeSingle(),
        rows(db.from('lawyer_verification_documents').select('doc_type, original_filename, uploaded_at, review_status, superseded_at').eq('lawyer_id', userId)),
        rows(db.from('lawyer_unavailability').select('unavailable_date, start_minutes, end_minutes, reason').eq('lawyer_id', userId)),
      ]);
      lawyer = { profile: lp ?? null, verificationDocuments: docs, unavailability };
    }

    const exportedAt = new Date().toISOString();
    const body = {
      about: 'Your personal data held by Justicia, exported under the Data Privacy Act of 2012 (RA 10173). Files you uploaded are listed by name; download them from My Documents.',
      exportedAt,
      account: {
        email: user.email,
        emailVerified: Boolean(user.email_confirmed_at),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at ?? null,
        record: account.data ?? null,
        profile: profile.data ?? null,
        preferences: accountPreferences(user.user_metadata),
      },
      lawyer,
      consultations: consultations.map((c) => {
        const meta = parseMeta(c.concern_summary as string | null);
        const { concern_summary: _omit, ...rest } = c;
        void _omit;
        return {
          ...rest,
          yourRole: c.client_id === userId ? 'client' : 'lawyer',
          otherParty: nameOf.get(c.client_id === userId ? c.lawyer_id : c.client_id) ?? 'Justicia user',
          details: meta,
        };
      }),
      messages: messages.map((m) => ({
        consultationId: m.conversation_or_thread_id,
        from: m.role === 'system' ? 'Justicia' : m.sender_id === userId ? 'you' : nameOf.get(m.sender_id) ?? 'other participant',
        content: m.content,
        sentAt: m.sent_at,
      })),
      payments,
      reviews: { written: reviewsWritten, received: reviewsReceived },
      documents,
      notifications,
      reportsFiled: reports,
      consentRecords: consents,
      dataRequests: requests,
    };

    // data_requests.request_type allows access | deletion | correction (live check constraint).
    const { error: logError } = await db
      .from('data_requests')
      .insert({ user_id: userId, request_type: 'access', status: 'completed', completed_at: exportedAt, details: 'Downloaded from Settings' });
    if (logError) {
      console.error('[account export] request not recorded:', logError.message);
      return NextResponse.json({ error: 'Your data could not be exported. Please try again.' }, { status: 500, headers });
    }
    await db.from('audit_log').insert({ actor_id: userId, action: 'account.data_exported', target_type: 'user_account', target_id: userId, details: {} });

    const filename = `justicia-my-data-${exportedAt.slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: guardMessage(err, 'Your data could not be exported. Please try again.') }, { status: guardStatus(err), headers });
  }
}
