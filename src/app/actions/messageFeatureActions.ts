'use server';

/**
 * Conversation extras: attachments, replies, pinned messages, "Seen" receipts and the typing
 * channel. New code only — the original messaging actions in consultationActions.ts are reused
 * as-is (sending still goes through sendDirectMessageAction, so its checks and notifications apply).
 */
import { randomUUID } from 'crypto';
import { after } from 'next/server';
import { emitLive } from '@/lib/realtime/live';
import { accountPreferences } from '@/lib/account/preferences';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { FILE_CONTENT_MISMATCH, fileMatchesExtension } from '@/lib/security/fileType';
import { sendDirectMessageAction, type ThreadMessage } from '@/app/actions/consultationActions';
import {
  DOCUMENTS_BUCKET,
  UUID_RE,
  conversationTopic,
  findPairMessage,
  getMessagingSession,
  patchMeta,
  readMeta,
  resolvePair,
  signDocuments,
  toExtras,
  type Db,
} from '@/lib/messaging/server';
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_VOICE_SECONDS,
  attachmentKind,
  autoCaptionFor,
  fileExt,
  type MessageAttachment,
  type MessageExtras,
  type StoredMessageMeta,
} from '@/lib/messaging/types';

const MAX_PINS_PER_CONVERSATION = 20;

function notifyLive(userIds: string[]) {
  try {
    after(() => emitLive(userIds, ['messages']));
  } catch {
    void emitLive(userIds, ['messages']);
  }
}

/** Gives the other participant view access to files sent to them (idempotent). */
async function grantToRecipient(db: Db, documentIds: string[], granteeId: string, grantorId: string) {
  if (documentIds.length === 0) return;
  const { data: existing } = await db
    .from('document_access_grants')
    .select('document_id')
    .eq('grantee_id', granteeId)
    .is('revoked_at', null)
    .in('document_id', documentIds);
  const have = new Set((existing ?? []).map((r: { document_id: string }) => r.document_id));
  const rows = documentIds
    .filter((id) => !have.has(id))
    .map((id) => ({ document_id: id, grantee_id: granteeId, granted_by: grantorId, level: 'view' }));
  if (rows.length === 0) return;
  const { error } = await db.from('document_access_grants').insert(rows);
  if (error) console.warn('[messageFeatures] grant failed:', error.message);
}

// ─── Typing channel ──────────────────────────────────────────────────────────

/** Private Realtime topic for this conversation; both participants broadcast "typing" on it. */
export async function getConversationChannelAction(
  threadId: string
): Promise<{ topic: string; hideTyping: boolean } | { error: string }> {
  const session = await getMessagingSession();
  if ('error' in session) return { error: session.error };
  const pair = await resolvePair(session.db, threadId, session.user.id);
  if (!pair) return { error: 'Conversation not found.' };
  const topic = conversationTopic(session.user.id, pair.otherId);
  // "Hide when I'm typing": this user neither sends nor sees typing signals.
  const { hideTyping } = accountPreferences(session.user.user_metadata).messaging;
  return topic ? { topic, hideTyping } : { error: 'Live updates are not configured.' };
}

// ─── Attachments ─────────────────────────────────────────────────────────────

/**
 * Uploads one file for a message (stored privately like My Documents). The file is only shared
 * with the other participant once the message is sent.
 */
