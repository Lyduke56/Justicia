'use server';

/**
 * Document downloads for My Documents / Client Documents. New code only: access checks and the
 * access audit record come from the existing getDocumentAccessUrlAction (owner, or a user the
 * file was shared with through document_access_grants).
 */
import { getDocumentAccessUrlAction } from '@/app/actions/consultationActions';

/**
 * Short-lived link that downloads the file (Supabase Storage sends it as an attachment named
 * after the document) instead of opening it in the browser.
 */
export async function getDocumentDownloadUrlAction(
  documentId: string
): Promise<{ success: true; url: string; fileName: string } | { success?: false; error: string }> {
  const res = await getDocumentAccessUrlAction(documentId);
  if (!('url' in res) || !res.url) {
    return { error: ('error' in res && res.error) || 'This file could not be downloaded. Please try again.' };
  }
  const fileName = (res.fileName || 'document').replace(/[\r\n"]/g, '').trim() || 'document';
  const separator = res.url.includes('?') ? '&' : '?';
  return { success: true, url: `${res.url}${separator}download=${encodeURIComponent(fileName)}`, fileName };
}
