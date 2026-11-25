/**
 * Server-only helpers for the conversation extras (replies, pins, read receipts,
 * attachments, typing). Added alongside the original messaging code in
 * `consultationActions.ts`, which is left unchanged: these helpers mirror its
 * session and conversation rules instead of editing it.
 */
import { createHmac } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { checkAccountAccess } from '@/lib/moderation/accountStatus';
import type { MessageExtras, StoredMessageMeta, ThreadExtras } from './types';

export type Db = SupabaseClient;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Same private bucket as My Documents. */
export const DOCUMENTS_BUCKET = 'case-documents';
const SIGNED_URL_SECONDS = 60 * 60;

export interface MessagingSession {
  db: Db;
  user: User;
  fullName: string | null;
}

/** Signed-in user + service client, with the same account-status check as the original actions. */
export async function getMessagingSession(): Promise<MessagingSession | { error: string }> {
  let user: User | null = null;
  try {
    const supabase = await createClient();
    user = (await supabase.auth.getUser()).data?.user ?? null;
  } catch {
    user = null;
  }
  if (!user) return { error: 'Your session has expired. Please sign in again to continue.' };

  const db = (await createServiceClient()) as unknown as Db;
  const { data: profile } = await db
    .from('profiles')
    .select('user_id, full_name, account_status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return { error: 'We could not load your account profile. Please sign out and sign in again.' };

  const blocked = await checkAccountAccess(db, user.id, profile.account_status ?? 'active');
  if (blocked) return { error: blocked };
  return { db, user, fullName: profile.full_name ?? null };
}

export interface Pair {
  otherId: string;
  /** Every consultation between the two users (messages are filed under these). */
  consultationIds: string[];
}

/**
 * Resolves a conversation the same way the original messaging code does: `threadId` is the
 * other participant's user id, or any consultation id between the two users.
 */
export async function resolvePair(db: Db, threadId: string, userId: string): Promise<Pair | null> {
  if (!UUID_RE.test(threadId ?? '')) return null;

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
  if (!UUID_RE.test(otherId) || otherId === userId) return null;

  const { data } = await db
    .from('consultations')
    .select('id')
    .or(`and(client_id.eq.${userId},lawyer_id.eq.${otherId}),and(client_id.eq.${otherId},lawyer_id.eq.${userId})`);
  if (!data || data.length === 0) return null;
  return { otherId, consultationIds: data.map((c: { id: string }) => c.id) };
}

/**
 * Realtime topic shared by exactly the two participants (typing indicator). Like the per-user
 * live topics it is an HMAC with a server secret, so nobody else can compute it.
 */
export function conversationTopic(userA: string, userB: string): string | null {
  const secret = process.env.REALTIME_TOPIC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!secret) return null;
  const [a, b] = [userA, userB].sort();
  return `dm-${createHmac('sha256', secret).update(`justicia-dm:${a}:${b}`).digest('hex').slice(0, 40)}`;
}

export function readMeta(raw: unknown): StoredMessageMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return (raw as { kind?: unknown }).kind === 'dm-meta' ? (raw as StoredMessageMeta) : null;
}

export function emptyMeta(): StoredMessageMeta {
  return { kind: 'dm-meta', v: 1 };
}

/** One message of the pair (any sender), or null when it isn't part of this conversation. */
export async function findPairMessage(
  db: Db,
  pair: Pair,
  messageId: string
): Promise<{ id: string; sender_id: string; role: string | null; citations: unknown } | null> {
  if (!UUID_RE.test(messageId ?? '')) return null;
  const { data } = await db
    .from('messages')
    .select('id, sender_id, role, citations, conversation_or_thread_id')
    .eq('id', messageId)
    .in('conversation_or_thread_id', pair.consultationIds)
    .maybeSingle();
  return data ?? null;
}

/**
 * Writes `patch` into a message's stored meta (read → merge → write). The row is re-read right
 * before writing, so a pin by one participant and a "Seen" receipt by the other landing at the
 * same moment don't overwrite each other (both people then see the pin). `current` is only the
 * fallback when the re-read fails.
 */
export async function patchMeta(db: Db, messageId: string, current: unknown, patch: Partial<StoredMessageMeta>) {
  const { data: fresh } = await db.from('messages').select('citations').eq('id', messageId).maybeSingle();
  const base = fresh ? fresh.citations : current;
  const next: StoredMessageMeta = { ...(readMeta(base) ?? emptyMeta()), ...patch, kind: 'dm-meta', v: 1 };
  const { error } = await db.from('messages').update({ citations: next }).eq('id', messageId);
  return { meta: next, error };
}

/** Signed URLs for documents, keyed by document id. */
export async function signDocuments(db: Db, documentIds: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (documentIds.length === 0) return urls;
  const { data: docs } = await db
    .from('documents')
    .select('id, storage_path')
    .in('id', documentIds)
    .is('deleted_at', null);
  const rows = (docs ?? []) as Array<{ id: string; storage_path: string }>;
  if (rows.length === 0) return urls;
  const { data: signed } = await db.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      SIGNED_URL_SECONDS
    );
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  for (const r of rows) {
    const url = byPath.get(r.storage_path);
    if (url) urls.set(r.id, url);
  }
  return urls;
}

/** Converts stored meta into what the signed-in user's view needs. */
export function toExtras(meta: StoredMessageMeta, userId: string, urls: Map<string, string>): MessageExtras {
  return {
    replyToId: meta.replyToId ?? null,
    attachments: (meta.attachments ?? []).map((a) => ({ ...a, url: urls.get(a.id) ?? null })),
    autoCaption: !!meta.autoCaption,
    pinned: meta.pinnedAt ? { byMe: meta.pinnedBy === userId, at: meta.pinnedAt } : null,
    seenAt: meta.seenAt ?? null,
  };
}

/** Replies, pins, read receipts and attachments (with signed URLs) for a whole conversation. */
/**
 * `hideReadReceipts`: the viewer chose not to share "Seen", so they don't see it either.
 */
export async function loadThreadExtras(
  db: Db,
  pair: Pair,
  userId: string,
  options: { hideReadReceipts?: boolean } = {}
): Promise<ThreadExtras> {
  const { data } = await db
    .from('messages')
    .select('id, citations')
    .in('conversation_or_thread_id', pair.consultationIds)
    .not('citations', 'is', null);

  const metas: Array<[string, StoredMessageMeta]> = [];
  for (const row of (data ?? []) as Array<{ id: string; citations: unknown }>) {
    const meta = readMeta(row.citations);
    if (meta) metas.push([row.id, meta]);
  }
  const attachmentIds = metas.flatMap(([, m]) => (m.attachments ?? []).map((a) => a.id));
  const urls = await signDocuments(db, attachmentIds);

  const messages: ThreadExtras['messages'] = {};
  for (const [id, meta] of metas) {
    const extras = toExtras(meta, userId, urls);
    messages[id] = options.hideReadReceipts ? { ...extras, seenAt: null } : extras;
  }
  return { messages };
}