export async function uploadMessageAttachmentAction(
  formData: FormData
): Promise<{ success: true; attachment: MessageAttachment } | { success?: false; error: string }> {
  try {
    const file = formData.get('file');
    const threadId = String(formData.get('threadId') ?? '');
    if (!(file instanceof File) || file.size === 0) return { error: 'Please choose a file to attach.' };
    if (file.size > MAX_ATTACHMENT_BYTES) return { error: `"${file.name}" is larger than 8 MB.` };

    const name = file.name.replace(/[\\/]/g, '_').slice(-180) || 'attachment';
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(fileExt(name))) {
      return { error: `"${file.name}" isn't a supported file type.` };
    }

    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;
    const pair = await resolvePair(db, threadId, user.id);
    if (!pair) return { error: 'Conversation not found.' };
    const limited = await checkRateLimit('upload', user.id);
    if (limited) return { error: limited };
    if (!(await fileMatchesExtension(file, fileExt(name)))) return { error: FILE_CONTENT_MISMATCH };

    const safeName = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const storagePath = `${user.id}/messages/${pair.otherId}/${randomUUID()}-${safeName}`;
    const mimeType = file.type || 'application/octet-stream';

    const { error: uploadErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, { contentType: mimeType, upsert: false });
    if (uploadErr) {
      console.error('[uploadMessageAttachmentAction] upload failed:', uploadErr.message);
      return { error: 'We could not upload the file. Please try again.' };
    }

    const { data: doc, error: insertErr } = await db
      .from('documents')
      .insert({
        owner_id: user.id,
        filename: name,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: file.size,
        visibility_scope: 'private',
      })
      .select('id, filename, mime_type, size_bytes')
      .single();
    if (insertErr || !doc) {
      console.error('[uploadMessageAttachmentAction] insert failed:', insertErr?.message);
      await db.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      return { error: 'We could not save the file. Please try again.' };
    }

    const kind = attachmentKind(doc.mime_type, doc.filename);
    const rawDuration = Number(formData.get('durationSec'));
    const durationSec =
      kind === 'audio' && Number.isFinite(rawDuration) && rawDuration > 0
        ? Math.min(Math.round(rawDuration), MAX_VOICE_SECONDS)
        : null;

    return {
      success: true,
      attachment: { id: doc.id, name: doc.filename, mimeType: doc.mime_type, size: doc.size_bytes, kind, durationSec },
    };
  } catch (err) {
    console.error('[uploadMessageAttachmentAction] error:', err);
    return { error: 'We could not upload the file. Please try again.' };
  }
}

// ─── Sending with a reply and/or attachments ─────────────────────────────────

