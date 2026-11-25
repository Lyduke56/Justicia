import { NextResponse, type NextRequest } from 'next/server';
import { getUserDocumentsDataAction } from '@/app/actions/consultationActions';
import { guardStatus, requireActiveAccount } from '@/lib/auth/guards';
import { formatAttorneyName } from '@/lib/utils/attorneyName';
import type { DocumentFolderView } from '@/lib/documents/types';

/**
 * GET /api/live/documents?role=client|lawyer
 *
 * The signed-in user's document folders: the existing My Documents loader
 * (getUserDocumentsDataAction, which only reads the caller's own files and the consultations
 * they take part in), plus who each shared consultation folder belongs to. A client's shared
 * folder reads "Shared to Atty. …"; a lawyer's reads "Shared by <client>".
 * Responds 401 with no session.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

type ConsultationNames = {
  id: string;
  client_id: string;
  lawyer_id: string;
  lawyer_profiles: { full_name: string | null } | null;
  client: { full_name: string | null; email: string | null } | null;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const role = request.nextUrl.searchParams.get('role') === 'lawyer' ? 'lawyer' : 'client';
  try {
    const { user, db } = await requireActiveAccount();
    const folders: DocumentFolderView[] = await getUserDocumentsDataAction(role);

    const sharedIds = folders.filter((f) => f.kind === 'shared').map((f) => f.id);
    if (sharedIds.length > 0) {
      const { data } = await db
        .from('consultations')
        .select('id, client_id, lawyer_id, lawyer_profiles(full_name), client:profiles!consultations_client_id_fkey(full_name, email)')
        .in('id', sharedIds)
        .or(`client_id.eq.${user.id},lawyer_id.eq.${user.id}`);
      const byId = new Map(((data ?? []) as unknown as ConsultationNames[]).map((c) => [c.id, c]));
      for (const folder of folders) {
        if (folder.kind !== 'shared') continue;
        const c = byId.get(folder.id);
        if (!c) continue;
        if (c.lawyer_id === user.id) {
          const client = c.client?.full_name?.trim() || c.client?.email || 'your client';
          folder.sharedLabel = `Shared by ${client}`;
        } else {
          const lawyer = c.lawyer_profiles?.full_name?.trim();
          folder.sharedLabel = `Shared to ${lawyer ? formatAttorneyName(lawyer) : 'your attorney'}`;
        }
      }
    }

    return NextResponse.json({ data: folders }, { headers: NO_STORE });
  } catch (err) {
    const status = guardStatus(err);
    if (status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
    if (status !== 500) return NextResponse.json({ error: 'Your account cannot open documents right now.' }, { status, headers: NO_STORE });
    console.error('[api/live/documents]', err);
    return NextResponse.json({ error: 'Could not load documents.' }, { status: 500, headers: NO_STORE });
  }
}
