'use server';

/**
 * Deleting several My Documents files at once. New code only: used for "Client Vault & Uploaded
 * Records", which is not a folder row in public.documents but the page's grouping of the files
 * that are in no folder, so deleting it means deleting those files. Same soft delete
 * (`deleted_at`) and owner check as deleteDocumentFileAction in consultationActions.ts.
 */
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { emitLive } from '@/lib/realtime/live';
import { UUID_RE, getMessagingSession } from '@/lib/messaging/server';

const FOLDER_MIME = 'application/x-justicia-folder';
const MAX_FILES = 500;

export async function deleteDocumentFilesAction(
  documentIds: string[]
): Promise<{ success: true; deleted: number } | { success?: false; error: string }> {
  try {
    const ids = Array.isArray(documentIds) ? [...new Set(documentIds.filter((id) => typeof id === 'string' && UUID_RE.test(id)))] : [];
    if (ids.length === 0) return { error: 'There are no documents to delete.' };
    if (ids.length > MAX_FILES) return { error: `You can delete up to ${MAX_FILES} documents at a time.` };

    const session = await getMessagingSession();
    if ('error' in session) return { error: session.error };
    const { db, user } = session;

    const { data, error } = await db
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .eq('owner_id', user.id)
      .is('deleted_at', null)
      // Files only (folders go through deleteDocumentFolderAction); NULL mime types are files too.
      .or(`mime_type.is.null,mime_type.neq.${FOLDER_MIME}`)
      .select('id');
    if (error) {
      console.error('[deleteDocumentFilesAction] update failed:', error.message);
      return { error: 'Failed to delete the documents.' };
    }

    revalidatePath('/client/documents');
    revalidatePath('/lawyer/documents');
    try {
      after(() => emitLive([user.id], ['documents']));
    } catch {
      void emitLive([user.id], ['documents']);
    }
    return { success: true, deleted: (data ?? []).length };
  } catch (err) {
    console.error('[deleteDocumentFilesAction] error:', err);
    return { error: 'Failed to delete the documents.' };
  }
}