export async function sendMessageWithExtrasAction(
  threadId: string,
  content: string,
  options: { replyToId?: string | null; attachments?: Array<{ id: string; durationSec?: number | null }> } = {}
): Promise<{ success: true; message: ThreadMessage; extras: MessageExtras | null } | { success?: false; error: string }> {
  try {
    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;
    const pair = await resolvePair(db, threadId, user.id);
    if (!pair) return { error: 'Conversation not found.' };

    // Reply target must be a message of this conversation.
    let replyToId: string | null = null;
    if (options.replyToId) {
      const target = await findPairMessage(db, pair, options.replyToId);
      if (!target) return { error: 'The message you are replying to is no longer available.' };
      replyToId = target.id;
    }

    // Attachments must be files this user uploaded for this conversation.
    const requested = (options.attachments ?? []).filter((a) => UUID_RE.test(a?.id ?? ''));
    if (requested.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      return { error: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.` };
    }
    let attachments: StoredMessageMeta['attachments'] = [];
    if (requested.length > 0) {
      const { data: docs } = await db
        .from('documents')
        .select('id, filename, mime_type, size_bytes, storage_path')
        .in('id', requested.map((a) => a.id))
        .eq('owner_id', user.id)
        .is('deleted_at', null);
      const byId = new Map(
        ((docs ?? []) as Array<{ id: string; filename: string; mime_type: string; size_bytes: number; storage_path: string }>)
          .filter((d) => d.storage_path.startsWith(`${user.id}/messages/${pair.otherId}/`))
          .map((d) => [d.id, d])
      );
      if (byId.size !== requested.length) return { error: 'One of the attachments could not be found. Please attach it again.' };
      attachments = requested.map((a) => {
        const d = byId.get(a.id)!;
        const kind = attachmentKind(d.mime_type, d.filename);
        const durationSec =
          kind === 'audio' && Number.isFinite(a.durationSec) && (a.durationSec as number) > 0
            ? Math.min(Math.round(a.durationSec as number), MAX_VOICE_SECONDS)
            : null;
        return { id: d.id, name: d.filename, mimeType: d.mime_type, size: d.size_bytes, kind, durationSec };
      });
    }

    const typed = typeof content === 'string' ? content.trim() : '';
    if (!typed && attachments.length === 0) return { error: 'Message cannot be empty.' };
    const text = typed || autoCaptionFor(attachments);

    // The original action does the validation, insert and recipient notification.
    const sent = await sendDirectMessageAction(threadId, text);
    if (!('message' in sent) || !sent.message) return { error: ('error' in sent && sent.error) || 'Your message could not be sent.' };

    if (!replyToId && attachments.length === 0) return { success: true, message: sent.message, extras: null };

    const meta: StoredMessageMeta = {
      kind: 'dm-meta',
      v: 1,
      ...(replyToId ? { replyToId } : {}),
      ...(attachments.length ? { attachments, autoCaption: !typed } : {}),
    };
    const { error: updateErr } = await db
      .from('messages')
      .update({ citations: meta, attachment_ids: attachments.map((a) => a.id) })
      .eq('id', sent.message.id)
      .eq('sender_id', user.id);
    if (updateErr) console.error('[sendMessageWithExtrasAction] meta update failed:', updateErr.message);

    await grantToRecipient(db, attachments.map((a) => a.id), pair.otherId, user.id);
    notifyLive([user.id, pair.otherId]);

    const urls = await signDocuments(db, attachments.map((a) => a.id));
    return { success: true, message: sent.message, extras: toExtras(meta, user.id, urls) };
  } catch (err) {
    console.error('[sendMessageWithExtrasAction] error:', err);
    return { error: 'Your message could not be sent. Please try again.' };
  }
}

// ─── Pinned messages ─────────────────────────────────────────────────────────

/** Pins or unpins a message for both participants. */
export async function togglePinMessageAction(
  threadId: string,
  messageId: string
): Promise<{ success: true; pinned: { byMe: boolean; at: string } | null } | { success?: false; error: string }> {
  try {
    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;
    const pair = await resolvePair(db, threadId, user.id);
    if (!pair) return { error: 'Conversation not found.' };

    const msg = await findPairMessage(db, pair, messageId);
    if (!msg || msg.role === 'system') return { error: 'This message cannot be pinned.' };

    const current = readMeta(msg.citations);
    const isPinned = !!current?.pinnedAt;

    if (!isPinned) {
      const { data: rows } = await db
        .from('messages')
        .select('citations')
        .in('conversation_or_thread_id', pair.consultationIds)
        .not('citations', 'is', null);
      const pinCount = (rows ?? []).filter((r: { citations: unknown }) => readMeta(r.citations)?.pinnedAt).length;
      if (pinCount >= MAX_PINS_PER_CONVERSATION) {
        return { error: `You can pin up to ${MAX_PINS_PER_CONVERSATION} messages. Unpin one first.` };
      }
    }

    const at = new Date().toISOString();
    const { error } = await patchMeta(
      db,
      msg.id,
      msg.citations,
      isPinned ? { pinnedBy: null, pinnedAt: null } : { pinnedBy: user.id, pinnedAt: at }
    );
    if (error) {
      console.error('[togglePinMessageAction]', error.message);
      return { error: 'We could not update the pin. Please try again.' };
    }
    notifyLive([user.id, pair.otherId]);
    return { success: true, pinned: isPinned ? null : { byMe: true, at } };
  } catch (err) {
    console.error('[togglePinMessageAction] error:', err);
    return { error: 'We could not update the pin. Please try again.' };
  }
}

// ─── "Seen" receipts ─────────────────────────────────────────────────────────

/**
 * Marks the newest message from the other participant as seen (seeing the newest implies the
 * earlier ones). Called while the conversation is open on screen.
 */
export async function markThreadSeenAction(
  threadId: string
): Promise<
  { success: true; messageId: string | null; seenAt: string | null; hidden?: boolean } | { success?: false; error: string }
> {
  try {
    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;
    const pair = await resolvePair(db, threadId, user.id);
    if (!pair) return { error: 'Conversation not found.' };

    const { data: latest } = await db
      .from('messages')
      .select('id, citations')
      .in('conversation_or_thread_id', pair.consultationIds)
      .eq('sender_id', pair.otherId)
      .neq('role', 'system')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return { success: true, messageId: null, seenAt: null };

    // "Hide read receipts": nothing is recorded, so the sender never sees "Seen".
    if (accountPreferences(session.user.user_metadata).messaging.hideReadReceipts) {
      return { success: true, messageId: latest.id, seenAt: null, hidden: true };
    }

    const existing = readMeta(latest.citations)?.seenAt;
    if (existing) return { success: true, messageId: latest.id, seenAt: existing };

    const seenAt = new Date().toISOString();
    const { error } = await patchMeta(db, latest.id, latest.citations, { seenAt });
    if (error) {
      console.error('[markThreadSeenAction]', error.message);
      return { error: 'Could not update read status.' };
    }
    notifyLive([pair.otherId]);
    return { success: true, messageId: latest.id, seenAt };
  } catch (err) {
    console.error('[markThreadSeenAction] error:', err);
    return { error: 'Could not update read status.' };
  }
}
