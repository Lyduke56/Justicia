'use server';

/**
 * Sharing a My Documents folder in a conversation (client ↔ lawyer). New code only: the message
 * is sent through the original sendDirectMessageAction (same checks and "new message"
 * notification), then the folder is recorded in the message's stored meta (messages.citations)
 * and the other participant gets view-only access to each file (document_access_grants).
 *
 * What is shared is the folder's files at that moment; files added to the folder later are not.
 */
import { after } from 'next/server';
import { emitLive } from '@/lib/realtime/live';
import { sendDirectMessageAction, type ThreadMessage } from '@/app/actions/consultationActions';
import { UUID_RE, getMessagingSession, resolvePair, toExtras, type Db } from '@/lib/messaging/server';
import {
  MAX_SHARED_FOLDER_FILES,
  folderCaption,
  type MessageExtras,
  type SharedFolder,
  type StoredMessageMeta,
} from '@/lib/messaging/types';

/** Same markers as My Documents folders (consultationActions.ts). */
const FOLDER_MIME = 'application/x-justicia-folder';
const FOLDER_PREFIX = '[Folder] ';
const MAX_NOTE_LENGTH = 1000;

export interface ShareableFolder {
  id: string;
  name: string;
  fileCount: number;
}

type FolderRow = { id: string; filename: string; mime_type: string | null; storage_path: string | null };
type FileRow = { id: string; filename: string; mime_type: string | null; size_bytes: number | null; storage_path: string | null };

const isFolderRow = (r: { filename: string; mime_type?: string | null }) => r.mime_type === FOLDER_MIME || r.filename.startsWith(FOLDER_PREFIX);
const folderName = (r: { filename: string }) => r.filename.replace(FOLDER_PREFIX, '').trim() || 'Untitled folder';
/** Files of a folder live under `{ownerId}/folders/{folderId}/…`. */
const folderIdOf = (path: string | null) => path?.match(/^[^/]+\/folders\/([0-9a-f-]{36})\//i)?.[1] ?? null;

async function ownedRows(db: Db, userId: string): Promise<{ folders: FolderRow[]; files: FileRow[] }> {
  const { data, error } = await db
    .from('documents')
    .select('id, filename, mime_type, size_bytes, storage_path')
    .eq('owner_id', userId)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as FileRow[];
  return { folders: rows.filter(isFolderRow), files: rows.filter((r) => !isFolderRow(r)) };
}

/** Gives the other participant view access to the files (idempotent). */
async function grantView(db: Db, documentIds: string[], granteeId: string, grantorId: string) {
  if (documentIds.length === 0) return true;
  const { data: existing } = await db
    .from('document_access_grants')
    .select('document_id')
    .eq('grantee_id', granteeId)
    .is('revoked_at', null)
    .in('document_id', documentIds);
  const have = new Set(((existing ?? []) as Array<{ document_id: string }>).map((r) => r.document_id));
  const rows = documentIds
    .filter((id) => !have.has(id))
    .map((id) => ({ document_id: id, grantee_id: granteeId, granted_by: grantorId, level: 'view' }));
  if (rows.length === 0) return true;
  const { error } = await db.from('document_access_grants').insert(rows);
  if (error) console.warn('[messageFolders] grant failed:', error.message);
  return !error;
}

/** The signed-in user's own My Documents folders, for the "Share a folder" picker. */
export async function getShareableFoldersAction(): Promise<{ success: true; folders: ShareableFolder[] } | { success?: false; error: string }> {
  try {
    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { folders, files } = await ownedRows(session.db, session.user.id);
    const counts = new Map<string, number>();
    for (const f of files) {
      const id = folderIdOf(f.storage_path);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return {
      success: true,
      folders: folders
        .map((f) => ({ id: f.id, name: folderName(f), fileCount: counts.get(f.id) ?? 0 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (err) {
    console.error('[getShareableFoldersAction]', err);
    return { error: 'Your folders could not be loaded. Please try again.' };
  }
}

/**
 * Shares one of the user's folders with the other participant of the conversation. `note` is an
 * optional message sent with it.
 */
export async function shareDocumentFolderAction(
  threadId: string,
  folderId: string,
  note?: string
): Promise<{ success: true; message: ThreadMessage; extras: MessageExtras } | { success?: false; error: string }> {
  try {
    if (!UUID_RE.test(folderId ?? '')) return { error: 'Please choose a folder to share.' };
    const text = typeof note === 'string' ? note.trim() : '';
    if (text.length > MAX_NOTE_LENGTH) return { error: `The message must be ${MAX_NOTE_LENGTH} characters or fewer.` };

    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;
    const pair = await resolvePair(db, threadId, user.id);
    if (!pair) return { error: 'Conversation not found.' };

    const { folders, files } = await ownedRows(db, user.id);
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return { error: 'This folder is no longer in your documents.' };
    const inFolder = files.filter((f) => folderIdOf(f.storage_path) === folder.id);
    if (inFolder.length === 0) return { error: 'This folder is empty. Add documents to it before sharing.' };
    if (inFolder.length > MAX_SHARED_FOLDER_FILES) {
      return { error: `A shared folder can hold up to ${MAX_SHARED_FOLDER_FILES} files. Move some files out first.` };
    }

    const shared: SharedFolder = {
      id: folder.id,
      name: folderName(folder),
      files: inFolder.map((f) => ({
        id: f.id,
        name: f.filename,
        mimeType: f.mime_type || 'application/octet-stream',
        size: Number(f.size_bytes) || 0,
      })),
    };

    // Access first, so the folder is never announced without the files being viewable.
    if (!(await grantView(db, shared.files.map((f) => f.id), pair.otherId, user.id))) {
      return { error: 'The folder could not be shared. Please try again.' };
    }

    // The original action does the validation, insert and recipient notification.
    const sent = await sendDirectMessageAction(threadId, text || folderCaption(shared.name, shared.files.length));
    if (!('message' in sent) || !sent.message) return { error: ('error' in sent && sent.error) || 'The folder could not be shared.' };

    const meta: StoredMessageMeta = { kind: 'dm-meta', v: 1, folder: shared, autoCaption: !text };
    const { error: updateErr } = await db
      .from('messages')
      .update({ citations: meta, attachment_ids: shared.files.map((f) => f.id) })
      .eq('id', sent.message.id)
      .eq('sender_id', user.id);
    if (updateErr) console.error('[shareDocumentFolderAction] meta update failed:', updateErr.message);

    try {
      after(() => emitLive([user.id, pair.otherId], ['messages', 'documents']));
    } catch {
      void emitLive([user.id, pair.otherId], ['messages', 'documents']);
    }
    return { success: true, message: sent.message, extras: toExtras(meta, user.id, new Map()) };
  } catch (err) {
    console.error('[shareDocumentFolderAction] error:', err);
    return { error: 'The folder could not be shared. Please try again.' };
  }
}
